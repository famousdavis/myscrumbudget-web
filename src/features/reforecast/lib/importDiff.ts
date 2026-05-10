// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type {
  Reforecast,
  PoolMember,
  Settings,
  MonthlyAllocation,
  ProjectAssignment,
} from '@/types/domain';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { generateId } from '@/lib/utils/id';
import type { ParseResult } from './excelImport';

export interface ImportDiff {
  newPoolMemberDrafts: Array<{ name: string; role: string; tempId: string }>;
  orderedAssignments: ProjectAssignment[];
  newAllocations: MonthlyAllocation[];
  addedCount: number;
  removedCount: number;
  allocationChangedCount: number;
}

export function computeImportDiff(
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

export function countAllocationDiffs(
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
