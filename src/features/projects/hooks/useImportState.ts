// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useRef, useCallback } from 'react';
import { repo } from '@/lib/storage/repo';
import { getStorageMode } from '@/lib/storage/storageMode';
import { runMigrations } from '@/lib/storage/migrations';
import { validateAppState } from '@/lib/utils/validation';
import { parseImportJson } from '@/lib/utils/safeJsonParse';
import { sanitizeAppState } from '@/lib/utils/sanitizeImport';
import {
  buildMergePreview,
  applyImportMerge,
  type ImportPhase,
  type ImportDecision,
  type ImportMergeResult,
  type SettingsDecision,
  type TeamPoolDecision,
} from '@/lib/utils/importUtils';
import type { AppState, Project } from '@/types/domain';

const MAX_IMPORT_SIZE = 10 * 1024 * 1024; // 10 MB

export interface UseImportStateReturn {
  phase: ImportPhase;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  setDecision: (projectId: string, decision: ImportDecision) => void;
  setSettingsDecision: (d: SettingsDecision) => void;
  setTeamPoolDecision: (d: TeamPoolDecision) => void;
  runApply: () => Promise<void>;
  cancelImport: () => void;
  fileError: string | null;
  clearFileError: () => void;
}

export function useImportState(
  fileInputRef: React.RefObject<HTMLInputElement | null>,
): UseImportStateReturn {
  const [phase, setPhase] = useState<ImportPhase>({ phase: 'idle' });
  const [fileError, setFileError] = useState<string | null>(null);

  // Concurrent-call guard. A ref (not state) because the phase transition
  // already drives the UI — no re-render needed on entry/exit.
  // Pitfall #53: set true at entry, false in finally (single guaranteed reset).
  const isApplyingRef = useRef(false);

  // isMountedRef intentionally absent. Next.js Link navigation can unmount this
  // component while apply is in flight. React 18 silently drops setState on
  // unmounted components — no crash, no memory leak (closure resolves normally).
  // Practical impact: if user navigates away during apply, the banner is not
  // shown on return (state re-initializes to idle). cloudSyncBus.emit('projects')
  // fires before any setPhase call in applyImportMerge, so the project list is
  // current on return regardless. Adding isMountedRef would not change this —
  // it would only make the drop explicit instead of implicit. Accepted UX gap.

  const clearFileError = useCallback(() => setFileError(null), []);

  const resetFileInput = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [fileInputRef]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileError(null);   // clear stale error from a prior failed pick
      resetFileInput();     // reset immediately so re-picking the same file fires onChange — pitfall #19

      if (file.size > MAX_IMPORT_SIZE) {
        setFileError(
          `File too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is 10 MB.`,
        );
        return;
      }

      let text: string;
      try {
        // Blob.text() — no FileReader needed; pitfalls #38 and #48 are N/A.
        text = await file.text();
      } catch {
        setFileError('Could not read file. Please try again.');
        return;
      }

      let parsed: unknown;
      try {
        // Prototype-pollution-safe parse — reuses existing infrastructure.
        parsed = parseImportJson(text);
      } catch {
        setFileError('Invalid JSON file. Please check the file format.');
        return;
      }

      const data = parsed as Record<string, unknown>;

      // Structural pre-checks
      if (!data.version || typeof data.version !== 'string') {
        setFileError('Invalid file: missing or invalid version field.');
        return;
      }
      if (
        !data.settings ||
        typeof data.settings !== 'object' ||
        Array.isArray(data.settings)
      ) {
        setFileError('Invalid file: missing settings.');
        return;
      }
      if (!Array.isArray(data.projects)) {
        setFileError('Invalid file: missing projects array.');
        return;
      }

      // Discriminant check runs on the raw parsed object, BEFORE runMigrations
      // and sanitizeAppState. This ordering is intentional: the check must be
      // readable before sanitize could theoretically strip it. Since msbExportKind
      // IS in APP_STATE_FIELDS (Phase 6), sanitize preserves it — this is
      // belt-and-suspenders ordering.
      // Accept: msbExportKind === 'dataset' OR absent (legacy pre-v0.30.0 exports).
      // Reject any other value to guard against future format confusion — pitfall #61.
      // Tightening note: once all in-the-wild exports have msbExportKind, this
      // can be changed to require the field explicitly.
      if (data.msbExportKind !== undefined && data.msbExportKind !== 'dataset') {
        const kind = String(data.msbExportKind).slice(0, 100);
        setFileError(
          `Unrecognized export format (msbExportKind: "${kind}"). ` +
            'Please use a MyScrumBudget workspace export file.',
        );
        return;
      }

      const migrated = runMigrations(data as unknown as AppState, data.version as string);

      const validation = validateAppState(migrated);
      if (!validation.valid) {
        const errorSummary = validation.errors.slice(0, 5).join('\n');
        const more =
          validation.errors.length > 5
            ? `\n…and ${validation.errors.length - 5} more errors`
            : '';
        // Full list in console for debugging
        console.warn('[import] Validation failed:', validation.errors);
        setFileError(`Invalid data structure:\n${errorSummary}${more}`);
        return;
      }

      const sanitized = sanitizeAppState(migrated);

      // Layer 1: fresh read from repo for conflict detection.
      // Cloud hydration race: if called immediately after enabling cloud mode,
      // this may return empty. Layer 2 in applyImportMerge re-reads and mitigates
      // the common case. The preview UI shows a hint when cloud mode is active
      // and existingProjects is empty.
      let existingProjects: Project[];
      try {
        existingProjects = await repo.getProjects();
      } catch {
        setFileError('Could not read existing projects. Please try again.');
        return;
      }

      const mode = getStorageMode();

      // No fast-path (pitfall #69): always show preview regardless of conflict
      // count and mode. Simplest and safest approach.
      const preview = buildMergePreview(sanitized, existingProjects, mode);
      setPhase({ phase: 'preview', preview });
    },
    [resetFileInput],
  );

  const setDecision = useCallback((projectId: string, decision: ImportDecision) => {
    setPhase((prev) => {
      if (prev.phase !== 'preview') return prev;
      return {
        ...prev,
        preview: {
          ...prev.preview,
          decisions: { ...prev.preview.decisions, [projectId]: decision },
        },
      };
    });
  }, []);

  const setSettingsDecision = useCallback((d: SettingsDecision) => {
    setPhase((prev) => {
      if (prev.phase !== 'preview') return prev;
      return { ...prev, preview: { ...prev.preview, settingsDecision: d } };
    });
  }, []);

  const setTeamPoolDecision = useCallback((d: TeamPoolDecision) => {
    setPhase((prev) => {
      if (prev.phase !== 'preview') return prev;
      return { ...prev, preview: { ...prev.preview, teamPoolDecision: d } };
    });
  }, []);

  const runApply = useCallback(async () => {
    if (phase.phase !== 'preview') return;
    if (isApplyingRef.current) return; // concurrent-call guard
    isApplyingRef.current = true;

    const preview = (phase as Extract<ImportPhase, { phase: 'preview' }>).preview;
    setPhase({ phase: 'applying' });

    // Sign-out mid-apply: if performSignOutCleanup fires, repo swaps to localStorage.
    // Direct repo.* calls (not via useDebouncedSave) complete or fail at the
    // transport level. The result reflects actual completed writes. Accepted edge
    // case — sign-out implies abandonment of in-flight work.
    let result: ImportMergeResult;
    try {
      result = await applyImportMerge(preview);
    } catch (err) {
      result = {
        addedCount: 0,
        replacedCount: 0,
        skippedCount: 0,
        errorCount: 1,
        errorMessages: [
          `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        ],
      };
    } finally {
      // Single guaranteed reset — pitfall #53 discipline.
      isApplyingRef.current = false;
    }

    // Show banner for ALL outcomes including all-skip — pitfall #71.
    // If user navigated away during apply, React 18 drops this call silently.
    // The import completed correctly; cloudSyncBus already emitted.
    setPhase({ phase: 'banner', result });
  }, [phase]);

  const cancelImport = useCallback(() => {
    // Cancel from preview or banner → idle.
    // Cancel during applying is a no-op (write is in flight).
    setPhase((prev) => {
      if (prev.phase === 'applying') return prev;
      return { phase: 'idle' };
    });
  }, []);

  return {
    phase,
    handleFileChange,
    setDecision,
    setSettingsDecision,
    setTeamPoolDecision,
    runApply,
    cancelImport,
    fileError,
    clearFileError,
  };
}
