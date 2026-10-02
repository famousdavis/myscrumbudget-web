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
import { generateMonthRange, getMonthlyWorkingDays, getEtcStartDate } from '@/lib/utils/dates';
import { HOURS_PER_DAY } from '@/lib/constants';
import { effectiveSettings } from '@/lib/utils/costSnapshot';
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
  // v0.39.0: price from the project's own cost inputs when it carries them, so
  // every collaborator on a shared project gets the same figures.
  //
  // ⚠️ RESOLVED HERE, NOT AT THE CALLERS, AND DELIBERATELY. There are two
  // callers — useProjectMetrics (the project page) and ProjectCard (the
  // dashboard tile). Resolving in either one would give two different EACs for
  // the same project on two screens. This is the single site where cost inputs
  // become concrete, which is why it is the right place.
  const costInputs = effectiveSettings(project, settings);
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
  const productivityMap = new Map<string, number>();

  for (const month of months) {
    // ⚠️ ONE list of working days drives BOTH the available hours and the
    // productivity factor (v0.43.0). Computing them separately is how a window
    // over a holiday came to remove that time twice: the hours excluded the
    // holiday, and the factor, averaged over calendar days, removed it again.
    // getMonthlyWorkingDays honors the day component of startDate/endDate, so
    // mid-month reforecast.startDate values produce partial first-month totals
    // — see D22 and CHANGELOG.
    const workingDays = getMonthlyWorkingDays(
      month, reforecast.startDate, reforecast.endDate, costInputs.holidays, etcStartDate,
    );
    const availableHours = workingDays.length * HOURS_PER_DAY;
    const factor = getProductivityFactor(workingDays, reforecast.productivityWindows);
    const cost = calculateTotalMonthlyCost(
      month, allocationMap, teamMembers, costInputs, availableHours, factor,
    );
    const hours = calculateTotalMonthlyHours(
      month, allocationMap, availableHours, factor,
    );
    monthlyCostValues.push(cost);
    monthlyHourValues.push(hours);
    costMap.set(month, cost);
    hourMap.set(month, hours);
    productivityMap.set(month, factor);
  }

  const etc = calculateETC(monthlyCostValues);
  const eac = calculateEAC(reforecast.actualCost, etc);
  const monthlyData = generateMonthlyCalculations(months, costMap, hourMap, productivityMap);

  // Burn rate covers the whole remaining forecast window: from the first day
  // the ETC covers (the day after Actuals Through, when that is later than the
  // reforecast start) to the reforecast's finish date. Weeks with no
  // allocations still count — they are weeks the project runs.
  const burnRateStartDate = etcStartDate && etcStartDate > reforecast.startDate
    ? etcStartDate
    : reforecast.startDate;

  return {
    etc,
    eac,
    variance: calculateVariance(eac, reforecast.baselineBudget),
    variancePercent: calculateVariancePercent(eac, reforecast.baselineBudget),
    budgetRatio: calculateBudgetPerformanceRatio(reforecast.baselineBudget, eac),
    weeklyBurnRate: calculateWeeklyBurnRate(
      etc, burnRateStartDate, reforecast.endDate,
    ),
    npv: calculateNPV(costInputs.discountRateAnnual, monthlyCostValues),
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
  generateMonthlyCalculations,
} from './metrics';
export { calculateNPV } from './npv';
export { getProductivityFactor } from './productivity';
export { getTrafficLightStatus, getTrafficLightDisplay, DEFAULT_THRESHOLDS } from './trafficLight';
