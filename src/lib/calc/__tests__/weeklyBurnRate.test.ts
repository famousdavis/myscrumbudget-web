// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * v0.43.0 — weekly burn rate = ETC ÷ the calendar weeks left in the forecast.
 *
 * Weeks are counted on the weekday grid: every Monday–Friday is one week,
 * holidays included, and a partial week counts by its weekdays (2 days = 0.4).
 * So ETC ÷ burn rate is the time remaining, said the way a project manager says
 * it — "16 weeks and 2 working days" is 16.4 — and one full-time person at
 * $100/hour burns exactly $4,000 a week.
 *
 * WHY NOT calendar days ÷ 7: a project running Monday to Friday for 16 weeks
 * spans 110 calendar days, which is 15.71 weeks, because its last weekend falls
 * after the finish date. Every Monday-start, Friday-finish project would read
 * short of the duration everyone quotes for it.
 *
 * Before this release the count was "add N months to the start date", where N
 * is the number of months carrying any cost — a formula carried over from the
 * original spreadsheet, which treats every month the project touches as a full
 * month. Mon Oct 19 → Tue Feb 9 touches five months, so it read 22 weeks.
 *
 * Expected week counts were computed independently (weekdays counted with
 * Python's `datetime`), not read back from the engine:
 *   Oct 19 2026 → Feb 9 2027   82 weekdays = 16.4 weeks
 *   Oct 19 2026 → Feb 5 2027   80 weekdays = 16.0 weeks
 *   Nov 7 2026  → Feb 5 2027   65 weekdays = 13.0 weeks
 *   Feb 6 2027  → Feb 9 2027    2 weekdays =  0.4 weeks
 *
 * Labels as in productivityWorkingDays.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { calculateProjectMetrics } from '../index';
import type { Holiday, Project, ProjectMetrics, Reforecast, Settings, TeamMember } from '@/types/domain';

const TEAM: TeamMember[] = [{ id: 'a1', name: 'Dev 1', role: 'Dev' }];
const ALL_MONTHS = ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02'];

const HOLIDAYS: Holiday[] = [
  { id: 'h-tg', name: 'Thanksgiving Week', startDate: '2026-11-23', endDate: '2026-11-27' },
  { id: 'h-xm', name: 'Christmas Break', startDate: '2026-12-21', endDate: '2027-01-01' },
  { id: 'h-ny', name: "New Year's Day", startDate: '2027-01-01', endDate: '2027-01-01' },
  { id: 'h-mlk', name: 'MLK Day', startDate: '2027-01-18', endDate: '2027-01-18' },
];

function settingsWith(holidays: Holiday[] = []): Settings {
  return {
    discountRateAnnual: 0.03,
    laborRates: [{ role: 'Dev', hourlyRate: 100 }],
    holidays,
    trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
  };
}

function projectWith(overrides: Partial<Reforecast> = {}, months: string[] = ALL_MONTHS): Project {
  const rf: Reforecast = {
    id: 'rf1',
    name: 'Baseline',
    createdAt: '2026-10-02T00:00:00Z',
    startDate: '2026-10-19',
    endDate: '2027-02-09',
    reforecastDate: '2026-10-02',
    assignments: [{ id: 'a1', poolMemberId: 'pm1' }],
    allocations: months.map((month) => ({ memberId: 'a1', month, allocation: 1 })),
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
  return calculateProjectMetrics(project, settingsWith(holidays), TEAM);
}

/** ETC ÷ burn rate: the number of weeks the burn rate was computed over. */
function weeksOf(metrics: ProjectMetrics): number {
  return metrics.etc / metrics.weeklyBurnRate;
}

describe('weekly burn rate — ETC ÷ the calendar weeks left', () => {
  it('[FAILS-TODAY] one full-time person at $100/hour burns exactly $4,000 a week', () => {
    // No holidays: 82 working days × 8 h × $100 = $65,600 over 16.4 weeks.
    // v0.42.0: $65,600 ÷ 22 ≈ $2,982.
    const metrics = run(projectWith());
    expect(metrics.etc, 'precondition: 82 working days × $800').toBeCloseTo(65_600, 6);
    expect(metrics.weeklyBurnRate).toBeCloseTo(4_000, 6);
  });

  it('[FAILS-TODAY] Mon Oct 19 → Tue Feb 9 is 16.4 weeks, not the 22 its five touched months produced', () => {
    expect(weeksOf(run(projectWith()))).toBeCloseTo(16.4, 9);
  });

  it('[FAILS-TODAY] sixteen Monday-to-Friday weeks read as exactly 16', () => {
    // Mon Oct 19 → Fri Feb 5. Calendar days ÷ 7 would give 110 / 7 = 15.71.
    expect(weeksOf(run(projectWith({ endDate: '2027-02-05' })))).toBeCloseTo(16, 9);
  });

  it('[FAILS-TODAY] holidays lower the spend but not the number of calendar weeks', () => {
    // Thanksgiving week and the Christmas break still count as weeks — they are
    // weeks on the calendar in which this project spends nothing. ETC falls to
    // 528 h × $100 = $52,800; the week count stays 16.4.
    const metrics = run(projectWith(), HOLIDAYS);
    expect(metrics.etc, 'precondition: 528 working hours').toBeCloseTo(52_800, 6);
    expect(weeksOf(metrics)).toBeCloseTo(16.4, 9);
    expect(metrics.weeklyBurnRate).toBeCloseTo(52_800 / 16.4, 6);
  });

  it('[FAILS-TODAY] with Actuals Through set, the weeks start the day after the cutoff', () => {
    // Actuals through Fri Nov 6 → forecast Sat Nov 7 → Fri Feb 5 = 65 weekdays.
    // v0.42.0 started from the cutoff date itself and counted 4 months: 17 weeks.
    const metrics = run(projectWith({ endDate: '2027-02-05', actualsThroughDate: '2026-11-06' }));
    expect(weeksOf(metrics)).toBeCloseTo(13, 9);
  });

  it('[FAILS-TODAY] weeks with no allocations still count — the whole forecast window is used', () => {
    // Allocated Oct–Dec only; the reforecast still runs to Feb 9.
    // v0.42.0 counted three cost-bearing months: 13 weeks.
    const metrics = run(projectWith({}, ['2026-10', '2026-11', '2026-12']));
    expect(weeksOf(metrics)).toBeCloseTo(16.4, 9);
  });

  it('[FAILS-TODAY] a remaining window shorter than a week is not rounded up to one', () => {
    // Actuals through Fri Feb 5 → Mon Feb 8 and Tue Feb 9 remain: 0.4 weeks.
    // v0.42.0 counted one cost-bearing month from Feb 5 — four weeks, ten times
    // the two days actually left.
    const metrics = run(projectWith({ actualsThroughDate: '2027-02-05' }));
    expect(metrics.etc, 'precondition: 2 working days × $800').toBeCloseTo(1_600, 6);
    expect(weeksOf(metrics)).toBeCloseTo(0.4, 9);
    expect(metrics.weeklyBurnRate).toBeCloseTo(4_000, 6);
  });

  it('[REGRESSION] no remaining work means a burn rate of zero, not NaN', () => {
    const metrics = run(projectWith({ actualsThroughDate: '2027-02-09' }));
    expect(metrics.etc).toBe(0);
    expect(metrics.weeklyBurnRate).toBe(0);
  });
});
