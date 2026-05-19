// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import type {
  ImportDecision,
  SettingsDecision,
  TeamPoolDecision,
  ImportMergeResult,
  MergePreview,
} from '@/lib/utils/importUtils';
import { buildBannerText } from '@/lib/utils/importUtils';

interface PerProjectRowProps {
  project: { id: string; name: string };
  decision: ImportDecision;
  conflictLabel: string | null;
  onDecision: (d: ImportDecision) => void;
}

function PerProjectRow({
  project,
  decision,
  conflictLabel,
  onDecision,
}: PerProjectRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-zinc-200 px-3 py-2 dark:border-zinc-700">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{project.name}</p>
        {conflictLabel && (
          <p className="text-xs text-amber-600 dark:text-amber-400">{conflictLabel}</p>
        )}
        {decision === 'replace' && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            All reforecasts and assignments in the existing project will be overwritten.
          </p>
        )}
      </div>
      <div
        className="flex shrink-0 gap-1"
        role="group"
        aria-label={`Decision for ${project.name}`}
      >
        {(['add', 'skip', 'replace'] as ImportDecision[]).map((d) => (
          <button
            key={d}
            onClick={() => onDecision(d)}
            aria-pressed={decision === d}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              decision === d
                ? d === 'replace'
                  ? 'bg-amber-600 text-white'
                  : d === 'skip'
                    ? 'bg-zinc-500 text-white'
                    : 'bg-blue-600 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
          >
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ImportPreviewSectionProps {
  preview: MergePreview;
  isApplying: boolean;
  onDecision: (projectId: string, d: ImportDecision) => void;
  onSettingsDecision: (d: SettingsDecision) => void;
  onTeamPoolDecision: (d: TeamPoolDecision) => void;
  onApply: () => void;
  onCancel: () => void;
}

export function ImportPreviewSection({
  preview,
  isApplying,
  onDecision,
  onSettingsDecision,
  onTeamPoolDecision,
  onApply,
  onCancel,
}: ImportPreviewSectionProps) {
  const {
    incomingState,
    decisions,
    conflicts,
    settingsDecision,
    teamPoolDecision,
    duplicatesDropped,
  } = preview;

  const addCount = Object.values(decisions).filter((d) => d === 'add').length;
  const replaceCount = Object.values(decisions).filter((d) => d === 'replace').length;
  const skipCount = Object.values(decisions).filter((d) => d === 'skip').length;

  const shownCount = incomingState.projects.length;
  const totalCount = shownCount + duplicatesDropped;

  return (
    <div
      role="region"
      aria-label="Import preview"
      className="mt-6 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/20"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Import Preview</h2>
        <button
          onClick={onCancel}
          disabled={isApplying}
          aria-label="Cancel import"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:pointer-events-none dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          ✕
        </button>
      </div>

      {/* Duplicate-ID notice */}
      {duplicatesDropped > 0 && (
        <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          {duplicatesDropped === 1
            ? '1 project had a duplicate ID and was removed from the import.'
            : `${duplicatesDropped} projects had duplicate IDs and were removed from the import.`}
        </p>
      )}

      {/* Cloud hydration hint */}
      {preview.mode === 'cloud' &&
        preview.existingProjects.length === 0 &&
        shownCount > 0 && (
          <p className="mb-2 rounded bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            If you just enabled cloud sync, your existing projects may still be loading.
            Cancel and try again once the dashboard shows your projects.
          </p>
        )}

      {/* Projects section header — shows full file count when duplicates dropped */}
      <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {duplicatesDropped > 0
          ? `Projects (${shownCount} of ${totalCount} from file)`
          : `Projects (${shownCount} incoming)`}
      </p>
      <div className="space-y-1.5">
        {incomingState.projects.map((project) => {
          const conflict = conflicts[project.id];
          const conflictLabel = conflict
            ? conflict.type === 'id'
              ? `ID conflict with "${conflict.existingName}"`
              : `Name conflict with "${conflict.existingName}"`
            : null;
          return (
            <PerProjectRow
              key={project.id}
              project={project}
              decision={decisions[project.id] ?? 'skip'}
              conflictLabel={conflictLabel}
              onDecision={(d) => onDecision(project.id, d)}
            />
          );
        })}
      </div>

      {/* Settings */}
      <div className="mt-4">
        <p className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Settings
        </p>
        <div className="flex gap-2" role="group" aria-label="Settings import decision">
          {(['keep', 'replace'] as SettingsDecision[]).map((d) => (
            <button
              key={d}
              onClick={() => onSettingsDecision(d)}
              aria-pressed={settingsDecision === d}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                settingsDecision === d
                  ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
            >
              {d === 'keep' ? 'Keep current' : 'Replace with imported'}
            </button>
          ))}
        </div>
      </div>

      {/* Team Pool */}
      <div className="mt-3">
        <p className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Team Pool
        </p>
        <div className="flex gap-2" role="group" aria-label="Team pool import decision">
          {(['keep', 'merge', 'replace'] as TeamPoolDecision[]).map((d) => (
            <button
              key={d}
              onClick={() => onTeamPoolDecision(d)}
              aria-pressed={teamPoolDecision === d}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                teamPoolDecision === d
                  ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
            >
              {d === 'keep' ? 'Keep current' : d === 'merge' ? 'Merge (add new)' : 'Replace'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary and action buttons */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {[
            addCount > 0 && `${addCount} to add`,
            replaceCount > 0 && `${replaceCount} to replace`,
            skipCount > 0 && `${skipCount} to skip`,
          ]
            .filter(Boolean)
            .join(', ') || 'nothing to apply'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isApplying}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          {/* Apply always enabled — even all-skip+keep+keep shows "nothing applied"
              banner rather than a dead button. Pitfall #71. */}
          <button
            onClick={onApply}
            disabled={isApplying}
            aria-busy={isApplying}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isApplying ? 'Importing…' : 'Apply Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ImportBanner({
  result,
  onDismiss,
}: {
  result: ImportMergeResult;
  onDismiss: () => void;
}) {
  const hasErrors = result.errorCount > 0;
  const text = buildBannerText(result);

  return (
    <div
      role={hasErrors ? 'alert' : 'status'}
      aria-live={hasErrors ? 'assertive' : 'polite'}
      className={`mt-4 flex items-start justify-between rounded-lg border p-3 ${
        hasErrors
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
          : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
      }`}
    >
      <div>
        <p
          className={`text-sm font-medium ${
            hasErrors
              ? 'text-red-700 dark:text-red-400'
              : 'text-green-700 dark:text-green-400'
          }`}
        >
          {text}
        </p>
        {hasErrors && result.errorMessages.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {result.errorMessages.map((msg, i) => (
              <li key={i} className="text-xs text-red-600 dark:text-red-400">
                {msg}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss import result"
        className="ml-3 shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        ✕
      </button>
    </div>
  );
}
