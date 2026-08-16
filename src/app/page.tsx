// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useTeamPool } from '@/features/team/hooks/useTeamPool';
import { useDragReorder } from '@/hooks/useDragReorder';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import { ConfirmDialog, AlertDialog } from '@/components/BaseDialog';
import { useToast } from '@/components/Toast';
import { SkeletonProjectCard } from '@/components/Skeleton';
import { STORAGE_KEYS } from '@/types/storage';
import { repo } from '@/lib/storage/repo';
import { useImportState } from '@/features/projects/hooks/useImportState';
import { getDashboardEmptyState } from '@/features/projects/lib/dashboardCard';
import {
  ImportPreviewSection,
  ImportBanner,
} from '@/features/projects/components/ImportPreviewSection';

export default function DashboardPage() {
  const {
    projects,
    loading,
    deleteProject,
    reorderProjects,
    setProjectColor,
    cloneProject,
    exportProject,
    archiveProject,
    unarchiveProject,
  } = useProjects();
  const { settings } = useSettings();
  const { pool } = useTeamPool();
  const { addToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  // ⚠️ DISPOSITION (v0.36.2): this is the same lazy-initializer-with-typeof-window
  // construct that caused a production hydration error in FirstRunBanner, and the
  // comment that used to sit here made the same false claim that it is "SSR-safe".
  // It is NOT safe in general. It is harmless HERE, and only by accident of nesting:
  // DashboardPage renders inside MigrationGuard, which returns null on the server and
  // on the client's first render, so this page never participates in hydration at all
  // and the two renders can never be compared. Verified in production build with
  // msb:ratesReviewed='1' and the onboarding guide visible — no hydration error.
  //
  // Left as-is deliberately rather than "fixed": moving it to useEffect would add a
  // render for no behavioural gain. But it is safe for a reason OUTSIDE this file.
  // If MigrationGuard is ever changed to render its children during SSR, this becomes
  // a live bug — convert it to useState(false) + useEffect, as FirstRunBanner now is.
  const [ratesReviewed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(STORAGE_KEYS.ratesReviewed) === '1';
    } catch {
      return false;
    }
  });
  const drag = useDragReorder(projects, 'id', reorderProjects);
  // Archived is a visibility filter only. `drag` above stays bound to the FULL
  // `projects` list (never these filtered subsets): localStorage reorderProjects
  // rebuilds storage from exactly the ids it is handed, so a filtered list would
  // permanently delete hidden archived projects on the first reorder.
  const archivedProjects = projects.filter((p) => p.archived);
  const visibleProjects = showArchived ? projects : projects.filter((p) => !p.archived);
  const emptyState = getDashboardEmptyState(projects.length, visibleProjects.length);

  const importFileRef = useRef<HTMLInputElement>(null);
  const {
    phase: importPhase,
    handleFileChange,
    setDecision,
    setSettingsDecision,
    setTeamPoolDecision,
    runApply,
    cancelImport,
    fileError,
    clearFileError,
  } = useImportState(importFileRef);
  // No useEffect for auto-reload: applyImportMerge calls cloudSyncBus.emit('projects'),
  // which useProjects subscribes to. Dashboard re-fetches automatically.

  const downloadJson = (data: unknown, filename: string) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAll = async () => {
    const data = await repo.exportAll();
    downloadJson(data, `myscrumbudget-export-${new Date().toISOString().slice(0, 10)}.json`);
    addToast('Export complete', 'success');
  };

  const handleExportProject = async (id: string) => {
    const data = await exportProject(id);
    if (!data) {
      addToast('Project not found.', 'error');
      return;
    }
    const name = projects.find((p) => p.id === id)?.name ?? 'project';
    // The trailing `-+$` trim below is SAFE HERE, BY REPLACE-ORDERING — not a false
    // positive, and not "bounded input" (nothing bounds a project name). The
    // preceding `.replace(/[^a-z0-9]+/g, '-')` collapses every MAXIMAL run of
    // non-alphanumerics to a single dash, so `--` cannot exist by the time the trim
    // runs and there is nothing for it to backtrack across. Verified by exhaustive
    // search (299,592 strings) and a 200k-trial fuzz: longest post-collapse dash run
    // = 1, zero counterexamples; full pipeline on 1 MB = 0.69 ms.
    // ⚠️ The trim regex IS genuinely quadratic in isolation (measured 3.3x per
    // doubling on `a` + n*`-` + `b`), so REUSING it on un-collapsed input inherits a
    // real quadratic. The safety is a property of this pipeline, not of the regex.
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
    downloadJson(data, `myscrumbudget-${slug}-${new Date().toISOString().slice(0, 10)}.json`);
    addToast(`Exported "${name}"`, 'success');
  };

  const handleCloneProject = async (id: string) => {
    const clone = await cloneProject(id);
    if (clone) addToast(`Created "${clone.name}"`, 'success');
  };

  const handleColorChange = (id: string, color: Parameters<typeof setProjectColor>[1]) => {
    void setProjectColor(id, color);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <input
            ref={importFileRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Import JSON workspace file"
          />
          <button
            onClick={() => importFileRef.current?.click()}
            disabled={importPhase.phase === 'applying'}
            className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Import JSON
          </button>
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

      {archivedProjects.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="showArchivedProjects"
            name="showArchivedProjects"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-zinc-300 dark:border-zinc-600"
          />
          <label htmlFor="showArchivedProjects" className="text-sm text-zinc-600 dark:text-zinc-400">
            Show archived ({archivedProjects.length})
          </label>
        </div>
      )}

      {importPhase.phase === 'preview' && (
        <ImportPreviewSection
          preview={importPhase.preview}
          isApplying={false}
          onDecision={setDecision}
          onSettingsDecision={setSettingsDecision}
          onTeamPoolDecision={setTeamPoolDecision}
          onApply={runApply}
          onCancel={cancelImport}
          cloudDataReady={!loading}
        />
      )}
      {importPhase.phase === 'applying' && (
        // Simple spinner — applying phase carries no payload (pitfall #70).
        // ImportPreviewSection is NOT rendered here to avoid carrying preview
        // into the applying phase variant.
        <div
          role="status"
          aria-live="polite"
          className="mt-6 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300"
            aria-hidden="true"
          />
          Importing…
        </div>
      )}
      {importPhase.phase === 'banner' && (
        // cancelImport transitions any non-applying phase → idle.
        // Correct for banner-dismiss: banner → idle. The name is reused here
        // intentionally (both cancel and dismiss share the same → idle semantics).
        <ImportBanner result={importPhase.result} onDismiss={cancelImport} />
      )}
      {fileError && (
        <AlertDialog
          title="Import Error"
          message={fileError}
          onClose={clearFileError}
        />
      )}

      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonProjectCard key={i} />
          ))}
        </div>
      ) : emptyState === 'onboarding' ? (
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
      ) : emptyState === 'no-visible-projects' ? (
        <div className="py-12 text-center">
          <p className="text-lg text-zinc-400 dark:text-zinc-500">All projects are archived.</p>
          <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
            Check &ldquo;Show archived&rdquo; above to view them.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleProjects.map((project) => (
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
              onExport={handleExportProject}
              onClone={handleCloneProject}
              onArchive={archiveProject}
              onUnarchive={unarchiveProject}
              onColorChange={handleColorChange}
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
