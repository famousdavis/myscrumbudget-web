// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { MonthlyCalculation } from '@/types/domain';
import { countWorkdays } from '@/lib/utils/dates';

/** Weekdays in a full calendar week — the unit the weekly burn rate counts in. */
const WEEKDAYS_PER_WEEK = 5;

/**
 * Estimate to Complete: sum of all forecasted monthly costs.
 */
export function calculateETC(monthlyCosts: number[]): number {
  return monthlyCosts.reduce((sum, cost) => sum + cost, 0);
}

/**
 * Estimate at Completion: actual cost already spent + remaining forecast.
 */
export function calculateEAC(actualCost: number, etc: number): number {
  return actualCost + etc;
}

/**
 * Budget variance: positive = over budget, negative = under budget.
 */
export function calculateVariance(eac: number, baseline: number): number {
  return eac - baseline;
}

/**
 * Budget variance as a percentage of baseline.
 * Returns 0 if baseline is 0 to avoid division by zero.
 */
export function calculateVariancePercent(eac: number, baseline: number): number {
  if (baseline === 0) return 0;
  return ((eac - baseline) / baseline) * 100;
}

/**
 * Budget Performance Ratio = Baseline / EAC.
 *   > 1.0 = forecasting under budget
 *   = 1.0 = on budget
 *   < 1.0 = forecasting over budget
 *
 * NOTE: This is NOT the same as EVM CPI (EV/AC). We don't track earned value.
 */
export function calculateBudgetPerformanceRatio(
  baselineBudget: number,
  eac: number,
): number {
  if (eac === 0) return 0;
  return baselineBudget / eac;
}

/**
 * Weekly burn rate = ETC ÷ the calendar weeks from startDate to endDate.
 *
 * Weeks are counted on the weekday grid: every Monday–Friday is one week,
 * holidays included, and a partial week counts by its weekdays (2 days = 0.4).
 * So ETC ÷ burn rate is the time remaining in the form a project manager says
 * it ("16 weeks and 2 working days" = 16.4), and a full-time person at
 * $100/hour with no holidays burns exactly $4,000 a week. Holidays lower the
 * spend, never the week count: they are weeks on the calendar in which the
 * project spends nothing. No rounding and no one-week floor.
 *
 * ⚠️ NOT calendar days ÷ 7: a project running Monday to Friday for 16 weeks
 * spans 110 calendar days — 15.71 weeks — because its last weekend falls after
 * the finish date, so every Monday-start, Friday-finish project would read
 * short of the duration everyone quotes for it.
 *
 * Until v0.43.0 this was the original spreadsheet's formula,
 * ETC / ROUND(DATEDIF(start, EDATE(start, activeMonthCount), "d") / 7, 0),
 * which counts every month carrying cost as a full month: Mon Oct 19 → Tue
 * Feb 9 touches five months and read 22 weeks instead of 16.4.
 *
 * @param startDate first forecast day (YYYY-MM-DD) — the reforecast start, or
 *   the day after Actuals Through when that is later
 * @param endDate the reforecast's finish date (YYYY-MM-DD), inclusive
 */
export function calculateWeeklyBurnRate(
  etc: number,
  startDate: string,
  endDate: string,
): number {
  if (etc === 0) return 0;
  const weeks = countWorkdays(startDate, endDate) / WEEKDAYS_PER_WEEK;
  if (weeks === 0) return 0;
  return etc / weeks;
}

/**
 * Build MonthlyCalculation[] with cumulative running totals.
 */
export function generateMonthlyCalculations(
  months: string[],
  monthlyCosts: Map<string, number>,
  monthlyHours: Map<string, number>,
  monthlyProductivity: Map<string, number>,
): MonthlyCalculation[] {
  let cumulativeCost = 0;
  let cumulativeHours = 0;

  return months.map(month => {
    const cost = monthlyCosts.get(month) ?? 0;
    const hours = monthlyHours.get(month) ?? 0;
    const productivityFactor = monthlyProductivity.get(month) ?? 1;
    cumulativeCost += cost;
    cumulativeHours += hours;
    return { month, cost, hours, cumulativeCost, cumulativeHours, productivityFactor };
  });
}
