// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { createBaselineReforecast, createNewReforecast } from '../reforecast';
import type { Reforecast } from '@/types/domain';

const PROJECT_START = '2026-06-15';
const PROJECT_END = '2027-06-30';

describe('createBaselineReforecast', () => {
  it('creates a Baseline reforecast with correct defaults', () => {
    const rf = createBaselineReforecast(PROJECT_START, PROJECT_END);
    expect(rf.name).toBe('Baseline');
    expect(rf.startDate).toBe('2026-06-15');
    expect(rf.endDate).toBe('2027-06-30');
    expect(rf.allocations).toEqual([]);
    expect(rf.productivityWindows).toEqual([]);
    expect(rf.actualCost).toBe(0);
    expect(rf.baselineBudget).toBe(0);
    expect(rf.id).toBeTruthy();
    expect(rf.createdAt).toBeTruthy();
    expect(rf.reforecastDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('accepts baselineBudget parameter', () => {
    const rf = createBaselineReforecast(PROJECT_START, PROJECT_END, 500000);
    expect(rf.baselineBudget).toBe(500000);
  });

  it('defaults baselineBudget to 0 when omitted', () => {
    const rf = createBaselineReforecast(PROJECT_START, PROJECT_END);
    expect(rf.baselineBudget).toBe(0);
  });

  it('sets reforecastDate to today in YYYY-MM-DD format', () => {
    const rf = createBaselineReforecast(PROJECT_START, PROJECT_END);
    const today = new Date().toISOString().slice(0, 10);
    expect(rf.reforecastDate).toBe(today);
  });

  it('preserves YYYY-MM-DD startDate verbatim (v0.29.0 — no slicing)', () => {
    expect(createBaselineReforecast('2027-03-20', '2027-12-31').startDate).toBe('2027-03-20');
    expect(createBaselineReforecast('2026-12-01', '2027-12-31').startDate).toBe('2026-12-01');
  });

  it('generates unique IDs across calls', () => {
    const rf1 = createBaselineReforecast(PROJECT_START, PROJECT_END);
    const rf2 = createBaselineReforecast(PROJECT_START, PROJECT_END);
    expect(rf1.id).not.toBe(rf2.id);
  });
});

const sourceBase = (overrides: Partial<Reforecast> = {}): Reforecast => ({
  id: 'src',
  name: 'Baseline',
  createdAt: '2026-06-01T00:00:00Z',
  startDate: '2026-06-15',
  endDate: '2027-06-30',
  reforecastDate: '2026-06-01',
  allocations: [],
  assignments: [],
  productivityWindows: [],
  actualCost: 0,
  baselineBudget: 0,
  ...overrides,
});

describe('createNewReforecast', () => {
  it('creates an empty reforecast when no source is provided', () => {
    const rf = createNewReforecast('Q3 Reforecast', PROJECT_START, PROJECT_END);
    expect(rf.name).toBe('Q3 Reforecast');
    expect(rf.startDate).toBe('2026-06-15');
    expect(rf.endDate).toBe('2027-06-30');
    expect(rf.allocations).toEqual([]);
    expect(rf.productivityWindows).toEqual([]);
    expect(rf.actualCost).toBe(0);
    expect(rf.baselineBudget).toBe(0);
    expect(rf.reforecastDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('copies startDate and endDate from source when source is provided', () => {
    const source = sourceBase({ startDate: '2026-08-01', endDate: '2027-01-31' });
    const rf = createNewReforecast('Copy', PROJECT_START, PROJECT_END, source);
    expect(rf.startDate).toBe('2026-08-01');
    expect(rf.endDate).toBe('2027-01-31');
  });

  it('copies allocations from source reforecast', () => {
    const source = sourceBase({
      allocations: [
        { memberId: 'a1', month: '2026-06', allocation: 0.5 },
        { memberId: 'a2', month: '2026-07', allocation: 0.8 },
      ],
      productivityWindows: [
        { id: 'pw1', startDate: '2026-12-01', endDate: '2026-12-31', factor: 0.5 },
      ],
      actualCost: 75000,
      baselineBudget: 500000,
    });

    const rf = createNewReforecast('Copy', PROJECT_START, PROJECT_END, source);
    expect(rf.allocations).toHaveLength(2);
    expect(rf.allocations[0]).toEqual(source.allocations[0]);
    expect(rf.productivityWindows).toHaveLength(1);
    expect(rf.productivityWindows[0].factor).toBe(0.5);
    expect(rf.actualCost).toBe(75000);
    expect(rf.baselineBudget).toBe(500000);
  });

  it('copies baselineBudget from source reforecast', () => {
    const source = sourceBase({ baselineBudget: 750000 });
    const rf = createNewReforecast('Reforecast 2', PROJECT_START, PROJECT_END, source);
    expect(rf.baselineBudget).toBe(750000);
  });

  it('sets reforecastDate to today (not source date)', () => {
    const source = sourceBase({ reforecastDate: '2026-06-01' });
    const rf = createNewReforecast('Copy', PROJECT_START, PROJECT_END, source);
    const today = new Date().toISOString().slice(0, 10);
    expect(rf.reforecastDate).toBe(today);
    expect(rf.reforecastDate).not.toBe(source.reforecastDate);
  });

  it('deep-clones allocations (source is not mutated)', () => {
    const source = sourceBase({
      allocations: [{ memberId: 'a1', month: '2026-06', allocation: 0.5 }],
    });
    const rf = createNewReforecast('Copy', PROJECT_START, PROJECT_END, source);
    rf.allocations[0].allocation = 0.99;
    expect(source.allocations[0].allocation).toBe(0.5);
  });

  it('assigns new IDs to copied productivity windows', () => {
    const source = sourceBase({
      productivityWindows: [
        { id: 'pw1', startDate: '2026-12-01', endDate: '2026-12-31', factor: 0.5 },
      ],
    });
    const rf = createNewReforecast('Copy', PROJECT_START, PROJECT_END, source);
    expect(rf.productivityWindows[0].id).not.toBe('pw1');
    expect(rf.productivityWindows[0].factor).toBe(0.5);
  });

  it('generates unique IDs across calls', () => {
    const rf1 = createNewReforecast('A', PROJECT_START, PROJECT_END);
    const rf2 = createNewReforecast('B', PROJECT_START, PROJECT_END);
    expect(rf1.id).not.toBe(rf2.id);
  });

  it('defaults actualCost to 0 when source is undefined', () => {
    const rf = createNewReforecast('Fresh', PROJECT_START, PROJECT_END, undefined);
    expect(rf.actualCost).toBe(0);
  });

  it('defaults baselineBudget to 0 when source is undefined', () => {
    const rf = createNewReforecast('Fresh', PROJECT_START, PROJECT_END, undefined);
    expect(rf.baselineBudget).toBe(0);
  });

  it('copies actualsThroughDate from source reforecast', () => {
    const source = sourceBase({ actualsThroughDate: '2026-06-30' });
    const rf = createNewReforecast('Copy', PROJECT_START, PROJECT_END, source);
    expect(rf.actualsThroughDate).toBe('2026-06-30');
  });

  it('does not set actualsThroughDate when source has none', () => {
    const source = sourceBase();
    const rf = createNewReforecast('Copy', PROJECT_START, PROJECT_END, source);
    expect(rf.actualsThroughDate).toBeUndefined();
  });

  it('does not set actualsThroughDate for fresh reforecast', () => {
    const rf = createNewReforecast('Fresh', PROJECT_START, PROJECT_END);
    expect(rf.actualsThroughDate).toBeUndefined();
  });

  it('copies historicalCosts from source when present, with fresh entry objects', () => {
    const source = sourceBase({
      startDate: '2026-06-01',
      endDate: '2026-12-31',
      actualCost: 50000,
      historicalCosts: [
        { month: '2026-06', cost: 10000, hours: 80 },
        { month: '2026-07', cost: 20000, hours: 160 },
      ],
    });

    const rf = createNewReforecast('Copy', PROJECT_START, PROJECT_END, source);
    expect(rf.historicalCosts).toEqual(source.historicalCosts);
    expect(rf.historicalCosts).not.toBe(source.historicalCosts);
    expect(rf.historicalCosts![0]).not.toBe(source.historicalCosts![0]);
    expect(rf.historicalCosts![1]).not.toBe(source.historicalCosts![1]);
  });

  it('does not set historicalCosts when source has none', () => {
    const source = sourceBase();
    const rf = createNewReforecast('Copy', PROJECT_START, PROJECT_END, source);
    expect('historicalCosts' in rf).toBe(false);
  });

  it('materializes source bucket on copy when source has actualsThroughDate but no historicalCosts', () => {
    const source = sourceBase({
      name: 'March',
      startDate: '2026-03-01',
      endDate: '2026-12-31',
      createdAt: '2026-03-30T00:00:00Z',
      reforecastDate: '2026-03-30',
      actualCost: 20000,
      baselineBudget: 65000,
      actualsThroughDate: '2026-03-28',
    });

    const rf = createNewReforecast('April', PROJECT_START, PROJECT_END, source);
    expect(rf.historicalCosts).toEqual([
      { month: '2026-03', cost: 20000, hours: 0 },
    ]);
  });

  it('materializes source bucket alongside copied stored entries', () => {
    const source = sourceBase({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      createdAt: '2026-04-01T00:00:00Z',
      reforecastDate: '2026-04-01',
      actualCost: 50000,
      baselineBudget: 100000,
      actualsThroughDate: '2026-03-28',
      historicalCosts: [
        { month: '2026-01', cost: 10000, hours: 0 },
        { month: '2026-02', cost: 15000, hours: 0 },
      ],
    });

    const rf = createNewReforecast('Copy', PROJECT_START, PROJECT_END, source);
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
    const source = sourceBase({ actualsThroughDate: '2026-06-30' });
    const rf = createNewReforecast('Copy', PROJECT_START, PROJECT_END, source);
    expect('historicalCosts' in rf).toBe(false);
  });

  it('overwrites a stale source cutoff-month entry with the current effective bucket on copy', () => {
    const source = sourceBase({
      startDate: '2026-03-01',
      endDate: '2026-12-31',
      createdAt: '2026-04-01T00:00:00Z',
      reforecastDate: '2026-04-01',
      actualCost: 30000,
      baselineBudget: 65000,
      actualsThroughDate: '2026-03-28',
      historicalCosts: [{ month: '2026-03', cost: 9999, hours: 0 }],
    });

    const rf = createNewReforecast('Copy', PROJECT_START, PROJECT_END, source);
    expect(rf.historicalCosts).toEqual([{ month: '2026-03', cost: 30000, hours: 0 }]);
  });

  it('chained-copy scenario: bucket value flows correctly through Mar 7 → Mar 14 → Mar 21', () => {
    const mar7: Reforecast = sourceBase({
      id: 'mar7',
      name: 'Mar 7',
      startDate: '2026-03-01',
      endDate: '2026-12-31',
      createdAt: '2026-03-07T00:00:00Z',
      reforecastDate: '2026-03-07',
      actualCost: 5000,
      baselineBudget: 65000,
      actualsThroughDate: '2026-03-07',
    });

    const mar14 = createNewReforecast('Mar 14', PROJECT_START, PROJECT_END, mar7);
    expect(mar14.historicalCosts).toEqual([{ month: '2026-03', cost: 5000, hours: 0 }]);

    const mar14Bumped: Reforecast = { ...mar14, actualCost: 10000 };
    const mar21 = createNewReforecast('Mar 21', PROJECT_START, PROJECT_END, mar14Bumped);
    expect(mar21.historicalCosts).toEqual([{ month: '2026-03', cost: 10000, hours: 0 }]);
  });
});
