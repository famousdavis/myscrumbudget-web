// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useRef, useState } from 'react';
import type {
  Project,
  Reforecast,
  TeamMember,
  PoolMember,
  Settings,
} from '@/types/domain';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { AlertDialog, BaseDialog, dialogButtonStyles } from '@/components/BaseDialog';
import { useToast } from '@/components/Toast';
import { buildResourcePlanWorkbookBlob } from '../lib/excelExport';
import {
  parseResourcePlanWorkbook,
  type ImportWarning,
  type ParseResult,
} from '../lib/excelImport';
import { computeImportDiff, type ImportDiff } from '../lib/importDiff';

interface Props {
  project: Project;
  activeReforecast: Reforecast;
  members: TeamMember[];
  allocationMap: AllocationMap;
  months: string[];
  pool: PoolMember[];
  settings: Settings;
  updateProject: (updater: (prev: Project) => Project) => void;
  addPoolMember: (name: string, role: string) => PoolMember;
  unarchivePoolMember: (id: string) => void;
}

interface PendingImport {
  parseResult: Extract<ParseResult, { ok: true }>;
  diff: ImportDiff;
}

const MAX_IMPORT_SIZE = 10 * 1024 * 1024; // 10 MB

export function ResourcePlanExcelPanel({
  project,
  activeReforecast,
  members,
  allocationMap,
  months,
  pool,
  settings,
  updateProject,
  addPoolMember,
  unarchivePoolMember,
}: Props) {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorAlert, setErrorAlert] = useState<{ title: string; message: string } | null>(
    null,
  );
  const [pending, setPending] = useState<PendingImport | null>(null);

  const handleExport = async () => {
    try {
      const blob = await buildResourcePlanWorkbookBlob({
        project,
        reforecast: activeReforecast,
        members,
        allocationMap,
        months,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resource-plan-${slug(project.name)}-${slug(activeReforecast.name)}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Resource plan exported', 'success');
    } catch {
      setErrorAlert({
        title: 'Export Failed',
        message: 'Could not build the workbook. Please try again.',
      });
    }
  };

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMPORT_SIZE) {
      setErrorAlert({
        title: 'File Too Large',
        message: `Import files must be under 10 MB. This file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`,
      });
      resetFileInput();
      return;
    }

    const result = await parseResourcePlanWorkbook(
      file,
      project,
      activeReforecast,
      pool,
      settings,
      months,
    );

    if (!result.ok) {
      const top = result.errors.slice(0, 5);
      const more = result.errors.length > 5 ? `\n+${result.errors.length - 5} more` : '';
      setErrorAlert({
        title: 'Resource Plan Import Failed',
        message: top.join('\n') + more,
      });
      resetFileInput();
      return;
    }

    const diff = computeImportDiff(result, activeReforecast, pool, settings, allocationMap);
    setPending({ parseResult: result, diff });
  };

  const handleConfirmImport = () => {
    if (!pending) return;
    const { parseResult, diff } = pending;

    // 1. Pool growth — add any net-new pool members and capture their real IDs.
    const tempToRealId = new Map<string, string>();
    for (const draft of diff.newPoolMemberDrafts) {
      const created = addPoolMember(draft.name, draft.role);
      tempToRealId.set(draft.tempId, created.id);
    }

    // 2. Re-key assignments whose poolMemberId still references a temp id.
    const orderedAssignments = diff.orderedAssignments.map((a) =>
      tempToRealId.has(a.poolMemberId)
        ? { ...a, poolMemberId: tempToRealId.get(a.poolMemberId)! }
        : a,
    );

    // 3. Single project update mutating only the active reforecast.
    updateProject((prev) => ({
      ...prev,
      reforecasts: prev.reforecasts.map((rf) =>
        rf.id !== prev.activeReforecastId
          ? rf
          : {
              ...rf,
              assignments: orderedAssignments,
              allocations: diff.newAllocations,
            },
      ),
    }));

    // 4. Auto-unarchive any matched archived pool members (W5). Targets a
    // different state slice than updateProject (teamPool vs project) — no
    // race. MUST run before the toast loop so the unarchive state-update is
    // queued before the user sees the toast.
    for (const w of parseResult.warnings) {
      if (w.code === 'W5') unarchivePoolMember(w.poolMemberId);
    }

    // 5. Surface warnings (in W1 → W2 → W3 → W5 order; W4 was already shown in confirm).
    for (const w of parseResult.warnings) {
      const msg = warningToToastMessage(w);
      if (msg) addToast(msg, 'info');
    }

    addToast('Resource plan imported', 'success');
    setPending(null);
    resetFileInput();
  };

  const handleCancelImport = () => {
    setPending(null);
    resetFileInput();
  };

  return (
    <div className="mt-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
      <CollapsibleSection title="Resource Plan (Excel)">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleExport}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Export to Excel
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Import from Excel
          </button>
          <input
            ref={fileInputRef}
            name="resourcePlanExcelImport"
            aria-label="Resource plan Excel file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={handleImport}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Round-trip the active reforecast&rsquo;s allocation grid for offline editing.
          </p>
        </div>
      </CollapsibleSection>

      {errorAlert && (
        <AlertDialog
          title={errorAlert.title}
          message={errorAlert.message}
          onClose={() => setErrorAlert(null)}
        />
      )}

      {pending && (
        <ImportConfirmDialog
          activeReforecastName={activeReforecast.name}
          warnings={pending.parseResult.warnings}
          diff={pending.diff}
          onConfirm={handleConfirmImport}
          onCancel={handleCancelImport}
        />
      )}
    </div>
  );
}

/* ── Confirmation dialog ─────────────────────────────────────────── */

function ImportConfirmDialog({
  activeReforecastName,
  warnings,
  diff,
  onConfirm,
  onCancel,
}: {
  activeReforecastName: string;
  warnings: ImportWarning[];
  diff: ImportDiff;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const w4 = warnings.find((w): w is Extract<ImportWarning, { code: 'W4' }> => w.code === 'W4');
  const fellBackCount = warnings.filter(
    (w) => w.code === 'W1' && w.fellBackToUnknown,
  ).length;

  return (
    <BaseDialog
      title="Import Resource Plan"
      actions={
        <>
          <button onClick={onCancel} className={dialogButtonStyles.cancel}>
            Cancel
          </button>
          <button onClick={onConfirm} className={dialogButtonStyles.primary}>
            Import
          </button>
        </>
      }
    >
      <div className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
        {w4 && (
          <p className="text-amber-600 dark:text-amber-400">
            ⚠ This file was exported from reforecast &ldquo;{w4.sourceReforecastName}&rdquo;. Apply
            to active reforecast &ldquo;{w4.activeReforecastName}&rdquo;?
          </p>
        )}
        <p className="font-medium">Active reforecast: {activeReforecastName}</p>
        <ul className="ml-4 list-disc text-zinc-600 dark:text-zinc-400">
          {diff.addedCount > 0 && <li>{diff.addedCount} member(s) added</li>}
          {diff.removedCount > 0 && <li>{diff.removedCount} member(s) removed</li>}
          {diff.allocationChangedCount > 0 && (
            <li>{diff.allocationChangedCount} allocation cell(s) changed</li>
          )}
          {diff.addedCount === 0 &&
            diff.removedCount === 0 &&
            diff.allocationChangedCount === 0 && <li>No changes detected</li>}
        </ul>
        {fellBackCount > 0 && (
          <p className="text-amber-600 dark:text-amber-400">
            ⚠ {fellBackCount} new member(s) will be added with role &ldquo;Unknown&rdquo;
            (role not found in labor rates)
          </p>
        )}
      </div>
    </BaseDialog>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function warningToToastMessage(w: ImportWarning): string | null {
  switch (w.code) {
    case 'W1':
      return `Added new pool member "${w.memberName}" with role "${w.assignedRole}"${w.fellBackToUnknown ? ' (role not in labor rates — set to Unknown)' : ''}`;
    case 'W2':
      return `Kept pool role "${w.poolRole}" for "${w.memberName}" (Excel had "${w.excelRole}")`;
    case 'W3':
      return `Removed "${w.memberName}" from active reforecast`;
    case 'W4':
      // Already surfaced in the confirm dialog — no toast.
      return null;
    case 'W5':
      return `Archived member "${w.memberName}" was reactivated because they appeared in the imported resource plan.`;
  }
}

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
function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'unnamed';
}
