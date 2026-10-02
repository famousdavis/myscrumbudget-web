// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * v0.44.0 — weekly burn rate = what a full working week of the plan costs:
 * ETC ÷ the weeks of planned work left.
 *
 * A project manager compares a week's actual spend with the weekly burn rate,
 * so it has to be the expected cost of a WORKING week. Weeks of work are
 * counted from the same working days the ETC is computed over, each weighted
 * by its productivity factor — a holiday or a 0% window counts zero, a 50%
 * window half — and only in months the plan staffs. So with flat allocations
 * the burn rate is exactly the team's planned hourly cost × 40, holidays and
 * all, and time off entered as a holiday or as a window gives the same rate.
 *
 * HISTORY. v0.43.0 divided by calendar weeks (weekdays ÷ 5, holidays
 * included), so ETC ÷ burn rate equalled calendar time — but holiday weeks,
 * which cost nothing, dragged the rate below what a normal week costs, and a
 * $15,000 week read as over plan when the plan for that week was $16,180.
 * Before v0.43.0 it was the spreadsheet's whole-month EDATE formula.
 *
 * Fixture: one member at 100% and $100/hour (a full working week costs
 * $4,000), reforecast window Mon 2026-10-19 → Tue 2027-02-09: 82 weekdays.
 * With the holiday calendar below, 66 working days. Every expected value was
 * computed by hand from a calendar, not read back from the engine.
 *
 * Labels: [FAILS-TODAY] fails against v0.43.0 on a real assertion;
 * [REGRESSION] passes against v0.43.0 too and guards behaviour this keeps.
 */

import { describe, it, expect } from 'vitest';
import { calculateProjectMetrics } from '../index';
import type {
  Holiday,
  MonthlyAllocation,
  Project,
  ProductivityWindow,
  ProjectMetrics,
  Reforecast,
  Settings,
  TeamMember,
} from '@/types/domain';

const ALL_MONTHS = ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02'];
const DEV: TeamMember = { id: 'a1', name: 'Dev 1', role: 'Dev' };
const BA: TeamMember = { id: 'a2', name: 'BA 1', role: 'BA' };

const THANKSGIVING: Holiday = { id: 'h-tg', name: 'Thanksgiving Week', startDate: '2026-11-23', endDate: '2026-11-27' };
const CHRISTMAS: Holiday = { id: 'h-xm', name: 'Christmas Break', startDate: '2026-12-21', endDate: '2027-01-01' };
const NEW_YEARS: Holiday = { id: 'h-ny', name: "New Year's Day", startDate: '2027-01-01', endDate: '2027-01-01' };
const MLK: Holiday = { id: 'h-mlk', name: 'MLK Day', startDate: '2027-01-18', endDate: '2027-01-18' };
const HOLIDAYS = [THANKSGIVING, CHRISTMAS, NEW_YEARS, MLK];

function settingsWith(holidays: Holiday[] = []): Settings {
  return {
    discountRateAnnual: 0.03,
    laborRates: [{ role: 'Dev', hourlyRate: 100 }, { role: 'BA', hourlyRate: 75 }],
    holidays,
    trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
  };
}

function devAt(allocation: number, months: string[] = ALL_MONTHS): MonthlyAllocation[] {
  return months.map((month) => ({ memberId: 'a1', month, allocation }));
}

function projectWith(overrides: Partial<Reforecast> = {}): Project {
  const rf: Reforecast = {
    id: 'rf1',
    name: 'Baseline',
    createdAt: '2026-10-02T00:00:00Z',
    startDate: '2026-10-19',
    endDate: '2027-02-09',
    reforecastDate: '2026-10-02',
    assignments: [{ id: 'a1', poolMemberId: 'pm1' }, { id: 'a2', poolMemberId: 'pm2' }],
    allocations: devAt(1),
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

function run(project: Project, holidays: Holiday[] = []): ProjectMetrics {
  return calculateProjectMetrics(project, settingsWith(holidays), [DEV, BA]);
}

describe('weekly burn rate — the cost of a full working week of the plan', () => {
  it('[REGRESSION] one full-time person at $100/hour burns exactly $4,000 a week', () => {
    const metrics = run(projectWith());
    expect(metrics.etc, 'precondition: 82 working days × $800').toBeCloseTo(65_600, 6);
    expect(metrics.weeklyBurnRate).toBeCloseTo(4_000, 6);
  });

  it('[FAILS-TODAY] holidays lower the ETC but not the cost of a working week', () => {
    // 66 working days: ETC 528 h × $100 = $52,800 over 13.2 weeks of work.
    // v0.43.0 spread it over 16.4 calendar weeks: $3,219.51.
    const metrics = run(projectWith(), HOLIDAYS);
    expect(metrics.etc, 'precondition: 528 working hours').toBeCloseTo(52_800, 6);
    expect(metrics.weeklyBurnRate).toBeCloseTo(4_000, 6);
    expect(metrics.etc / metrics.weeklyBurnRate, 'ETC ÷ burn rate = weeks of work left').toBeCloseTo(13.2, 9);
  });

  it('[FAILS-TODAY] time off entered as a 0% productivity window gives the same rate as a holiday', () => {
    const windows: ProductivityWindow[] = [
      { id: 'w-tg', startDate: '2026-11-23', endDate: '2026-11-27', factor: 0 },
      { id: 'w-xm', startDate: '2026-12-21', endDate: '2027-01-01', factor: 0 },
    ];
    const metrics = run(projectWith({ productivityWindows: windows }), [NEW_YEARS, MLK]);
    expect(metrics.etc, 'precondition: same 528 hours as the holiday entry').toBeCloseTo(52_800, 6);
    expect(metrics.weeklyBurnRate).toBeCloseTo(4_000, 6);
  });

  it('[FAILS-TODAY] a 50% window counts as half a week of work, so the rate is unchanged', () => {
    // 50% on Nov 23–27, no holidays: ETC (82 − 2.5) × $800 = $63,600 over
    // 79.5 / 5 = 15.9 weeks. v0.43.0: $63,600 ÷ 16.4 = $3,878.05.
    const half: ProductivityWindow = { id: 'w', startDate: '2026-11-23', endDate: '2026-11-27', factor: 0.5 };
    const metrics = run(projectWith({ productivityWindows: [half] }));
    expect(metrics.etc, 'precondition').toBeCloseTo(63_600, 6);
    expect(metrics.weeklyBurnRate).toBeCloseTo(4_000, 6);
  });

  it('[FAILS-TODAY] months the plan does not staff are not weeks of work', () => {
    // Allocated Oct–Dec only (10 + 21 + 23 = 54 days, $43,200); the reforecast
    // runs to Feb 9. v0.43.0 counted the empty months: $43,200 ÷ 16.4 = $2,634.15.
    const metrics = run(projectWith({ allocations: devAt(1, ['2026-10', '2026-11', '2026-12']) }));
    expect(metrics.etc, 'precondition').toBeCloseTo(43_200, 6);
    expect(metrics.weeklyBurnRate).toBeCloseTo(4_000, 6);
  });

  it('[FAILS-TODAY] equals the team\'s planned hourly cost × 40, holidays included', () => {
    // Dev $100 at 100% + BA $75 at 50% = $137.50/hour → $5,500 a week.
    // ETC 528 h × $137.50 = $72,600. v0.43.0: $72,600 ÷ 16.4 = $4,426.83.
    const allocations = [
      ...devAt(1),
      ...ALL_MONTHS.map((month) => ({ memberId: 'a2', month, allocation: 0.5 })),
    ];
    const metrics = run(projectWith({ allocations }), HOLIDAYS);
    expect(metrics.etc, 'precondition').toBeCloseTo(72_600, 6);
    expect(metrics.weeklyBurnRate).toBeCloseTo(5_500, 6);
  });

  it('[REGRESSION] averages the weeks when allocations change from month to month', () => {
    // Oct–Nov at 100% ($800/day × 31 days), Dec–Feb at 50% ($400/day × 51):
    // ETC $45,200 over 82 / 5 = 16.4 weeks = $2,756.10.
    const allocations = [
      ...devAt(1, ['2026-10', '2026-11']),
      ...devAt(0.5, ['2026-12', '2027-01', '2027-02']),
    ];
    const metrics = run(projectWith({ allocations }));
    expect(metrics.etc, 'precondition').toBeCloseTo(45_200, 6);
    expect(metrics.weeklyBurnRate).toBeCloseTo(45_200 / 16.4, 6);
  });

  it('[REGRESSION] counts only the weeks after the Actuals Through cutoff', () => {
    // October at 100%, Nov–Feb at 50%, actuals through Sat Oct 31: what is left
    // is all 50% — 72 days × $400 = $28,800, exactly $2,000 a week. Counting
    // October's days as well would pull the rate below that.
    const allocations = [...devAt(1, ['2026-10']), ...devAt(0.5, ['2026-11', '2026-12', '2027-01', '2027-02'])];
    const metrics = run(projectWith({ allocations, actualsThroughDate: '2026-10-31' }));
    expect(metrics.etc, 'precondition').toBeCloseTo(28_800, 6);
    expect(metrics.weeklyBurnRate).toBeCloseTo(2_000, 6);
  });

  it('[REGRESSION] a remaining window shorter than a week is not rounded up to one', () => {
    // Actuals through Fri Feb 5: Mon Feb 8 and Tue Feb 9 remain, $1,600.
    const metrics = run(projectWith({ actualsThroughDate: '2027-02-05' }));
    expect(metrics.etc, 'precondition').toBeCloseTo(1_600, 6);
    expect(metrics.weeklyBurnRate).toBeCloseTo(4_000, 6);
  });

  it('[REGRESSION] no remaining work means a burn rate of zero, not NaN', () => {
    const metrics = run(projectWith({ actualsThroughDate: '2027-02-09' }));
    expect(metrics.etc).toBe(0);
    expect(metrics.weeklyBurnRate).toBe(0);
  });
});
