// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useTeamPool } from '@/features/team/hooks/useTeamPool';
import { useDragReorder } from '@/hooks/useDragReorder';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import { ConfirmDialog } from '@/components/BaseDialog';
import { useToast } from '@/components/Toast';
import { SkeletonProjectCard } from '@/components/Skeleton';
import { STORAGE_KEYS } from '@/types/storage';
import { repo } from '@/lib/storage/repo';

export default function DashboardPage() {
  const { projects, loading, deleteProject, reorderProjects } = useProjects();
  const { settings } = useSettings();
  const { pool } = useTeamPool();
  const { addToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  // Lazy initializer reads localStorage once on mount; SSR-safe via the
  // typeof window guard (returns false on the server, correct value on the client).
  const [ratesReviewed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(STORAGE_KEYS.ratesReviewed) === '1';
    } catch {
      return false;
    }
  });
  const drag = useDragReorder(projects, 'id', reorderProjects);

  const handleExportAll = async () => {
    const data = await repo.exportAll();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myscrumbudget-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Export complete', 'success');
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportAll}
            disabled={projects.length === 0}
            className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export All Projects
          </button>
          <Link
            href="/projects/new"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            New Project
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonProjectCard key={i} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="mx-auto mt-12 max-w-lg rounded-lg border border-dashed border-zinc-300 p-8 dark:border-zinc-700">
          <h2 className="text-center text-lg font-semibold">Getting Started</h2>
          <p className="mt-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Follow these steps to set up your first project.
          </p>
          <ol className="mt-6 space-y-5">
            <li className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ratesReviewed ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                {ratesReviewed ? '\u2713' : '1'}
              </span>
              <div>
                <Link href="/settings" className="text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                  Review Labor Rates
                </Link>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Customize roles and hourly rates in Settings. Default rates are provided.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${pool.length > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                {pool.length > 0 ? '\u2713' : '2'}
              </span>
              <div>
                <Link href="/team" className="text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                  Build Your Team Pool
                </Link>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Add team members and assign their roles. You&apos;ll pick from this pool when staffing projects.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                3
              </span>
              <div>
                <Link href="/projects/new" className="text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                  Create Your First Project
                </Link>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Set up a project with start/end dates, then assign team members from your pool.
                </p>
                <Link
                  href="/projects/new"
                  className="mt-2 inline-block rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Create Project
                </Link>
              </div>
            </li>
          </ol>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              settings={settings}
              pool={pool}
              isShared={((project as unknown as Record<string, unknown>)._memberCount as number) > 1}
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
            const name = deleteTarget.name;
            await deleteProject(deleteTarget.id);
            setDeleteTarget(null);
            addToast(`Project "${name}" deleted`, 'success');
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
