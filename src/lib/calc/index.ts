// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Project, Settings, TeamMember, ProjectMetrics } from '@/types/domain';
import { buildAllocationMap } from './allocationMap';
import { calculateTotalMonthlyCost, calculateTotalMonthlyHours } from './costs';
import {
  calculateETC,
  calculateEAC,
  calculateVariance,
  calculateVariancePercent,
  calculateBudgetPerformanceRatio,
  calculateWeeklyBurnRate,
  generateMonthlyCalculations,
} from './metrics';
import { calculateNPV } from './npv';
import { getProductivityFactor } from './productivity';
import { generateMonthRange, getMonthlyWorkHours, getEtcStartDate } from '@/lib/utils/dates';
import { getActiveReforecast } from '@/lib/utils/teamResolution';

/**
 * Calculate all project metrics from a project and its settings.
 *
 * This is the main entry point for the calculation engine.
 * It uses the active reforecast's allocations and productivity windows.
 */
export function calculateProjectMetrics(
  project: Project,
  settings: Settings,
  teamMembers: TeamMember[],
): ProjectMetrics {
  const reforecast = getActiveReforecast(project);

  if (!reforecast) {
    // Safety fallback — should not happen in v0.7.0+ since every project
    // has at least one reforecast, but retained as a guard.
    return {
      etc: 0,
      eac: 0,
      variance: 0,
      variancePercent: 0,
      budgetRatio: 0,
      weeklyBurnRate: 0,
      npv: 0,
      totalHours: 0,
      monthlyData: [],
    };
  }

  const allocationMap = buildAllocationMap(reforecast.allocations);
  // v0.29.0: the active reforecast's window drives the calc engine. Project
  // dates remain available for display/header purposes but no longer drive
  // runtime calculations.
  const startMonth = reforecast.startDate.slice(0, 7);
  const endMonth = reforecast.endDate.slice(0, 7);
  const months = generateMonthRange(startMonth, endMonth);

  // Compute ETC start date from actualsThroughDate (if set)
  const etcStartDate = reforecast.actualsThroughDate
    ? getEtcStartDate(reforecast.actualsThroughDate)
    : undefined;

  const monthlyCostValues: number[] = [];
  const monthlyHourValues: number[] = [];
  const costMap = new Map<string, number>();
  const hourMap = new Map<string, number>();

  for (const month of months) {
    const factor = getProductivityFactor(month, reforecast.productivityWindows);
    // getMonthlyWorkHours honors the day component of startDate/endDate
    // (verified at dates.ts:169-184). Mid-month reforecast.startDate values
    // produce partial first-month hour totals — see D22 and CHANGELOG.
    const availableHours = getMonthlyWorkHours(
      month, reforecast.startDate, reforecast.endDate, settings.holidays, etcStartDate,
    );
    const cost = calculateTotalMonthlyCost(
      month, allocationMap, teamMembers, settings, availableHours, factor,
    );
    const hours = calculateTotalMonthlyHours(
      month, allocationMap, availableHours, factor,
    );
    monthlyCostValues.push(cost);
    monthlyHourValues.push(hours);
    costMap.set(month, cost);
    hourMap.set(month, hours);
  }

  const etc = calculateETC(monthlyCostValues);
  const eac = calculateEAC(reforecast.actualCost, etc);
  const monthlyData = generateMonthlyCalculations(months, costMap, hourMap);

  // For burn rate: use months with non-zero cost (naturally excludes
  // pre-cutoff months) and actualsThroughDate as the start when set
  const burnRateActiveMonths = months.filter(m => (costMap.get(m) ?? 0) > 0);
  const burnRateStartDate = reforecast.actualsThroughDate
    ? new Date(reforecast.actualsThroughDate)
    : new Date(reforecast.startDate);

  return {
    etc,
    eac,
    variance: calculateVariance(eac, reforecast.baselineBudget),
    variancePercent: calculateVariancePercent(eac, reforecast.baselineBudget),
    budgetRatio: calculateBudgetPerformanceRatio(reforecast.baselineBudget, eac),
    weeklyBurnRate: calculateWeeklyBurnRate(
      etc, burnRateStartDate, burnRateActiveMonths,
    ),
    npv: calculateNPV(settings.discountRateAnnual, monthlyCostValues),
    totalHours: monthlyHourValues.reduce((sum, h) => sum + h, 0),
    monthlyData,
  };
}

// Re-export all calculation functions
export { buildAllocationMap, getAllocation } from './allocationMap';
export type { AllocationMap } from './allocationMap';
export {
  getHourlyRate,
  calculateMemberMonthlyCost,
  calculateMemberMonthlyHours,
  calculateTotalMonthlyCost,
  calculateTotalMonthlyHours,
} from './costs';
export {
  calculateETC,
  calculateEAC,
  calculateVariance,
  calculateVariancePercent,
  calculateBudgetPerformanceRatio,
  calculateWeeklyBurnRate,
  getActiveMonths,
  generateMonthlyCalculations,
} from './metrics';
export { calculateNPV } from './npv';
export { getProductivityFactor } from './productivity';
export { getTrafficLightStatus, getTrafficLightDisplay, DEFAULT_THRESHOLDS } from './trafficLight';
