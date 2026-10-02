// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { MonthlyCalculation } from '@/types/domain';

/** Working days in a full working week — the unit the weekly burn rate counts in. */
const WORKDAYS_PER_WEEK = 5;

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
 * Weekly burn rate = what a full working week of the plan costs:
 * ETC ÷ the weeks of planned work left.
 *
 * `workDays` is the number of full-capacity working days the ETC covers, as
 * the engine counts them: weekdays inside the remaining forecast window that
 * are not holidays, each weighted by its productivity factor (a 0% window
 * counts 0, a 50% window counts 0.5), in months the plan staffs. Divided by 5
 * that is weeks of work, so with flat allocations the burn rate is exactly the
 * team's planned hourly cost × 40 — the figure a project manager compares a
 * week's actual spend with. Time off entered as a holiday or as a 0% window
 * gives the same rate, because both count zero days.
 *
 * ⚠️ ETC ÷ burn rate is therefore WEEKS OF WORK left, not calendar time: a
 * window holding Thanksgiving week and a two-week Christmas break reads three
 * weeks shorter than its dates.
 *
 * History: v0.43.0 divided by calendar weeks (weekdays ÷ 5, holidays included),
 * which made ETC ÷ burn rate equal calendar time but dragged the rate below the
 * cost of a normal week whenever the window held holidays — so a week's actual
 * spend could read as over plan when it was under. Before v0.43.0 this was the
 * original spreadsheet's whole-month EDATE formula.
 */
export function calculateWeeklyBurnRate(etc: number, workDays: number): number {
  if (etc === 0 || workDays <= 0) return 0;
  return etc / (workDays / WORKDAYS_PER_WEEK);
}

/** Actual spend against the plan for the elapsed part of a reforecast. */
export interface SpendToDate {
  /** actual − planned: positive is over plan, negative under. */
  variance: number;
  /** variance as a percentage of planned; null when nothing was planned. */
  variancePercent: number | null;
  /** 'on' whenever the difference rounds to $0 — the app shows whole dollars. */
  status: 'under' | 'on' | 'over';
}

/**
 * Compare actual cost with the plan's cost for the same elapsed period
 * (`ProjectMetrics.plannedCostToDate`). This, not the weekly burn rate, is the
 * exact over/under check: it accounts for holiday weeks, part weeks and
 * allocations that change from month to month.
 */
export function calculateSpendToDate(actualCost: number, plannedCostToDate: number): SpendToDate {
  const variance = actualCost - plannedCostToDate;
  const rounded = Math.round(variance);
  return {
    variance,
    variancePercent: plannedCostToDate > 0 ? (variance / plannedCostToDate) * 100 : null,
    status: rounded > 0 ? 'over' : rounded < 0 ? 'under' : 'on',
  };
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
