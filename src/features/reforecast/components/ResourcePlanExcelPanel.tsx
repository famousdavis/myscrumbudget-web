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
  MonthlyAllocation,
  ProjectAssignment,
} from '@/types/domain';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { AlertDialog, BaseDialog, dialogButtonStyles } from '@/components/BaseDialog';
import { useToast } from '@/components/Toast';
import { generateId } from '@/lib/utils/id';
import { buildResourcePlanWorkbookBlob } from '../lib/excelExport';
import {
  parseResourcePlanWorkbook,
  type ImportWarning,
  type ParseResult,
} from '../lib/excelImport';

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

interface ImportDiff {
  newPoolMemberDrafts: Array<{ name: string; role: string; tempId: string }>;
  orderedAssignments: ProjectAssignment[];
  newAllocations: MonthlyAllocation[];
  addedCount: number;
  removedCount: number;
  allocationChangedCount: number;
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

/* ── Diff computation ────────────────────────────────────────────── */

function computeImportDiff(
  parseResult: Extract<ParseResult, { ok: true }>,
  activeReforecast: Reforecast,
  pool: PoolMember[],
  settings: Settings,
  allocationMap: AllocationMap,
): ImportDiff {
  // Build pool index by lowercased name.
  const poolByLower = new Map<string, PoolMember>();
  for (const pm of pool) poolByLower.set(pm.name.toLowerCase(), pm);

  // Build assignments index by poolMemberId for the active reforecast.
  const existingByPoolMemberId = new Map<string, ProjectAssignment>();
  for (const a of activeReforecast.assignments) {
    existingByPoolMemberId.set(a.poolMemberId, a);
  }

  const newPoolMemberDrafts: Array<{ name: string; role: string; tempId: string }> = [];
  const orderedAssignments: ProjectAssignment[] = [];
  const newAllocations: MonthlyAllocation[] = [];

  let addedCount = 0;

  for (const row of parseResult.rows) {
    const matchedPool = poolByLower.get(row.name.toLowerCase());
    let poolMemberId: string;

    if (matchedPool) {
      poolMemberId = matchedPool.id;
    } else {
      // New pool member needed. Use a temporary ID; it gets re-keyed at apply time.
      const roleMatchesLabor = settings.laborRates.some((lr) => lr.role === row.role);
      const role = roleMatchesLabor ? row.role : 'Unknown';
      const tempId = `tmp_${generateId()}`;
      newPoolMemberDrafts.push({ name: row.name, role, tempId });
      poolMemberId = tempId;
    }

    // Reuse existing assignment id when possible (keeps allocation linkage stable
    // for cells the user did not touch). Otherwise generate a fresh one.
    const existing = existingByPoolMemberId.get(poolMemberId);
    let assignmentId: string;
    if (existing) {
      assignmentId = existing.id;
    } else {
      assignmentId = generateId();
      addedCount += 1;
    }

    orderedAssignments.push({ id: assignmentId, poolMemberId });

    for (const month of Object.keys(row.allocationsByMonth)) {
      const value = row.allocationsByMonth[month];
      if (value > 0) {
        newAllocations.push({ memberId: assignmentId, month, allocation: value });
      }
    }
  }

  // Removed = members present in active reforecast assignments but not represented in Excel.
  const representedPoolMemberIds = new Set<string>();
  for (const a of orderedAssignments) representedPoolMemberIds.add(a.poolMemberId);
  // Note: temp pool member IDs are also tracked in this set, which is correct —
  // they represent newly-Excel-added members whose poolMemberIds couldn't have
  // existed in the active reforecast yet.
  const removedCount = activeReforecast.assignments.filter(
    (a) => !representedPoolMemberIds.has(a.poolMemberId),
  ).length;

  // Allocation changed count = symmetric diff of (memberId, month) → value
  // between current and new. We compare by the (memberId, month) key, treating
  // missing as 0 on either side.
  const allocationChangedCount = countAllocationDiffs(
    activeReforecast,
    allocationMap,
    orderedAssignments,
    newAllocations,
    existingByPoolMemberId,
    parseResult.rows.length,
  );

  return {
    newPoolMemberDrafts,
    orderedAssignments,
    newAllocations,
    addedCount,
    removedCount,
    allocationChangedCount,
  };
}

function countAllocationDiffs(
  activeReforecast: Reforecast,
  allocationMap: AllocationMap,
  orderedAssignments: ProjectAssignment[],
  newAllocations: MonthlyAllocation[],
  existingByPoolMemberId: Map<string, ProjectAssignment>,
  _rowCount: number,
): number {
  void _rowCount;

  // Build a current map keyed by (poolMemberId, month) → allocation. We use
  // poolMemberId rather than assignment.id to compare across the diff, since
  // the new assignments may have fresh IDs for re-added members. Allocations
  // referencing assignment IDs not in the active reforecast (orphans) are
  // ignored — they would not render in the grid.
  const assignmentIdToPool = new Map<string, string>();
  for (const a of activeReforecast.assignments) {
    assignmentIdToPool.set(a.id, a.poolMemberId);
  }
  const currentByKey = new Map<string, number>();
  for (const month of allocationMap.keys()) {
    for (const [assignmentId, value] of allocationMap.get(month)!.entries()) {
      const poolMemberId = assignmentIdToPool.get(assignmentId);
      if (!poolMemberId) continue;
      currentByKey.set(`${poolMemberId}|${month}`, value);
    }
  }

  const newAssignmentIdToPool = new Map<string, string>();
  for (const a of orderedAssignments) {
    newAssignmentIdToPool.set(a.id, a.poolMemberId);
  }
  const newByKey = new Map<string, number>();
  for (const a of newAllocations) {
    const poolMemberId = newAssignmentIdToPool.get(a.memberId);
    if (!poolMemberId) continue;
    newByKey.set(`${poolMemberId}|${a.month}`, a.allocation);
  }

  // Symmetric diff: any key in only one map, or in both with different values.
  const allKeys = new Set([...currentByKey.keys(), ...newByKey.keys()]);
  let count = 0;
  for (const key of allKeys) {
    const before = currentByKey.get(key) ?? 0;
    const after = newByKey.get(key) ?? 0;
    if (before !== after) count += 1;
  }

  // Suppress unused param lint by referencing pool index.
  void existingByPoolMemberId;

  return count;
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

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'unnamed';
}
