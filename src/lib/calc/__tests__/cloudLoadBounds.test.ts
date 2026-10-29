// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * v0.44.6 — the work a project document can make the calc engine do is bounded.
 *
 * A project document can be written by any member of the project, and the
 * dashboard runs `calculateProjectMetrics` for every project on the list. Before
 * this release one date string could make it walk millions of months or tens of
 * millions of days, and a document under the 1 MiB cap carrying 12,000 holidays
 * took 9.6 s. Measured on synthetic documents before the fix, one process per
 * case: end date "275760-09-13" 12.2 s · "2026-01-19999999" 5.3 s · a holiday
 * ending "2026-01-19999999" 8.2 s · 12,000 window-wide holidays 9.6 s.
 *
 * [FAILS-TODAY] tests time out against v0.44.5 (the default 5 s budget).
 * [MUST-PASS] tests are the largest legitimate shapes: they prove the bounds do
 * not change any result a real project produces.
 *
 * ⚠️ The time limits are generous on purpose (a slow CI runner must not fail
 * them); what they refuse is seconds, not milliseconds.
 */

import { describe, it, expect } from 'vitest';
import { calculateProjectMetrics } from '@/lib/calc';
import { getProductivityFactor } from '@/lib/calc/productivity';
import {
  generateMonthRange, getMonthlyWorkingDays, MONTH_RANGE_HARD_LIMIT,
} from '@/lib/utils/dates';
import { MAX_FORECAST_MONTHS } from '@/lib/constants';
import type { Holiday, Project, ProductivityWindow, Settings, TeamMember } from '@/types/domain';

const SETTINGS: Settings = {
  discountRateAnnual: 0.03,
  laborRates: [{ role: 'Dev', hourlyRate: 100 }],
  holidays: [],
  trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
};
const TEAM: TeamMember[] = [{ id: 'a1', name: 'Ada', role: 'Dev' }];

function project(
  startDate: string,
  endDate: string,
  extra: { windows?: ProductivityWindow[]; holidays?: Holiday[] } = {},
): Project {
  const allocations = generateMonthRange(startDate.slice(0, 7), endDate.slice(0, 7), 36)
    .map((month) => ({ memberId: 'a1', month, allocation: 1 }));
  const p: Project = {
    id: 'p1', name: 'P', startDate, endDate, activeReforecastId: 'rf1',
    reforecasts: [{
      id: 'rf1', name: 'Baseline', createdAt: '2026-01-01T00:00:00Z',
      startDate, endDate, reforecastDate: '2026-01-01',
      assignments: [{ id: 'a1', poolMemberId: 'pm1' }], allocations,
      productivityWindows: extra.windows ?? [], actualCost: 0, baselineBudget: 0,
    }],
  };
  if (extra.holidays) {
    p._costSnapshot = { laborRates: SETTINGS.laborRates, holidays: extra.holidays, discountRateAnnual: 0.03 };
  }
  return p;
}

function timed<T>(fn: () => T): { value: T; ms: number } {
  const t0 = performance.now();
  const value = fn();
  return { value, ms: performance.now() - t0 };
}

describe('the month span (MAX_FORECAST_MONTHS)', () => {
  it('[FAILS-TODAY] a window ending in year 275760 is calculated over 1,200 months, quickly', () => {
    // A browser's date input lets a user type a year up to 275760, and nothing in
    // the app stops it: before the fix this was 3,284,808 months and 12.2 s.
    const { value, ms } = timed(() =>
      calculateProjectMetrics(project('2026-01-01', '275760-09-13'), SETTINGS, TEAM));
    expect(value.monthlyData).toHaveLength(MAX_FORECAST_MONTHS);
    expect(ms, 'a calculation for one dashboard tile').toBeLessThan(1000);
  });

  it('[MUST-PASS] a 100-year window is calculated in full — the cap is not reached', () => {
    const { value } = timed(() =>
      calculateProjectMetrics(project('2026-01-01', '2125-12-31'), SETTINGS, TEAM));
    expect(value.monthlyData).toHaveLength(1200);
    expect(value.monthlyData[1199].month).toBe('2125-12');
  });

  it('[MUST-PASS] past the cap, the months that are shown are unchanged', () => {
    const full = calculateProjectMetrics(project('2026-01-01', '2125-12-31'), SETTINGS, TEAM);
    const longer = calculateProjectMetrics(project('2026-01-01', '2300-06-30'), SETTINGS, TEAM);
    expect(longer.monthlyData).toEqual(full.monthlyData);
    expect(longer.etc).toBe(full.etc);
  });

  it('generateMonthRange stops at its limit, and its default is above every date input', () => {
    expect(generateMonthRange('2026-01', '2099-12', 10)).toEqual(
      ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'],
    );
    // Year 1 to year 275760 (the last JavaScript date) is 3,309,120 months.
    expect(MONTH_RANGE_HARD_LIMIT).toBeGreaterThan(275760 * 12);
    expect(generateMonthRange('2026-01', '2026-12')).toHaveLength(12);
  });
});

describe('the per-month day loops', () => {
  it('[FAILS-TODAY] an end date that sorts inside a month but parses far later walks one month', () => {
    // "2026-01-19999999" sorts between "2026-01-01" and "2026-01-31" as a string
    // and parses to a date about 55,000 years later: 20 million days before.
    const { value, ms } = timed(() =>
      getMonthlyWorkingDays('2026-01', '2026-01-01', '2026-01-19999999'));
    expect(value).toHaveLength(22); // the weekdays of January 2026
    expect(value[21]).toBe('2026-01-30');
    expect(ms).toBeLessThan(200);
  });

  it('[FAILS-TODAY] a holiday with such an end date is walked for one month', () => {
    const holiday: Holiday = { id: 'h', name: 'x', startDate: '2026-01-01', endDate: '2026-01-19999999' };
    const { value, ms } = timed(() =>
      getMonthlyWorkingDays('2026-01', '2026-01-01', '2026-01-31', [holiday]));
    expect(value).toEqual([]);
    expect(ms).toBeLessThan(200);
  });

  it('[FAILS-TODAY] 12,000 window-wide holidays over ten years take milliseconds, not 9.6 s', () => {
    const holidays = Array.from({ length: 12000 }, (_, i) =>
      ({ id: `h${i}`, name: 'x', startDate: '2026-01-01', endDate: '2035-12-31' }));
    const { value, ms } = timed(() =>
      calculateProjectMetrics(project('2026-01-01', '2035-12-31', { holidays }), SETTINGS, TEAM));
    expect(value.etc).toBe(0); // every working day is a holiday
    expect(ms).toBeLessThan(1000);
  });

  it('[MUST-PASS] a holiday covering part of a month still takes off exactly those days', () => {
    const holidays: Holiday[] = [
      { id: 'h1', name: 'week', startDate: '2026-01-05', endDate: '2026-01-09' },
      { id: 'h2', name: 'weekend', startDate: '2026-01-10', endDate: '2026-01-11' },
    ];
    const days = getMonthlyWorkingDays('2026-01', '2026-01-01', '2026-01-31', holidays);
    expect(days).toHaveLength(17);
    expect(days).not.toContain('2026-01-07');
    expect(days).toContain('2026-01-12');
  });
});

describe('productivity windows', () => {
  it('[FAILS-TODAY] 11,000 windows over 100 years are applied quickly and exactly', () => {
    // About 704 KB of windows: under the 1 MiB cap. Each one checked against
    // every day of every month was 290 million comparisons.
    const windows = Array.from({ length: 11000 }, (_, i) =>
      ({ id: `w${i}`, startDate: '2026-01-01', endDate: '2125-12-31', factor: 0.5 }));
    const { value, ms } = timed(() =>
      calculateProjectMetrics(project('2026-01-01', '2125-12-31', { windows }), SETTINGS, TEAM));
    expect(value.monthlyData.every((m) => m.productivityFactor === 0.5)).toBe(true);
    expect(ms).toBeLessThan(1000);
  });

  it('[MUST-PASS] a window over the whole month and one over part of it combine per day', () => {
    const days = getMonthlyWorkingDays('2026-01', '2026-01-01', '2026-01-31');
    const windows: ProductivityWindow[] = [
      { id: 'all', startDate: '2025-12-01', endDate: '2026-02-28', factor: 0.5 },
      { id: 'week', startDate: '2026-01-05', endDate: '2026-01-09', factor: 0 },
      { id: 'other-month', startDate: '2026-03-01', endDate: '2026-03-31', factor: 0 },
    ];
    // 5 days at 0, 17 at 0.5.
    expect(getProductivityFactor(days, windows)).toBe((17 * 0.5) / 22);
  });

  it('windows whose dates are not text cover no day, and are not walked', () => {
    // Before v0.44.6 such a window was compared with every day and matched none;
    // the result is unchanged, the walk is gone.
    const windows = Array.from({ length: 11000 }, (_, i) =>
      ({ id: `w${i}`, startDate: 20260101, endDate: 21251231, factor: 0 })) as unknown as ProductivityWindow[];
    const { value, ms } = timed(() =>
      calculateProjectMetrics(project('2026-01-01', '2125-12-31', { windows }), SETTINGS, TEAM));
    expect(value.monthlyData.every((m) => m.productivityFactor === 1)).toBe(true);
    expect(ms).toBeLessThan(1000);
  });
});
