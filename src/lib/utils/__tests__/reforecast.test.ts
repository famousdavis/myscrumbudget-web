// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { createBaselineReforecast, createNewReforecast } from '../reforecast';
import type { Reforecast } from '@/types/domain';

describe('createBaselineReforecast', () => {
  it('creates a Baseline reforecast with correct defaults', () => {
    const rf = createBaselineReforecast('2026-06-15');
    expect(rf.name).toBe('Baseline');
    expect(rf.startDate).toBe('2026-06');
    expect(rf.allocations).toEqual([]);
    expect(rf.productivityWindows).toEqual([]);
    expect(rf.actualCost).toBe(0);
    expect(rf.baselineBudget).toBe(0);
    expect(rf.id).toBeTruthy();
    expect(rf.createdAt).toBeTruthy();
    expect(rf.reforecastDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('accepts baselineBudget parameter', () => {
    const rf = createBaselineReforecast('2026-06-15', 500000);
    expect(rf.baselineBudget).toBe(500000);
  });

  it('defaults baselineBudget to 0 when omitted', () => {
    const rf = createBaselineReforecast('2026-06-15');
    expect(rf.baselineBudget).toBe(0);
  });

  it('sets reforecastDate to today in YYYY-MM-DD format', () => {
    const rf = createBaselineReforecast('2026-06-15');
    const today = new Date().toISOString().slice(0, 10);
    expect(rf.reforecastDate).toBe(today);
  });

  it('slices startDate to YYYY-MM format', () => {
    expect(createBaselineReforecast('2027-03-20').startDate).toBe('2027-03');
    expect(createBaselineReforecast('2026-12').startDate).toBe('2026-12');
  });

  it('generates unique IDs across calls', () => {
    const rf1 = createBaselineReforecast('2026-06-15');
    const rf2 = createBaselineReforecast('2026-06-15');
    expect(rf1.id).not.toBe(rf2.id);
  });
});

describe('createNewReforecast', () => {
  it('creates an empty reforecast when no source is provided', () => {
    const rf = createNewReforecast('Q3 Reforecast', '2026-06');
    expect(rf.name).toBe('Q3 Reforecast');
    expect(rf.startDate).toBe('2026-06');
    expect(rf.allocations).toEqual([]);
    expect(rf.productivityWindows).toEqual([]);
    expect(rf.actualCost).toBe(0);
    expect(rf.baselineBudget).toBe(0);
    expect(rf.reforecastDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('copies allocations from source reforecast', () => {
    const source: Reforecast = {
      id: 'src',
      name: 'Baseline',
      createdAt: '2026-06-01T00:00:00Z',
      startDate: '2026-06',
      reforecastDate: '2026-06-01',
      allocations: [
        { memberId: 'a1', month: '2026-06', allocation: 0.5 },
        { memberId: 'a2', month: '2026-07', allocation: 0.8 },
      ],
      assignments: [],
      productivityWindows: [
        { id: 'pw1', startDate: '2026-12-01', endDate: '2026-12-31', factor: 0.5 },
      ],
      actualCost: 75000,
      baselineBudget: 500000,
    };

    const rf = createNewReforecast('Copy', '2026-06', source);
    expect(rf.allocations).toHaveLength(2);
    expect(rf.allocations[0]).toEqual(source.allocations[0]);
    expect(rf.productivityWindows).toHaveLength(1);
    expect(rf.productivityWindows[0].factor).toBe(0.5);
    expect(rf.actualCost).toBe(75000);
    expect(rf.baselineBudget).toBe(500000);
  });

  it('copies baselineBudget from source reforecast', () => {
    const source: Reforecast = {
      id: 'src',
      name: 'Baseline',
      createdAt: '2026-06-01T00:00:00Z',
      startDate: '2026-06',
      reforecastDate: '2026-06-01',
      allocations: [],
      assignments: [],
      productivityWindows: [],
      actualCost: 0,
      baselineBudget: 750000,
    };

    const rf = createNewReforecast('Reforecast 2', '2026-06', source);
    expect(rf.baselineBudget).toBe(750000);
  });

  it('sets reforecastDate to today (not source date)', () => {
    const source: Reforecast = {
      id: 'src',
      name: 'Baseline',
      createdAt: '2026-06-01T00:00:00Z',
      startDate: '2026-06',
      reforecastDate: '2026-06-01',
      allocations: [],
      assignments: [],
      productivityWindows: [],
      actualCost: 0,
      baselineBudget: 0,
    };

    const rf = createNewReforecast('Copy', '2026-06', source);
    const today = new Date().toISOString().slice(0, 10);
    expect(rf.reforecastDate).toBe(today);
    expect(rf.reforecastDate).not.toBe(source.reforecastDate);
  });

  it('deep-clones allocations (source is not mutated)', () => {
    const source: Reforecast = {
      id: 'src',
      name: 'Baseline',
      createdAt: '2026-06-01T00:00:00Z',
      startDate: '2026-06',
      reforecastDate: '2026-06-01',
      allocations: [
        { memberId: 'a1', month: '2026-06', allocation: 0.5 },
      ],
      assignments: [],
      productivityWindows: [],
      actualCost: 0,
      baselineBudget: 0,
    };

    const rf = createNewReforecast('Copy', '2026-06', source);
    rf.allocations[0].allocation = 0.99;
    expect(source.allocations[0].allocation).toBe(0.5);
  });

  it('assigns new IDs to copied productivity windows', () => {
    const source: Reforecast = {
      id: 'src',
      name: 'Baseline',
      createdAt: '2026-06-01T00:00:00Z',
      startDate: '2026-06',
      reforecastDate: '2026-06-01',
      allocations: [],
      assignments: [],
      productivityWindows: [
        { id: 'pw1', startDate: '2026-12-01', endDate: '2026-12-31', factor: 0.5 },
      ],
      actualCost: 0,
      baselineBudget: 0,
    };

    const rf = createNewReforecast('Copy', '2026-06', source);
    expect(rf.productivityWindows[0].id).not.toBe('pw1');
    expect(rf.productivityWindows[0].factor).toBe(0.5);
  });

  it('generates unique IDs across calls', () => {
    const rf1 = createNewReforecast('A', '2026-06');
    const rf2 = createNewReforecast('B', '2026-06');
    expect(rf1.id).not.toBe(rf2.id);
  });

  it('defaults actualCost to 0 when source is undefined', () => {
    const rf = createNewReforecast('Fresh', '2026-06', undefined);
    expect(rf.actualCost).toBe(0);
  });

  it('defaults baselineBudget to 0 when source is undefined', () => {
    const rf = createNewReforecast('Fresh', '2026-06', undefined);
    expect(rf.baselineBudget).toBe(0);
  });

  it('copies actualsThroughDate from source reforecast', () => {
    const source: Reforecast = {
      id: 'src',
      name: 'Baseline',
      createdAt: '2026-06-01T00:00:00Z',
      startDate: '2026-06',
      reforecastDate: '2026-06-01',
      allocations: [],
      assignments: [],
      productivityWindows: [],
      actualCost: 0,
      baselineBudget: 0,
      actualsThroughDate: '2026-06-30',
    };

    const rf = createNewReforecast('Copy', '2026-06', source);
    expect(rf.actualsThroughDate).toBe('2026-06-30');
  });

  it('does not set actualsThroughDate when source has none', () => {
    const source: Reforecast = {
      id: 'src',
      name: 'Baseline',
      createdAt: '2026-06-01T00:00:00Z',
      startDate: '2026-06',
      reforecastDate: '2026-06-01',
      allocations: [],
      assignments: [],
      productivityWindows: [],
      actualCost: 0,
      baselineBudget: 0,
    };

    const rf = createNewReforecast('Copy', '2026-06', source);
    expect(rf.actualsThroughDate).toBeUndefined();
  });

  it('does not set actualsThroughDate for fresh reforecast', () => {
    const rf = createNewReforecast('Fresh', '2026-06');
    expect(rf.actualsThroughDate).toBeUndefined();
  });

  it('copies historicalCosts from source when present, with fresh entry objects', () => {
    const source: Reforecast = {
      id: 'src',
      name: 'Baseline',
      createdAt: '2026-06-01T00:00:00Z',
      startDate: '2026-06',
      reforecastDate: '2026-06-01',
      allocations: [],
      assignments: [],
      productivityWindows: [],
      actualCost: 50000,
      baselineBudget: 0,
      historicalCosts: [
        { month: '2026-06', cost: 10000, hours: 80 },
        { month: '2026-07', cost: 20000, hours: 160 },
      ],
    };

    const rf = createNewReforecast('Copy', '2026-06', source);
    expect(rf.historicalCosts).toEqual(source.historicalCosts);
    // Each entry must be a fresh object (deep clone, not shared reference)
    expect(rf.historicalCosts).not.toBe(source.historicalCosts);
    expect(rf.historicalCosts![0]).not.toBe(source.historicalCosts![0]);
    expect(rf.historicalCosts![1]).not.toBe(source.historicalCosts![1]);
  });

  it('does not set historicalCosts when source has none', () => {
    const source: Reforecast = {
      id: 'src',
      name: 'Baseline',
      createdAt: '2026-06-01T00:00:00Z',
      startDate: '2026-06',
      reforecastDate: '2026-06-01',
      allocations: [],
      assignments: [],
      productivityWindows: [],
      actualCost: 0,
      baselineBudget: 0,
    };

    const rf = createNewReforecast('Copy', '2026-06', source);
    expect('historicalCosts' in rf).toBe(false);
  });

  it('materializes source bucket on copy when source has actualsThroughDate but no historicalCosts', () => {
    // Reproduces the user-reported workflow: March reforecast (cutoff Mar 28,
    // actualCost $20k, no stored entries) is copied to create April reforecast.
    // The new copy must capture March's $20k as a stored entry so it survives
    // a subsequent cutoff advance.
    const source: Reforecast = {
      id: 'src',
      name: 'March',
      createdAt: '2026-03-30T00:00:00Z',
      startDate: '2026-03',
      reforecastDate: '2026-03-30',
      allocations: [],
      assignments: [],
      productivityWindows: [],
      actualCost: 20000,
      baselineBudget: 65000,
      actualsThroughDate: '2026-03-28',
    };

    const rf = createNewReforecast('April', '2026-03', source);
    expect(rf.historicalCosts).toEqual([
      { month: '2026-03', cost: 20000, hours: 0 },
    ]);
  });

  it('materializes source bucket alongside copied stored entries', () => {
    const source: Reforecast = {
      id: 'src',
      name: 'Baseline',
      createdAt: '2026-04-01T00:00:00Z',
      startDate: '2026-01',
      reforecastDate: '2026-04-01',
      allocations: [],
      assignments: [],
      productivityWindows: [],
      actualCost: 50000,
      baselineBudget: 100000,
      actualsThroughDate: '2026-03-28',
      historicalCosts: [
        { month: '2026-01', cost: 10000, hours: 0 },
        { month: '2026-02', cost: 15000, hours: 0 },
      ],
    };

    const rf = createNewReforecast('Copy', '2026-01', source);
    // Bucket = 50000 - (10000 + 15000) = 25000 for March
    expect(rf.historicalCosts).toHaveLength(3);
    expect(rf.historicalCosts).toEqual(
      expect.arrayContaining([
        { month: '2026-01', cost: 10000, hours: 0 },
        { month: '2026-02', cost: 15000, hours: 0 },
        { month: '2026-03', cost: 25000, hours: 0 },
      ]),
    );
  });

  it('does not materialize source bucket when source actualCost is 0', () => {
    const source: Reforecast = {
      id: 'src',
      name: 'Baseline',
      createdAt: '2026-06-01T00:00:00Z',
      startDate: '2026-06',
      reforecastDate: '2026-06-01',
      allocations: [],
      assignments: [],
      productivityWindows: [],
      actualCost: 0,
      baselineBudget: 0,
      actualsThroughDate: '2026-06-30',
    };

    const rf = createNewReforecast('Copy', '2026-06', source);
    // Bucket = 0 → no materialization → no historicalCosts field
    expect('historicalCosts' in rf).toBe(false);
  });

  it('overwrites a stale source cutoff-month entry with the current effective bucket on copy', () => {
    // Reproduces the chained-copy stale-snapshot bug: the source's stored
    // {Mar: $9999} entry is from a prior materialization (cutoff row is
    // never user-editable). The source's CURRENT effective Mar bucket is
    // $30k − sumEarlier(none) = $30k. Copy must capture $30k, not preserve
    // the stale $9999 snapshot.
    const source: Reforecast = {
      id: 'src',
      name: 'Baseline',
      createdAt: '2026-04-01T00:00:00Z',
      startDate: '2026-03',
      reforecastDate: '2026-04-01',
      allocations: [],
      assignments: [],
      productivityWindows: [],
      actualCost: 30000,
      baselineBudget: 65000,
      actualsThroughDate: '2026-03-28',
      historicalCosts: [{ month: '2026-03', cost: 9999, hours: 0 }],
    };

    const rf = createNewReforecast('Copy', '2026-03', source);
    expect(rf.historicalCosts).toEqual([{ month: '2026-03', cost: 30000, hours: 0 }]);
  });

  it('chained-copy scenario: bucket value flows correctly through Mar 7 → Mar 14 → Mar 21', () => {
    // Reproduces the user-reported chain. Each weekly copy must capture the
    // SOURCE's current effective bucket (not the source's stale stored entry).
    const mar7: Reforecast = {
      id: 'mar7',
      name: 'Mar 7',
      createdAt: '2026-03-07T00:00:00Z',
      startDate: '2026-03',
      reforecastDate: '2026-03-07',
      allocations: [],
      assignments: [],
      productivityWindows: [],
      actualCost: 5000,
      baselineBudget: 65000,
      actualsThroughDate: '2026-03-07',
    };

    // Mar 14 copy from Mar 7 → captures Mar 7's $5k bucket as stored entry
    const mar14 = createNewReforecast('Mar 14', '2026-03', mar7);
    expect(mar14.historicalCosts).toEqual([{ month: '2026-03', cost: 5000, hours: 0 }]);

    // User then bumps Mar 14's actualCost to $10k. The effective bucket is
    // $10k (since the stale {Mar: $5k} entry is shadowed by the cutoff month).
    const mar14Bumped: Reforecast = { ...mar14, actualCost: 10000 };

    // Mar 21 copy from Mar 14 (after bump) → MUST capture $10k, not the
    // stale $5k from the stored entry
    const mar21 = createNewReforecast('Mar 21', '2026-03', mar14Bumped);
    expect(mar21.historicalCosts).toEqual([{ month: '2026-03', cost: 10000, hours: 0 }]);
  });
});
