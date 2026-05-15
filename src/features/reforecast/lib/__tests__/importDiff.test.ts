// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { computeImportDiff, countAllocationDiffs } from '../importDiff';
import type { ParseResult } from '../excelImport';
import type {
  Reforecast,
  PoolMember,
  Settings,
  ProjectAssignment,
  MonthlyAllocation,
} from '@/types/domain';
import { buildAllocationMap, type AllocationMap } from '@/lib/calc/allocationMap';

/* ── fixtures ──────────────────────────────────────────────────────── */

const SETTINGS: Settings = {
  discountRateAnnual: 0.05,
  laborRates: [
    { role: 'Dev', hourlyRate: 100 },
    { role: 'QA', hourlyRate: 80 },
  ],
  holidays: [],
  trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
};

const POOL: PoolMember[] = [
  { id: 'p1', name: 'Alice', role: 'Dev' },
  { id: 'p2', name: 'Bob', role: 'QA' },
];

function makeReforecast(
  assignments: ProjectAssignment[],
  allocations: MonthlyAllocation[],
): Reforecast {
  return {
    id: 'rf1',
    name: 'Baseline',
    createdAt: '2026-05-01T00:00:00.000Z',
    startDate: '2026-06-01',
    endDate: '2026-12-31',
    reforecastDate: '2026-05-01',
    allocations,
    assignments,
    productivityWindows: [],
    actualCost: 0,
    baselineBudget: 0,
  };
}

function makeOkParseResult(
  rows: Array<{ name: string; role: string; allocationsByMonth: Record<string, number> }>,
): Extract<ParseResult, { ok: true }> {
  return {
    ok: true,
    rows: rows.map((r, i) => ({ rowIndex: i + 2, ...r })),
    warnings: [],
    sourceMeta: {
      schema: 1,
      appVersion: '0.28.1',
      projectId: 'proj1',
      projectName: 'Demo',
      reforecastId: 'rf1',
      reforecastName: 'Baseline',
      generatedAt: '2026-05-01T00:00:00.000Z',
    },
  } as Extract<ParseResult, { ok: true }>;
}

/* ── computeImportDiff ─────────────────────────────────────────────── */

describe('computeImportDiff', () => {
  it('matches an existing pool member by case-insensitive name and reuses assignment id', () => {
    const existingAssignments: ProjectAssignment[] = [{ id: 'a1', poolMemberId: 'p1' }];
    const existingAllocs: MonthlyAllocation[] = [
      { memberId: 'a1', month: '2026-06', allocation: 0.5 },
    ];
    const reforecast = makeReforecast(existingAssignments, existingAllocs);
    const allocationMap: AllocationMap = buildAllocationMap(existingAllocs);

    const parseResult = makeOkParseResult([
      { name: 'ALICE', role: 'Dev', allocationsByMonth: { '2026-06': 0.5 } },
    ]);

    const diff = computeImportDiff(parseResult, reforecast, POOL, SETTINGS, allocationMap);

    expect(diff.newPoolMemberDrafts).toEqual([]);
    expect(diff.orderedAssignments).toEqual([{ id: 'a1', poolMemberId: 'p1' }]);
    expect(diff.addedCount).toBe(0);
    expect(diff.removedCount).toBe(0);
    expect(diff.allocationChangedCount).toBe(0);
  });

  it('falls back to "Unknown" when an Excel role is not in laborRates', () => {
    const reforecast = makeReforecast([], []);
    const allocationMap: AllocationMap = new Map();

    const parseResult = makeOkParseResult([
      { name: 'Carol', role: 'Designer', allocationsByMonth: { '2026-06': 1 } },
    ]);

    const diff = computeImportDiff(parseResult, reforecast, POOL, SETTINGS, allocationMap);

    expect(diff.newPoolMemberDrafts).toHaveLength(1);
    expect(diff.newPoolMemberDrafts[0].name).toBe('Carol');
    expect(diff.newPoolMemberDrafts[0].role).toBe('Unknown');
    expect(diff.newPoolMemberDrafts[0].tempId.startsWith('tmp_')).toBe(true);
    expect(diff.addedCount).toBe(1);
  });

  it('keeps the Excel role when it matches a configured labor rate', () => {
    const reforecast = makeReforecast([], []);
    const allocationMap: AllocationMap = new Map();

    const parseResult = makeOkParseResult([
      { name: 'Dave', role: 'QA', allocationsByMonth: { '2026-06': 0.25 } },
    ]);

    const diff = computeImportDiff(parseResult, reforecast, POOL, SETTINGS, allocationMap);

    expect(diff.newPoolMemberDrafts).toHaveLength(1);
    expect(diff.newPoolMemberDrafts[0].role).toBe('QA');
  });

  it('counts orphaned existing assignments toward removedCount', () => {
    // Active reforecast has Alice (p1) AND Bob (p2). Excel only re-imports Alice.
    const existingAssignments: ProjectAssignment[] = [
      { id: 'a1', poolMemberId: 'p1' },
      { id: 'a2', poolMemberId: 'p2' },
    ];
    const existingAllocs: MonthlyAllocation[] = [
      { memberId: 'a1', month: '2026-06', allocation: 0.5 },
      { memberId: 'a2', month: '2026-06', allocation: 0.5 },
    ];
    const reforecast = makeReforecast(existingAssignments, existingAllocs);
    const allocationMap: AllocationMap = buildAllocationMap(existingAllocs);

    const parseResult = makeOkParseResult([
      { name: 'Alice', role: 'Dev', allocationsByMonth: { '2026-06': 0.5 } },
    ]);

    const diff = computeImportDiff(parseResult, reforecast, POOL, SETTINGS, allocationMap);

    expect(diff.removedCount).toBe(1);
    expect(diff.addedCount).toBe(0);
  });

  it('emits new allocations only for cells with value > 0', () => {
    const reforecast = makeReforecast([{ id: 'a1', poolMemberId: 'p1' }], []);
    const allocationMap: AllocationMap = new Map();

    const parseResult = makeOkParseResult([
      {
        name: 'Alice',
        role: 'Dev',
        allocationsByMonth: { '2026-06': 0, '2026-07': 0.75, '2026-08': 0 },
      },
    ]);

    const diff = computeImportDiff(parseResult, reforecast, POOL, SETTINGS, allocationMap);

    expect(diff.newAllocations).toEqual([
      { memberId: 'a1', month: '2026-07', allocation: 0.75 },
    ]);
  });

  it('detects allocation changes against the active reforecast', () => {
    const existingAssignments: ProjectAssignment[] = [{ id: 'a1', poolMemberId: 'p1' }];
    const existingAllocs: MonthlyAllocation[] = [
      { memberId: 'a1', month: '2026-06', allocation: 0.5 },
    ];
    const reforecast = makeReforecast(existingAssignments, existingAllocs);
    const allocationMap: AllocationMap = buildAllocationMap(existingAllocs);

    // Excel raises Alice's June from 0.5 → 1.0.
    const parseResult = makeOkParseResult([
      { name: 'Alice', role: 'Dev', allocationsByMonth: { '2026-06': 1.0 } },
    ]);

    const diff = computeImportDiff(parseResult, reforecast, POOL, SETTINGS, allocationMap);

    expect(diff.allocationChangedCount).toBe(1);
  });
});

/* ── countAllocationDiffs ──────────────────────────────────────────── */

describe('countAllocationDiffs', () => {
  const ASSIGN: ProjectAssignment[] = [
    { id: 'a1', poolMemberId: 'p1' },
    { id: 'a2', poolMemberId: 'p2' },
  ];
  const EMPTY_INDEX = new Map<string, ProjectAssignment>();

  it('returns 0 when before and after match exactly', () => {
    const allocs: MonthlyAllocation[] = [
      { memberId: 'a1', month: '2026-06', allocation: 0.5 },
      { memberId: 'a2', month: '2026-06', allocation: 0.25 },
    ];
    const reforecast = makeReforecast(ASSIGN, allocs);

    const count = countAllocationDiffs(
      reforecast,
      buildAllocationMap(allocs),
      ASSIGN,
      allocs,
      EMPTY_INDEX,
      0,
    );

    expect(count).toBe(0);
  });

  it('counts an increased value as one change', () => {
    const before: MonthlyAllocation[] = [
      { memberId: 'a1', month: '2026-06', allocation: 0.5 },
    ];
    const after: MonthlyAllocation[] = [
      { memberId: 'a1', month: '2026-06', allocation: 1.0 },
    ];
    const reforecast = makeReforecast(ASSIGN.slice(0, 1), before);

    const count = countAllocationDiffs(
      reforecast,
      buildAllocationMap(before),
      ASSIGN.slice(0, 1),
      after,
      EMPTY_INDEX,
      0,
    );

    expect(count).toBe(1);
  });

  it('counts a removed cell (present before, absent after) as one change', () => {
    const before: MonthlyAllocation[] = [
      { memberId: 'a1', month: '2026-06', allocation: 0.5 },
    ];
    const reforecast = makeReforecast(ASSIGN.slice(0, 1), before);

    const count = countAllocationDiffs(
      reforecast,
      buildAllocationMap(before),
      ASSIGN.slice(0, 1),
      [],
      EMPTY_INDEX,
      0,
    );

    expect(count).toBe(1);
  });

  it('counts a newly added month as one change', () => {
    const before: MonthlyAllocation[] = [];
    const after: MonthlyAllocation[] = [
      { memberId: 'a1', month: '2026-07', allocation: 0.5 },
    ];
    const reforecast = makeReforecast(ASSIGN.slice(0, 1), before);

    const count = countAllocationDiffs(
      reforecast,
      buildAllocationMap(before),
      ASSIGN.slice(0, 1),
      after,
      EMPTY_INDEX,
      0,
    );

    expect(count).toBe(1);
  });

  it('does not flag a change when assignment id rotates but poolMemberId and value are stable', () => {
    // Before: p1 → a1 with 0.5 in June.
    const beforeAssignments: ProjectAssignment[] = [{ id: 'a1', poolMemberId: 'p1' }];
    const beforeAllocs: MonthlyAllocation[] = [
      { memberId: 'a1', month: '2026-06', allocation: 0.5 },
    ];
    // After: same poolMember but a fresh assignment id (a99).
    const afterAssignments: ProjectAssignment[] = [{ id: 'a99', poolMemberId: 'p1' }];
    const afterAllocs: MonthlyAllocation[] = [
      { memberId: 'a99', month: '2026-06', allocation: 0.5 },
    ];
    const reforecast = makeReforecast(beforeAssignments, beforeAllocs);

    const count = countAllocationDiffs(
      reforecast,
      buildAllocationMap(beforeAllocs),
      afterAssignments,
      afterAllocs,
      EMPTY_INDEX,
      0,
    );

    expect(count).toBe(0);
  });
});
