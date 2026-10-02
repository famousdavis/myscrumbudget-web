// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * v0.43.0 — a productivity window reduces only the WORKING days it covers.
 *
 * Before this release a window was turned into one calendar-day average for
 * the whole month, and that average was multiplied into the month's working
 * hours, which already had the holidays taken out. So a 0% window over a
 * holiday removed that week a second time, a window over a weekend removed
 * hours nobody works, and a window used on its own removed too little (5 of 30
 * calendar days instead of 5 of 21 working days).
 *
 * Every expected value below was computed independently of this engine —
 * calendar arithmetic by hand, cross-checked with Python's `datetime` — never
 * read back from the code under test. One member at 100% and $100/hour, so
 * ETC = hours × 100 and each month's hours ARE one full-time person's hours.
 *
 * Reforecast window: Mon 2026-10-19 → Tue 2027-02-09. Working days with the
 * full holiday calendar (Thanksgiving week Nov 23–27, Christmas break
 * Dec 21–Jan 1, New Year's Day Jan 1, MLK Day Jan 18):
 *
 *   Oct 19–31   10 days                 80 h
 *   Nov         21 weekdays − 5 = 16    128 h
 *   Dec         23 weekdays − 9 = 14    112 h
 *   Jan         21 weekdays − 2 = 19    152 h  (Jan 1 sits in TWO holidays; it is one day)
 *   Feb 1–9      7 days                 56 h
 *   total 528 h → ETC $52,800
 *
 * Labels: [FAILS-TODAY] fails against v0.42.0 on a real assertion;
 * [REGRESSION] passes against v0.42.0 by construction and guards behaviour
 * the fix must keep; [FALSIFY-AFTER] asserts a field v0.42.0 does not have.
 */

import { describe, it, expect } from 'vitest';
import { calculateProjectMetrics } from '../index';
import type {
  Holiday,
  Project,
  ProductivityWindow,
  ProjectMetrics,
  Reforecast,
  Settings,
  TeamMember,
} from '@/types/domain';

const MONTHS = ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02'];

const TEAM: TeamMember[] = [{ id: 'a1', name: 'Dev 1', role: 'Dev' }];

const NEW_YEARS: Holiday = { id: 'h-ny', name: "New Year's Day", startDate: '2027-01-01', endDate: '2027-01-01' };
const MLK: Holiday = { id: 'h-mlk', name: 'MLK Day', startDate: '2027-01-18', endDate: '2027-01-18' };
const THANKSGIVING: Holiday = { id: 'h-tg', name: 'Thanksgiving Week', startDate: '2026-11-23', endDate: '2026-11-27' };
const CHRISTMAS: Holiday = { id: 'h-xm', name: 'Christmas Break', startDate: '2026-12-21', endDate: '2027-01-01' };

const THANKSGIVING_WINDOW: ProductivityWindow = { id: 'w-tg', startDate: '2026-11-23', endDate: '2026-11-27', factor: 0 };
const CHRISTMAS_WINDOW: ProductivityWindow = { id: 'w-xm', startDate: '2026-12-21', endDate: '2027-01-01', factor: 0 };

function settingsWith(holidays: Holiday[]): Settings {
  return {
    discountRateAnnual: 0.03,
    laborRates: [{ role: 'Dev', hourlyRate: 100 }],
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

function run(project: Project, holidays: Holiday[]): ProjectMetrics {
  return calculateProjectMetrics(project, settingsWith(holidays), TEAM);
}

function hoursFor(metrics: ProjectMetrics, month: string): number {
  const row = metrics.monthlyData.find((d) => d.month === month);
  if (!row) throw new Error(`no monthlyData row for ${month}`);
  return row.hours;
}

describe('a productivity window reduces only the working days it covers', () => {
  // The three ways a user can enter "the team is off Thanksgiving week and
  // over Christmas". Holidays-only is the CONTROL — it never involved a
  // window, so it passes against v0.42.0 too; the other two are the
  // discriminators.
  const STYLES: Array<{ label: string; holidays: Holiday[]; windows: ProductivityWindow[] }> = [
    { label: 'holidays only', holidays: [NEW_YEARS, MLK, THANKSGIVING, CHRISTMAS], windows: [] },
    { label: 'productivity windows only', holidays: [NEW_YEARS, MLK], windows: [THANKSGIVING_WINDOW, CHRISTMAS_WINDOW] },
    { label: 'both (the redundant entry)', holidays: [NEW_YEARS, MLK, THANKSGIVING, CHRISTMAS], windows: [THANKSGIVING_WINDOW, CHRISTMAS_WINDOW] },
  ];
  const EXPECTED_HOURS = [80, 128, 112, 152, 56];

  it('[FAILS-TODAY] the same weeks off give the same hours and ETC however they are entered', () => {
    for (const style of STYLES) {
      const metrics = run(projectWith({ productivityWindows: style.windows }), style.holidays);
      MONTHS.forEach((month, i) => {
        expect(hoursFor(metrics, month), `${style.label}: ${month} hours`).toBeCloseTo(EXPECTED_HOURS[i], 9);
      });
      expect(metrics.etc, `${style.label}: ETC`).toBeCloseTo(52_800, 6);
    }
  });

  it('[FAILS-TODAY] a window over a weekend changes nothing', () => {
    // Sat Nov 7 – Sun Nov 8 at 0%. No holidays: November has 21 weekdays.
    const weekendWindow: ProductivityWindow = { id: 'w', startDate: '2026-11-07', endDate: '2026-11-08', factor: 0 };
    const without = run(projectWith(), []);
    const withWindow = run(projectWith({ productivityWindows: [weekendWindow] }), []);
    expect(hoursFor(without, '2026-11'), 'precondition: 21 weekdays × 8').toBe(168);
    expect(hoursFor(withWindow, '2026-11'), 'November hours with a weekend-only window').toBeCloseTo(168, 9);
    expect(withWindow.etc, 'ETC with a weekend-only window').toBeCloseTo(without.etc, 6);
  });

  it('[FAILS-TODAY] a window used alone removes exactly the working days it covers', () => {
    // Mon Nov 23 – Fri Nov 27 at 0%, no holidays: 21 − 5 = 16 working days.
    // v0.42.0 gave 168 × 25/30 = 140.
    const metrics = run(projectWith({ productivityWindows: [THANKSGIVING_WINDOW] }), []);
    expect(hoursFor(metrics, '2026-11')).toBeCloseTo(128, 9);
  });

  it('[FAILS-TODAY] a partial factor is weighted by working days', () => {
    // 50% on 5 of November's 21 working days: (16 + 5 × 0.5) × 8 = 148.
    // v0.42.0 gave 168 × 27.5/30 = 154.
    const halfWeek: ProductivityWindow = { ...THANKSGIVING_WINDOW, factor: 0.5 };
    const metrics = run(projectWith({ productivityWindows: [halfWeek] }), []);
    expect(hoursFor(metrics, '2026-11')).toBeCloseTo(148, 9);
  });

  it('[FAILS-TODAY] overlapping windows take the lower factor on each working day', () => {
    // A: Nov 2–13 at 50%. B: Nov 9–20 at 0%. No holidays.
    //   Nov 2–6    5 days × 0.5 = 2.5
    //   Nov 9–13   5 days × min(0.5, 0) = 0
    //   Nov 16–20  5 days × 0 = 0
    //   Nov 23–27, 30   6 days × 1 = 6
    //   8.5 days × 8 = 68 h.  v0.42.0 gave 168 × 14.5/30 = 81.2.
    const a: ProductivityWindow = { id: 'a', startDate: '2026-11-02', endDate: '2026-11-13', factor: 0.5 };
    const b: ProductivityWindow = { id: 'b', startDate: '2026-11-09', endDate: '2026-11-20', factor: 0 };
    // The 0% window is listed first so "the last window wins" would give 50%
    // on Nov 9–13 — 11 days, 88 h — and be refused.
    const metrics = run(projectWith({ productivityWindows: [b, a] }), []);
    expect(hoursFor(metrics, '2026-11')).toBeCloseTo(68, 9);
  });

  it('[FAILS-TODAY] a window before the Actuals Through cutoff does not touch the forecast', () => {
    // Actuals through Fri Nov 13, so the forecast starts Mon Nov 16: Nov 16–20,
    // 23–27 and 30 are 11 working days = 88 h. The window (Nov 2–6) is entirely
    // inside the actuals. v0.42.0 gave 88 × 25/30 ≈ 73.3.
    const earlyWindow: ProductivityWindow = { id: 'w', startDate: '2026-11-02', endDate: '2026-11-06', factor: 0 };
    const metrics = run(
      projectWith({ actualsThroughDate: '2026-11-13', productivityWindows: [earlyWindow] }),
      [],
    );
    expect(hoursFor(metrics, '2026-11')).toBeCloseTo(88, 9);
  });

  it('[FAILS-TODAY] a window before the reforecast starts does not touch the first month', () => {
    // The reforecast starts Mon Oct 19 (10 working days in October). The window,
    // Oct 5–9, ends before it. v0.42.0 gave 80 × 26/31 ≈ 67.1.
    const preStart: ProductivityWindow = { id: 'w', startDate: '2026-10-05', endDate: '2026-10-09', factor: 0 };
    const metrics = run(projectWith({ productivityWindows: [preStart] }), []);
    expect(hoursFor(metrics, '2026-10')).toBeCloseTo(80, 9);
  });

  it('[REGRESSION] a window covering every working day of a month still applies in full', () => {
    // All of November at 50%, with Thanksgiving week as a holiday: 128 × 0.5.
    // Passes against v0.42.0 too — guards that the fix keeps full-month windows.
    const allNovember: ProductivityWindow = { id: 'w', startDate: '2026-11-01', endDate: '2026-11-30', factor: 0.5 };
    const metrics = run(projectWith({ productivityWindows: [allNovember] }), [THANKSGIVING]);
    expect(hoursFor(metrics, '2026-11')).toBeCloseTo(64, 9);
  });

  it('[FALSIFY-AFTER] each month reports the productivity factor the engine applied', () => {
    // The grid header displays this figure, so it must be the one the hours
    // were computed with: 16 of 21 working days for a window used alone, and
    // exactly 1 for a window that only covers holidays (it reduces nothing).
    const alone = run(projectWith({ productivityWindows: [THANKSGIVING_WINDOW] }), []);
    const redundant = run(projectWith({ productivityWindows: [THANKSGIVING_WINDOW] }), [THANKSGIVING]);
    const novAlone = alone.monthlyData.find((d) => d.month === '2026-11');
    const novRedundant = redundant.monthlyData.find((d) => d.month === '2026-11');
    expect(novAlone?.productivityFactor, 'window alone').toBeCloseTo(16 / 21, 12);
    expect(novRedundant?.productivityFactor, 'window over holidays only').toBe(1);
    expect(alone.monthlyData.find((d) => d.month === '2026-10')?.productivityFactor, 'no window').toBe(1);
  });
});
