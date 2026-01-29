import type { MonthlyCalculation, MonthlyAllocation } from '@/types/domain';

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
 * Weekly burn rate = ETC / weeks in active period.
 *
 * Matches Excel formula: ETC / ROUND(DATEDIF(startDate, EDATE(startDate, activeMonthCount), "d") / 7, 0)
 *
 * The end date is calculated as startDate + activeMonths.length months (EDATE behavior),
 * NOT the end of the last active month. This matches the Excel spreadsheet formula.
 */
export function calculateWeeklyBurnRate(
  etc: number,
  startDate: Date,
  activeMonths: string[],
): number {
  if (activeMonths.length === 0 || etc === 0) return 0;

  // Match Excel EDATE: add activeMonths.length months to startDate
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + activeMonths.length);

  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay);
  const weeks = Math.max(1, Math.round(days / 7));

  return etc / weeks;
}

/**
 * Get sorted list of months that have at least one non-zero allocation.
 */
export function getActiveMonths(allocations: MonthlyAllocation[]): string[] {
  const monthsWithAllocation = new Set<string>();
  for (const alloc of allocations) {
    if (alloc.allocation > 0) {
      monthsWithAllocation.add(alloc.month);
    }
  }
  return Array.from(monthsWithAllocation).sort();
}

/**
 * Build MonthlyCalculation[] with cumulative running totals.
 */
export function generateMonthlyCalculations(
  months: string[],
  monthlyCosts: Map<string, number>,
  monthlyHours: Map<string, number>,
): MonthlyCalculation[] {
  let cumulativeCost = 0;
  let cumulativeHours = 0;

  return months.map(month => {
    const cost = monthlyCosts.get(month) ?? 0;
    const hours = monthlyHours.get(month) ?? 0;
    cumulativeCost += cost;
    cumulativeHours += hours;
    return { month, cost, hours, cumulativeCost, cumulativeHours };
  });
}
