'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useTeamPool } from '@/features/team/hooks/useTeamPool';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import { DeleteProjectDialog } from '@/features/projects/components/DeleteProjectDialog';

export default function DashboardPage() {
  const { projects, loading, deleteProject, reorderProjects } = useProjects();
  const { settings } = useSettings();
  const { pool } = useTeamPool();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragCounterRef = useRef<Map<string, number>>(new Map());

  const handleDragStart = useCallback((projectId: string, e: React.DragEvent) => {
    setDraggedId(projectId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', projectId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
    dragCounterRef.current.clear();
  }, []);

  const handleDragEnter = useCallback((projectId: string) => {
    const count = (dragCounterRef.current.get(projectId) ?? 0) + 1;
    dragCounterRef.current.set(projectId, count);
    setDragOverId(projectId);
  }, []);

  const handleDragLeave = useCallback((projectId: string) => {
    const count = (dragCounterRef.current.get(projectId) ?? 1) - 1;
    dragCounterRef.current.set(projectId, count);
    if (count <= 0) {
      dragCounterRef.current.delete(projectId);
      setDragOverId((prev) => (prev === projectId ? null : prev));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = draggedId;
    if (!sourceId || sourceId === targetId) return;

    const ids = projects.map((p) => p.id);
    const fromIndex = ids.indexOf(sourceId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    // Move sourceId to toIndex position
    ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, sourceId);
    reorderProjects(ids);
  }, [draggedId, projects, reorderProjects]);

  const handleMove = useCallback((projectId: string, direction: 'up' | 'down') => {
    const ids = projects.map((p) => p.id);
    const index = ids.indexOf(projectId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ids.length) return;
    [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];
    reorderProjects(ids);
  }, [projects, reorderProjects]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/projects/new"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New Project
        </Link>
      </div>

      {loading ? (
        <p className="mt-6 text-zinc-500">Loading projects...</p>
      ) : projects.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            No projects yet. Create your first project to get started.
          </p>
          <Link
            href="/projects/new"
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create Project
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              settings={settings}
              pool={pool}
              onDelete={(id) => {
                const p = projects.find((pr) => pr.id === id);
                if (p) setDeleteTarget({ id, name: p.name });
              }}
              onMoveUp={() => handleMove(project.id, 'up')}
              onMoveDown={() => handleMove(project.id, 'down')}
              canMoveUp={index > 0}
              canMoveDown={index < projects.length - 1}
              isDragging={draggedId === project.id}
              isDragOver={dragOverId === project.id && draggedId !== project.id}
              onDragStart={(e) => handleDragStart(project.id, e)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragEnter={() => handleDragEnter(project.id)}
              onDragLeave={() => handleDragLeave(project.id)}
              onDrop={(e) => handleDrop(project.id, e)}
            />
          ))}
        </div>
      )}

      {deleteTarget && (
        <DeleteProjectDialog
          projectName={deleteTarget.name}
          onConfirm={async () => {
            await deleteProject(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
