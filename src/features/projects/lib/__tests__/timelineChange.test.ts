// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import type { Reforecast } from '@/types/domain';
import {
  applyTimelineChangeToSingleReforecast,
  computeClampedReforecastDate,
  computeSingleReforecastTimelineChangeSummary,
  filterHistoricalCostsByRange,
  summaryHasChanges,
} from '../timelineChange';

const TODAY = '2026-06-15';

function makeRf(overrides: Partial<Reforecast> = {}): Reforecast {
  return {
    id: 'rf-1',
    name: 'Baseline',
    createdAt: '2026-01-01T00:00:00Z',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    reforecastDate: '2026-01-15',
    assignments: [],
    allocations: [],
    productivityWindows: [],
    actualCost: 0,
    baselineBudget: 0,
    ...overrides,
  };
}

describe('computeClampedReforecastDate', () => {
  it('returns current when current < newStart and newStart <= today', () => {
    // current 2026-01-15, newStart 2026-03-01, today 2026-06-15 → clamps to newStart
    expect(computeClampedReforecastDate('2026-01-15', '2026-03-01', TODAY)).toBe('2026-03-01');
  });

  it('returns today when current < newStart and newStart > today', () => {
    expect(computeClampedReforecastDate('2026-01-15', '2027-01-01', TODAY)).toBe(TODAY);
  });

  it('returns current when current >= newStart', () => {
    expect(computeClampedReforecastDate('2026-05-01', '2026-03-01', TODAY)).toBe('2026-05-01');
  });

  it('preserves forward-dated current when current >= today (no clamping at all)', () => {
    // current is today or later; even if current < newStart we keep it
    expect(computeClampedReforecastDate('2026-07-01', '2027-01-01', TODAY)).toBe('2026-07-01');
  });
});

describe('computeSingleReforecastTimelineChangeSummary', () => {
  it('returns no-change summary when nothing falls outside the new range', () => {
    const rf = makeRf({
      reforecastDate: '2026-03-15',
      actualsThroughDate: '2026-04-15',
      allocations: [{ memberId: 'm1', month: '2026-03', allocation: 0.5 }],
      historicalCosts: [{ month: '2026-02', cost: 1000, hours: 0 }],
    });
    const result = computeSingleReforecastTimelineChangeSummary(
      rf,
      '2026-01-01',
      '2026-12-31',
      TODAY,
    );
    expect(result).toEqual({
      allocationsToRemove: 0,
      historicalCostEntriesToRemove: 0,
      productivityWindowsToFlag: 0,
      reforecastDateAdjustment: null,
      actualsThroughDateAdjustment: null,
    });
    expect(summaryHasChanges(result)).toBe(false);
  });

  it('counts allocations outside the new range', () => {
    const rf = makeRf({
      allocations: [
        { memberId: 'm1', month: '2025-12', allocation: 0.5 },
        { memberId: 'm1', month: '2026-02', allocation: 0.5 },
        { memberId: 'm1', month: '2027-01', allocation: 0.5 },
      ],
    });
    const result = computeSingleReforecastTimelineChangeSummary(rf, '2026-01-01', '2026-12-31', TODAY);
    expect(result.allocationsToRemove).toBe(2);
  });

  it('counts historicalCosts entries outside the new range', () => {
    const rf = makeRf({
      historicalCosts: [
        { month: '2025-12', cost: 1000, hours: 0 },
        { month: '2026-02', cost: 2000, hours: 0 },
        { month: '2027-01', cost: 3000, hours: 0 },
      ],
    });
    const result = computeSingleReforecastTimelineChangeSummary(rf, '2026-01-01', '2026-12-31', TODAY);
    expect(result.historicalCostEntriesToRemove).toBe(2);
  });

  it('counts fully-out-of-range productivity windows but not partial overlaps', () => {
    const rf = makeRf({
      productivityWindows: [
        // Fully outside new range
        { id: 'pw1', startDate: '2025-06-01', endDate: '2025-09-01', factor: 0.5 },
        // Partial overlap (extends across new start)
        { id: 'pw2', startDate: '2025-12-15', endDate: '2026-02-01', factor: 0.5 },
        // Fully inside
        { id: 'pw3', startDate: '2026-05-01', endDate: '2026-07-01', factor: 0.5 },
        // Partial overlap (extends across new end)
        { id: 'pw4', startDate: '2026-12-01', endDate: '2027-03-01', factor: 0.5 },
      ],
    });
    const result = computeSingleReforecastTimelineChangeSummary(rf, '2026-01-01', '2026-12-31', TODAY);
    expect(result.productivityWindowsToFlag).toBe(1);
  });

  it('C1 regression: end-date-only edit never produces a reforecastDateAdjustment, even when legacy reforecastDate < startDate', () => {
    const rf = makeRf({
      startDate: '2026-03-01',
      reforecastDate: '2026-01-15', // legacy data: predates start
    });
    // Start unchanged; only end is changing.
    const result = computeSingleReforecastTimelineChangeSummary(rf, '2026-03-01', '2026-09-30', TODAY);
    expect(result.reforecastDateAdjustment).toBeNull();
  });

  it('C1 positive: start-date change with reforecastDate < newStart produces an adjustment', () => {
    const rf = makeRf({
      startDate: '2026-01-01',
      reforecastDate: '2026-01-15',
    });
    const result = computeSingleReforecastTimelineChangeSummary(rf, '2026-04-01', '2026-12-31', TODAY);
    expect(result.reforecastDateAdjustment).toEqual({
      from: '2026-01-15',
      to: computeClampedReforecastDate('2026-01-15', '2026-04-01', TODAY),
    });
  });

  it('actualsThroughDate adjustment fires on end-only edit when value falls past new end', () => {
    const rf = makeRf({ actualsThroughDate: '2026-12-15' });
    const result = computeSingleReforecastTimelineChangeSummary(rf, '2026-01-01', '2026-06-30', TODAY);
    expect(result.actualsThroughDateAdjustment).toEqual({
      from: '2026-12-15',
      to: '2026-06-30',
    });
  });
});

describe('applyTimelineChangeToSingleReforecast', () => {
  it('strips out-of-range allocations', () => {
    const rf = makeRf({
      allocations: [
        { memberId: 'm1', month: '2025-12', allocation: 0.5 },
        { memberId: 'm1', month: '2026-02', allocation: 0.5 },
        { memberId: 'm1', month: '2027-01', allocation: 0.5 },
      ],
    });
    const next = applyTimelineChangeToSingleReforecast(rf, '2026-01-01', '2026-12-31');
    expect(next.allocations).toEqual([
      { memberId: 'm1', month: '2026-02', allocation: 0.5 },
    ]);
  });

  it('clamps actualsThroughDate when set, leaves absent when not', () => {
    const rfWith = makeRf({ actualsThroughDate: '2026-06-15' });
    const rfWithout = makeRf({ id: 'rf-2' });
    const a = applyTimelineChangeToSingleReforecast(rfWith, '2026-01-01', '2026-04-30');
    const b = applyTimelineChangeToSingleReforecast(rfWithout, '2026-01-01', '2026-04-30');
    expect(a.actualsThroughDate).toBe('2026-04-30');
    expect(b.actualsThroughDate).toBeUndefined();
    expect('actualsThroughDate' in b).toBe(false);
  });

  it('strips out-of-range historicalCosts and removes the field when empty', () => {
    const rf = makeRf({
      historicalCosts: [
        { month: '2025-12', cost: 1000, hours: 0 },
        { month: '2027-01', cost: 3000, hours: 0 },
      ],
    });
    const next = applyTimelineChangeToSingleReforecast(rf, '2026-01-01', '2026-12-31');
    expect(next.historicalCosts).toBeUndefined();
    expect('historicalCosts' in next).toBe(false);
  });

  it('preserves in-range historicalCosts while stripping out-of-range', () => {
    const rf = makeRf({
      historicalCosts: [
        { month: '2025-12', cost: 1000, hours: 0 },
        { month: '2026-02', cost: 2000, hours: 0 },
        { month: '2026-05', cost: 3000, hours: 0 },
        { month: '2027-01', cost: 4000, hours: 0 },
      ],
    });
    const next = applyTimelineChangeToSingleReforecast(rf, '2026-01-01', '2026-12-31');
    expect(next.historicalCosts).toEqual([
      { month: '2026-02', cost: 2000, hours: 0 },
      { month: '2026-05', cost: 3000, hours: 0 },
    ]);
  });

  it('does not touch reforecastDate', () => {
    const rf = makeRf({ reforecastDate: '2025-11-01' });
    const next = applyTimelineChangeToSingleReforecast(rf, '2026-01-01', '2026-12-31');
    // Apply helper itself never adjusts reforecastDate; caller composes that.
    expect(next.reforecastDate).toBe('2025-11-01');
  });

  it('does not touch productivityWindows', () => {
    const rf = makeRf({
      productivityWindows: [
        { id: 'pw1', startDate: '2025-06-01', endDate: '2025-09-01', factor: 0.5 },
      ],
    });
    const next = applyTimelineChangeToSingleReforecast(rf, '2026-01-01', '2026-12-31');
    expect(next.productivityWindows).toEqual(rf.productivityWindows);
  });

  it('permits zero-allocation result (dialog already warned the user)', () => {
    const rf = makeRf({
      allocations: [{ memberId: 'm1', month: '2025-12', allocation: 0.5 }],
    });
    const next = applyTimelineChangeToSingleReforecast(rf, '2026-01-01', '2026-12-31');
    expect(next.allocations).toEqual([]);
  });

  it('updates startDate and endDate on the result', () => {
    const rf = makeRf();
    const next = applyTimelineChangeToSingleReforecast(rf, '2026-03-01', '2026-09-30');
    expect(next.startDate).toBe('2026-03-01');
    expect(next.endDate).toBe('2026-09-30');
  });

  it('does not mutate the input reforecast', () => {
    const rf = makeRf({
      reforecastDate: '2025-11-01',
      historicalCosts: [{ month: '2025-12', cost: 1000, hours: 0 }],
    });
    const snapshot = JSON.parse(JSON.stringify(rf));
    applyTimelineChangeToSingleReforecast(rf, '2026-01-01', '2026-12-31');
    expect(rf).toEqual(snapshot);
  });
});

describe('filterHistoricalCostsByRange', () => {
  it('keeps entries inside range, strips outside', () => {
    const entries = [
      { month: '2025-12', cost: 1, hours: 0 },
      { month: '2026-01', cost: 2, hours: 0 },
      { month: '2026-06', cost: 3, hours: 0 },
      { month: '2026-12', cost: 4, hours: 0 },
      { month: '2027-01', cost: 5, hours: 0 },
    ];
    expect(filterHistoricalCostsByRange(entries, '2026-01', '2026-12')).toEqual([
      { month: '2026-01', cost: 2, hours: 0 },
      { month: '2026-06', cost: 3, hours: 0 },
      { month: '2026-12', cost: 4, hours: 0 },
    ]);
  });

  it('returns empty for empty input', () => {
    expect(filterHistoricalCostsByRange([], '2026-01', '2026-12')).toEqual([]);
  });
});

describe('summaryHasChanges', () => {
  const empty = {
    allocationsToRemove: 0,
    historicalCostEntriesToRemove: 0,
    productivityWindowsToFlag: 0,
    reforecastDateAdjustment: null,
    actualsThroughDateAdjustment: null,
  };

  it('returns false when all five fields are zero/null', () => {
    expect(summaryHasChanges(empty)).toBe(false);
  });

  it('returns true when any field is non-zero/non-null', () => {
    expect(summaryHasChanges({ ...empty, allocationsToRemove: 1 })).toBe(true);
    expect(summaryHasChanges({ ...empty, historicalCostEntriesToRemove: 1 })).toBe(true);
    expect(summaryHasChanges({ ...empty, productivityWindowsToFlag: 1 })).toBe(true);
    expect(summaryHasChanges({ ...empty, reforecastDateAdjustment: { from: 'a', to: 'b' } })).toBe(true);
    expect(summaryHasChanges({ ...empty, actualsThroughDateAdjustment: { from: 'a', to: 'b' } })).toBe(true);
  });
});
