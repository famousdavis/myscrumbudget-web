// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import type { Reforecast } from '@/types/domain';
import {
  applyTimelineChangeToReforecasts,
  computeTimelineChangeSummary,
  summaryHasChanges,
} from '../timelineChange';

function makeRf(overrides: Partial<Reforecast> = {}): Reforecast {
  return {
    id: 'rf-1',
    name: 'Baseline',
    createdAt: '2026-01-01T00:00:00Z',
    startDate: '2026-01',
    reforecastDate: '2026-01-15',
    assignments: [],
    allocations: [],
    productivityWindows: [],
    actualCost: 0,
    baselineBudget: 0,
    ...overrides,
  };
}

describe('computeTimelineChangeSummary', () => {
  it('returns zero counts when nothing falls outside the new range', () => {
    const rf = makeRf({
      reforecastDate: '2026-03-15',
      actualsThroughDate: '2026-04-15',
      allocations: [
        { memberId: 'm1', month: '2026-02', allocation: 0.5 },
        { memberId: 'm1', month: '2026-03', allocation: 0.5 },
      ],
      historicalCosts: [{ month: '2026-02', cost: 1000, hours: 0 }],
    });
    const result = computeTimelineChangeSummary([rf], '2026-01-01', '2026-12-31');
    expect(result).toEqual({
      allocationsToRemove: 0,
      datesToAdjust: 0,
      historicalCostEntriesToStrip: 0,
    });
    expect(summaryHasChanges(result)).toBe(false);
  });

  it('counts allocations outside new range', () => {
    const rf = makeRf({
      allocations: [
        { memberId: 'm1', month: '2025-12', allocation: 0.5 }, // before
        { memberId: 'm1', month: '2026-02', allocation: 0.5 }, // in
        { memberId: 'm1', month: '2027-01', allocation: 0.5 }, // after
      ],
    });
    const result = computeTimelineChangeSummary([rf], '2026-01-01', '2026-12-31');
    expect(result.allocationsToRemove).toBe(2);
  });

  it('counts reforecastDate and actualsThroughDate adjustments separately', () => {
    const rf = makeRf({
      reforecastDate: '2025-12-15', // before new start → +1
      actualsThroughDate: '2027-01-15', // after new end → +1
    });
    const result = computeTimelineChangeSummary([rf], '2026-01-01', '2026-12-31');
    expect(result.datesToAdjust).toBe(2);
  });

  it('does not count actualsThroughDate when it is undefined', () => {
    const rf = makeRf({
      reforecastDate: '2026-03-15',
      actualsThroughDate: undefined,
    });
    const result = computeTimelineChangeSummary([rf], '2026-01-01', '2026-12-31');
    expect(result.datesToAdjust).toBe(0);
  });

  it('counts historicalCosts entries outside the new month range', () => {
    const rf = makeRf({
      historicalCosts: [
        { month: '2025-12', cost: 1000, hours: 0 }, // before
        { month: '2026-02', cost: 2000, hours: 0 }, // in
        { month: '2027-01', cost: 3000, hours: 0 }, // after
      ],
    });
    const result = computeTimelineChangeSummary([rf], '2026-01-01', '2026-12-31');
    expect(result.historicalCostEntriesToStrip).toBe(2);
  });
});

describe('applyTimelineChangeToReforecasts', () => {
  it('strips out-of-range allocations', () => {
    const rf = makeRf({
      allocations: [
        { memberId: 'm1', month: '2025-12', allocation: 0.5 },
        { memberId: 'm1', month: '2026-02', allocation: 0.5 },
        { memberId: 'm1', month: '2027-01', allocation: 0.5 },
      ],
    });
    const [next] = applyTimelineChangeToReforecasts([rf], '2026-01-01', '2026-12-31');
    expect(next.allocations).toEqual([
      { memberId: 'm1', month: '2026-02', allocation: 0.5 },
    ]);
  });

  it('clamps reforecastDate before new start to new start', () => {
    const rf = makeRf({ reforecastDate: '2025-11-01' });
    const [next] = applyTimelineChangeToReforecasts([rf], '2026-01-01', '2026-12-31');
    expect(next.reforecastDate).toBe('2026-01-01');
  });

  it('clamps reforecastDate after new end to new end', () => {
    const rf = makeRf({ reforecastDate: '2027-06-01' });
    const [next] = applyTimelineChangeToReforecasts([rf], '2026-01-01', '2026-12-31');
    expect(next.reforecastDate).toBe('2026-12-31');
  });

  it('clamps actualsThroughDate when set, and leaves it absent when not', () => {
    const rfWith = makeRf({
      reforecastDate: '2026-03-15',
      actualsThroughDate: '2026-06-15',
    });
    const rfWithout = makeRf({
      id: 'rf-2',
      reforecastDate: '2026-03-15',
    });
    const [a, b] = applyTimelineChangeToReforecasts(
      [rfWith, rfWithout],
      '2026-01-01',
      '2026-04-30',
    );
    expect(a.actualsThroughDate).toBe('2026-04-30');
    expect(b.actualsThroughDate).toBeUndefined();
    // Confirm the field is genuinely absent (not just `undefined` value),
    // matching optional-absent semantics on the domain shape.
    expect('actualsThroughDate' in b).toBe(false);
  });

  it('strips historicalCosts entries outside the new range and removes the field when empty', () => {
    const rf = makeRf({
      historicalCosts: [
        { month: '2025-12', cost: 1000, hours: 0 },
        { month: '2027-01', cost: 3000, hours: 0 },
      ],
    });
    const [next] = applyTimelineChangeToReforecasts([rf], '2026-01-01', '2026-12-31');
    expect(next.historicalCosts).toBeUndefined();
    expect('historicalCosts' in next).toBe(false);
  });

  it('preserves in-range historicalCosts entries while stripping out-of-range ones', () => {
    const rf = makeRf({
      historicalCosts: [
        { month: '2025-12', cost: 1000, hours: 0 }, // out
        { month: '2026-02', cost: 2000, hours: 0 }, // in
        { month: '2026-05', cost: 3000, hours: 0 }, // in
        { month: '2027-01', cost: 4000, hours: 0 }, // out
      ],
    });
    const [next] = applyTimelineChangeToReforecasts([rf], '2026-01-01', '2026-12-31');
    expect(next.historicalCosts).toEqual([
      { month: '2026-02', cost: 2000, hours: 0 },
      { month: '2026-05', cost: 3000, hours: 0 },
    ]);
  });

  it('end-to-end F1 scenario: tightening end date strips out-of-range entries AND clamps stale dates', () => {
    // F1 audit scenario: project originally had wide bounds, user shrinks
    // end date to 2026-04-30. After the apply:
    //   - actualsThroughDate '2026-06-15' clamps to '2026-04-30'
    //   - reforecastDate '2026-05-20' clamps to '2026-04-30'
    //   - historicalCosts '2026-07' entry is stripped (after new end)
    //   - historicalCosts '2026-05' entry is also stripped (after new end)
    //   - in-range '2026-03' entry is preserved
    const rf = makeRf({
      reforecastDate: '2026-05-20',
      actualsThroughDate: '2026-06-15',
      historicalCosts: [
        { month: '2026-03', cost: 5000, hours: 0 },
        { month: '2026-05', cost: 7000, hours: 0 },
        { month: '2026-07', cost: 9000, hours: 0 },
      ],
    });

    // Pre-apply summary check: every adjustment is counted.
    const summary = computeTimelineChangeSummary([rf], '2026-01-01', '2026-04-30');
    expect(summary.datesToAdjust).toBe(2); // both reforecastDate and actualsThroughDate
    expect(summary.historicalCostEntriesToStrip).toBe(2); // 2026-05 and 2026-07
    expect(summary.allocationsToRemove).toBe(0);

    const [next] = applyTimelineChangeToReforecasts([rf], '2026-01-01', '2026-04-30');
    expect(next.reforecastDate).toBe('2026-04-30');
    expect(next.actualsThroughDate).toBe('2026-04-30');
    expect(next.historicalCosts).toEqual([
      { month: '2026-03', cost: 5000, hours: 0 },
    ]);
  });

  it('clamping cutoff to equal new endDate produces a normal cutoff bucket (no anomaly)', () => {
    // After clamping, cutoffMonth === endMonth. Verify the resulting
    // reforecast is still well-formed (clamped date is within bounds, no
    // residual out-of-range data) so downstream display semantics work.
    const rf = makeRf({
      reforecastDate: '2026-03-15',
      actualsThroughDate: '2026-12-31', // exactly the new end after clamp
      historicalCosts: [{ month: '2026-12', cost: 5000, hours: 0 }],
    });
    const [next] = applyTimelineChangeToReforecasts([rf], '2026-01-01', '2026-12-31');
    expect(next.actualsThroughDate).toBe('2026-12-31');
    // The 2026-12 entry remains in range (Dec is within Jan–Dec 2026).
    expect(next.historicalCosts).toEqual([
      { month: '2026-12', cost: 5000, hours: 0 },
    ]);
  });

  it('does not mutate the input reforecasts array', () => {
    const rf = makeRf({
      reforecastDate: '2025-11-01',
      historicalCosts: [{ month: '2025-12', cost: 1000, hours: 0 }],
    });
    const snapshot = JSON.parse(JSON.stringify(rf));
    applyTimelineChangeToReforecasts([rf], '2026-01-01', '2026-12-31');
    expect(rf).toEqual(snapshot);
  });
});
