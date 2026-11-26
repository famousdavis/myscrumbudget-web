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
import type { AppState } from '@/types/domain';
import { useRepository } from '@/components/RepositoryProvider';
import { describeStorageError, describeExportOmission } from '@/lib/storage/localStorage';
import { useImportState } from '@/features/projects/hooks/useImportState';
import { getDashboardEmptyState } from '@/features/projects/lib/dashboardCard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { HeadingRow } from '@/components/HeadingRow';
import { WelcomePanel } from '@/features/projects/components/WelcomePanel';
import { ToolbarIcon } from '@/components/icons/ToolbarIcon';
import { TOOLBAR_ICON_PATHS } from '@/components/icons/toolbarIconPaths';

/** The tile shown in place of a project the dashboard cannot render (v0.44.6). */
function ProjectTileFailed({ name }: { name: string }) {
  return (
    <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <p className="font-medium">{name || 'A project'} could not be displayed.</p>
      <p className="mt-1">Part of its data is in a form this app cannot show. Nothing was changed.</p>
    </div>
  );
}
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
  const { repository, isCloud } = useRepository();
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
  // `projects` list, never these filtered subsets.
  //
  // ⚠️ THE REASON CHANGED IN v0.37.12; THE RULE DID NOT. Until then, handing
  // reorderProjects a filtered list PERMANENTLY DELETED every hidden archived
  // project, because the localStorage implementation rebuilt storage from exactly
  // the ids it was handed. That implementation now appends the ids it was not
  // handed, so a filtered drag no longer destroys anything — it would instead
  // silently MOVE every hidden archived project to the END of the order, on every
  // single drag, permanently clustering them at the bottom and contradicting the
  // v0.34.0 single-interleaved-grid design.
  //
  // ⚠️ That is a WEAKER consequence and a WEAKER-GUARDED one: nobody files "my
  // archived project moved". The invariant survives as a rule about ORDER rather
  // than existence, and it is pinned by a test that had to have its FIXTURE fixed
  // to see it — see `src/app/__tests__/page.test.tsx`.
  //
  // ⚠️ v0.42.0: cloud mode keeps the order in the READER's own settings document
  // now, and its reorder is a read-modify-write of that array — so the rule and
  // its weaker consequence apply identically on both sides. The paragraph above
  // describes localStorage because, until this release, that was the only
  // implementation which appended the ids it was not handed.
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
    let data: AppState;
    try {
      data = await repository.exportAll();
    } catch (err) {
      addToast(describeStorageError(err, 'Export failed. Please try again.'), 'error');
      return;
    }
    downloadJson(data, `myscrumbudget-export-${new Date().toISOString().slice(0, 10)}.json`);
    reportExport();
  };

  // ⚠️ Criterion 6. An export that quietly omits unreadable entries is the one
  // way this release could still cost a user their data: they export, see a
  // file, believe they are safe, and clear their browser. Shared by both export
  // paths so the two cannot drift.
  const reportExport = () => {
    const omission = describeExportOmission(isCloud);
    if (omission) addToast(`Export complete. ${omission}`, 'info');
    else addToast('Export complete', 'success');
  };

  const handleExportProject = async (id: string) => {
    // `exportProject` returns null ONLY for "no such project"; a read failure
    // rethrows after reporting itself, so "Project not found." can never be
    // shown for a failure that was actually a damaged read.
    let data: AppState | null;
    try {
      data = await exportProject(id);
    } catch {
      return;
    }
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
    const omission = describeExportOmission(isCloud);
    if (omission) addToast(`Exported "${name}". ${omission}`, 'info');
    else addToast(`Exported "${name}"`, 'success');
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
      {/* The dashboard toolbar, matched across the SPERT® Suite (v0.44.7):
          Export All · Import · New Project, with the shared icons. Every button
          is always rendered and keeps its place; Export All is DISABLED, not
          hidden, with no projects (which also covers the load, because
          useProjects starts with an empty list). Accessible names begin with
          the visible label (WCAG 2.5.3). No role="toolbar": that role promises
          arrow-key navigation, which this row does not provide. */}
      {/* FRAME26 (v0.45.0): the frame's heading row. "Dashboard" became "Projects" (contract §2: each collection is
          named by its noun), and every button is 36 px through `.sf-btn` (14 / 500, 18 px icons); their corners,
          colours, hover and disabled rules are unchanged. */}
      <HeadingRow
        toolbar={
          <div className="sf-toolbar" data-sf="toolbar">
            <input
              ref={importFileRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Import JSON workspace file"
            />
            <button
              onClick={handleExportAll}
              disabled={projects.length === 0}
              aria-label="Export all projects as JSON"
              className="sf-btn rounded border border-zinc-300 px-4 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ToolbarIcon d={TOOLBAR_ICON_PATHS.export} />
              Export All
            </button>
            <button
              onClick={() => importFileRef.current?.click()}
              disabled={importPhase.phase === 'applying'}
              aria-label="Import projects from JSON"
              className="sf-btn rounded border border-zinc-300 px-4 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <ToolbarIcon d={TOOLBAR_ICON_PATHS.import} />
              Import
            </button>
            <Link
              href="/projects/new"
              className="sf-btn rounded bg-blue-600 px-4 text-white hover:bg-blue-700"
            >
              <ToolbarIcon d={TOOLBAR_ICON_PATHS.plus} />
              New Project
            </Link>
          </div>
        }
      >
        Projects
      </HeadingRow>

      {/* The collection's filter row (contract §3, `data-sf="filters"`): 16 px below the heading row, the grid 16 px
          below it. Rendered only while an archived project exists, as before. */}
      {archivedProjects.length > 0 && (
        <div className="sf-below flex items-center gap-2" data-sf="filters">
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
        // The loading grid takes the tile grid's geometry (`.sf-tiles`) but no hook and no drop handlers.
        <div className="sf-tiles">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonProjectCard key={i} />
          ))}
        </div>
      ) : emptyState === 'onboarding' ? (
        // `data-sf="empty"`: the Welcome panel stands in for the tile grid (contract §7, v0.46.0).
        <WelcomePanel ratesReviewed={ratesReviewed} poolCount={pool.length} />
      ) : emptyState === 'no-visible-projects' ? (
        // Every project archived (contract §7, v0.46.0): one plain line, 16 px below the filter row, in the page's muted
        // text (4.82 / 6.76:1). Not the Welcome panel: the collection is not empty.
        <p className="sf-below italic text-zinc-500 dark:text-zinc-400" data-sf="empty">
          {`All projects are archived. Select "Show archived (${archivedProjects.length})" to see them.`}
        </p>
      ) : (
        <div
          // The frame's tile grid (contract §3): repeat(auto-fill, minmax(340px, 1fr)), gap 16, 16 px below the
          // heading row or the filter row: 3 columns at 1280 and 1440, 4 at 1920 (3 everywhere before v0.45.0).
          className="sf-tiles"
          data-sf="tiles"
          // Makes the gutters and the empty cells after the last card droppable.
          // Before v0.37.17 a drop there hit no card, so nothing called
          // preventDefault() on dragover and the browser discarded the gesture
          // with no message. Bails when a card owns the point, so the per-card
          // path is unchanged.
          //
          // ⚠️ The skeleton grid above has the same tile-grid class and must NOT
          // get these handlers — it renders no cards, so a drop there would
          // resolve to nothing. Identify this branch by the visibleProjects.map
          // below it, never by matching the class string.
          {...drag.containerHandlers}
        >
          {/* ⚠️ ONE BOUNDARY PER TILE (v0.44.6): a tile whose project cannot be
              rendered shows a notice, and every other tile still renders. Any
              member of a shared project can write its document. */}
          {visibleProjects.map((project) => (
            <ErrorBoundary
              key={project.id}
              label="dashboard-tile"
              fallback={<ProjectTileFailed name={project.name} />}
            >
            <ProjectCard
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
            </ErrorBoundary>
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
