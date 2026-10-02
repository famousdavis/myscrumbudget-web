// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * v0.44.0 — spend to date: what the active reforecast's plan expected to spend
 * from its start through the Actuals Through date, beside what was actually
 * spent.
 *
 * The planned figure is computed exactly like the ETC, over the elapsed part of
 * the window instead of the remaining part: the same allocations, rates,
 * holidays and productivity windows, day by day. So a week containing a
 * holiday is expected to cost less, a 0% window equals a holiday, and planned
 * to date + ETC is always the plan's total for the reforecast.
 *
 * Every expected value was computed by hand from a calendar, not read back
 * from the engine. All tests are [FALSIFY-AFTER]: neither plannedCostToDate
 * nor calculateSpendToDate exists in v0.43.0.
 */

import { describe, it, expect } from 'vitest';
import { calculateProjectMetrics, calculateSpendToDate } from '../index';
import type { Holiday, Project, ProductivityWindow, Reforecast, Settings, TeamMember } from '@/types/domain';

const MONTHS = ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02'];
const DEV: TeamMember = { id: 'a1', name: 'Dev 1', role: 'Dev' };
const THANKSGIVING: Holiday = { id: 'h-tg', name: 'Thanksgiving Week', startDate: '2026-11-23', endDate: '2026-11-27' };

function settingsWith(holidays: Holiday[] = [], hourlyRate = 100): Settings {
  return {
    discountRateAnnual: 0.03,
    laborRates: [{ role: 'Dev', hourlyRate }],
    holidays,
    trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
  };
}

function projectWith(overrides: Partial<Reforecast> = {}): Project {
  const rf: Reforecast = {
    id: 'rf1',
    name: 'Baseline',
    createdAt: '2026-10-02T00:00:00Z',
    startDate: '2026-10-19',
    endDate: '2027-02-09',
    reforecastDate: '2026-10-02',
    assignments: [{ id: 'a1', poolMemberId: 'pm1' }],
    allocations: MONTHS.map((month) => ({ memberId: 'a1', month, allocation: 1 })),
    productivityWindows: [],
    actualCost: 0,
    baselineBudget: 100_000,
    ...overrides,
  };
  return {
    id: 'p1',
    name: 'Test',
    startDate: rf.startDate,
    endDate: rf.endDate,
    reforecasts: [rf],
    activeReforecastId: rf.id,
  };
}

function plannedThrough(actualsThroughDate: string | undefined, holidays: Holiday[] = [], extra: Partial<Reforecast> = {}) {
  return calculateProjectMetrics(projectWith({ actualsThroughDate, ...extra }), settingsWith(holidays), [DEV]).plannedCostToDate;
}

describe('planned cost to date', () => {
  it('[FALSIFY-AFTER] is null when no Actuals Through date is set', () => {
    expect(plannedThrough(undefined)).toBeNull();
  });

  it('[FALSIFY-AFTER] covers the working days from the reforecast start through the cutoff', () => {
    // One person at $100/hour = $800 a working day.
    expect(plannedThrough('2026-10-24'), 'through Sat Oct 24: Oct 19–23, 5 days').toBeCloseTo(4_000, 6);
    expect(plannedThrough('2026-10-31'), 'through Sat Oct 31: 10 days').toBeCloseTo(8_000, 6);
  });

  it('[FALSIFY-AFTER] expects nothing on holidays inside the elapsed period', () => {
    // Through Fri Nov 27 with Thanksgiving week off: Oct 19–30 (10 days) and
    // Nov 2–20 (15 days) = 25 days. Without the holiday it would be 30.
    expect(plannedThrough('2026-11-27', [THANKSGIVING])).toBeCloseTo(20_000, 6);
    expect(plannedThrough('2026-11-27'), 'control: no holiday').toBeCloseTo(24_000, 6);
  });

  it('[FALSIFY-AFTER] treats a 0% productivity window like a holiday', () => {
    const window: ProductivityWindow = { id: 'w', startDate: '2026-11-23', endDate: '2026-11-27', factor: 0 };
    expect(plannedThrough('2026-11-27', [], { productivityWindows: [window] })).toBeCloseTo(20_000, 6);
  });

  it('[FALSIFY-AFTER] is the whole plan when the cutoff is after the reforecast ends', () => {
    // 82 working days × $800.
    expect(plannedThrough('2027-03-31')).toBeCloseTo(65_600, 6);
  });

  it('[FALSIFY-AFTER] is zero when the cutoff is before the reforecast starts', () => {
    expect(plannedThrough('2026-10-10')).toBe(0);
  });

  it('[FALSIFY-AFTER] planned to date + ETC is the plan\'s total, wherever the cutoff falls', () => {
    // Anchored to the hand-computed total ($65,600), not just to each other:
    // a build that shifted cost between the two halves would fail here.
    const anchors: Array<[string, number]> = [
      ['2026-10-24', 4_000],
      ['2026-11-13', 16_000], // Oct 19–30 (10) + Nov 2–13 (10)
      ['2026-12-31', 43_200], // 10 + 21 + 23 days
      ['2027-02-05', 64_000], // all but Feb 8–9
    ];
    for (const [cutoff, planned] of anchors) {
      const metrics = calculateProjectMetrics(projectWith({ actualsThroughDate: cutoff }), settingsWith(), [DEV]);
      expect(metrics.plannedCostToDate, `${cutoff}: planned`).toBeCloseTo(planned, 6);
      expect(metrics.plannedCostToDate! + metrics.etc, `${cutoff}: planned + ETC`).toBeCloseTo(65_600, 6);
    }
  });

  it('[FALSIFY-AFTER] reproduces the workshop project: $16,180 a week, Week 1 and Week 2', () => {
    // A team costing $404.50/hour, the full holiday calendar, window to Feb 22.
    // 74 working days → ETC $239,464 and $16,180 a week (Baseline v2); actuals
    // through Oct 24 and Oct 31 → planned $16,180 and $32,360.
    const holidays: Holiday[] = [
      THANKSGIVING,
      { id: 'h-xm', name: 'Christmas Break', startDate: '2026-12-21', endDate: '2027-01-01' },
      { id: 'h-ny', name: "New Year's Day", startDate: '2027-01-01', endDate: '2027-01-01' },
      { id: 'h-mlk', name: 'MLK Day', startDate: '2027-01-18', endDate: '2027-01-18' },
      { id: 'h-pd', name: "Presidents' Day", startDate: '2027-02-15', endDate: '2027-02-15' },
    ];
    const settings = settingsWith(holidays, 404.5);
    const at = (actualsThroughDate?: string) =>
      calculateProjectMetrics(projectWith({ endDate: '2027-02-22', actualsThroughDate }), settings, [DEV]);

    const baseline = at(undefined);
    expect(baseline.etc, 'Baseline v2 ETC').toBeCloseTo(239_464, 6);
    expect(baseline.weeklyBurnRate, 'Baseline v2 burn rate').toBeCloseTo(16_180, 6);

    const week1 = at('2026-10-24');
    expect(week1.plannedCostToDate, 'Week 1 planned').toBeCloseTo(16_180, 6);
    expect(week1.weeklyBurnRate, 'Week 1 burn rate').toBeCloseTo(16_180, 6);

    const week2 = at('2026-10-31');
    expect(week2.plannedCostToDate, 'Week 2 planned').toBeCloseTo(32_360, 6);
    expect(week2.etc, 'Week 2 ETC').toBeCloseTo(207_104, 6);
    expect(week2.weeklyBurnRate, 'Week 2 burn rate').toBeCloseTo(16_180, 6);
  });
});

describe('calculateSpendToDate', () => {
  it('[FALSIFY-AFTER] reports spending under plan', () => {
    const s = calculateSpendToDate(30_000, 32_360);
    expect(s.status).toBe('under');
    expect(s.variance).toBeCloseTo(-2_360, 9);
    expect(s.variancePercent).toBeCloseTo((-2_360 / 32_360) * 100, 9);
  });

  it('[FALSIFY-AFTER] reports spending over plan', () => {
    const s = calculateSpendToDate(34_000, 32_360);
    expect(s.status).toBe('over');
    expect(s.variance).toBeCloseTo(1_640, 9);
  });

  it('[FALSIFY-AFTER] calls anything that rounds to $0 on plan', () => {
    expect(calculateSpendToDate(32_360.4, 32_360).status, '+$0.40').toBe('on');
    expect(calculateSpendToDate(32_359.6, 32_360).status, '−$0.40').toBe('on');
    expect(calculateSpendToDate(32_361, 32_360).status, '+$1.00').toBe('over');
  });

  it('[FALSIFY-AFTER] has no percentage when nothing was planned', () => {
    const s = calculateSpendToDate(5_000, 0);
    expect(s.status).toBe('over');
    expect(s.variancePercent).toBeNull();
  });
});
