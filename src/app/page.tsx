'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useTeamPool } from '@/features/team/hooks/useTeamPool';
import { useDragReorder } from '@/hooks/useDragReorder';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import { ConfirmDialog } from '@/components/BaseDialog';

export default function DashboardPage() {
  const { projects, loading, deleteProject, reorderProjects } = useProjects();
  const { settings } = useSettings();
  const { pool } = useTeamPool();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const drag = useDragReorder(projects, 'id', reorderProjects);

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
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              settings={settings}
              pool={pool}
              onDelete={(id) => {
                const p = projects.find((pr) => pr.id === id);
                if (p) setDeleteTarget({ id, name: p.name });
              }}
              isDragging={drag.isDragging(project.id)}
              isDragOver={drag.isDragOver(project.id)}
              {...drag.handlersFor(project.id)}
            />
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Project"
          message={<>Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.</>}
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
