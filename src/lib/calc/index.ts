// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type {
  Holiday,
  Project,
  ProductivityWindow,
  ProjectMetrics,
  Reforecast,
  Settings,
  TeamMember,
} from '@/types/domain';
import { buildAllocationMap, type AllocationMap } from './allocationMap';
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

/** What planning a month needs that does not change from month to month. */
interface PlanContext {
  allocationMap: AllocationMap;
  teamMembers: TeamMember[];
  costInputs: Settings;
  holidays: Holiday[];
  windows: ProductivityWindow[];
}

/** One month of the plan over a date range. */
interface MonthPlan {
  cost: number;
  hours: number;
  /** Average productivity factor over the month's working days in range. */
  factor: number;
  /** Those working days, each weighted by its productivity factor. */
  productiveDays: number;
}

/**
 * Plan one month over [rangeStart, rangeEnd], starting no earlier than
 * etcStartDate when it is given.
 *
 * ⚠️ ONE list of working days drives the hours, the cost and the productivity
 * factor (v0.43.0). Computing them separately is how a window over a holiday
 * came to remove that time twice: the hours excluded the holiday, and the
 * factor, averaged over calendar days, removed it again. getMonthlyWorkingDays
 * honors the day component of the range, so a mid-month start produces a
 * partial first month — see D22 and CHANGELOG.
 */
function planMonth(
  month: string,
  rangeStart: string,
  rangeEnd: string,
  etcStartDate: string | undefined,
  ctx: PlanContext,
): MonthPlan {
  const workingDays = getMonthlyWorkingDays(month, rangeStart, rangeEnd, ctx.holidays, etcStartDate);
  const availableHours = workingDays.length * HOURS_PER_DAY;
  const factor = getProductivityFactor(workingDays, ctx.windows);
  return {
    cost: calculateTotalMonthlyCost(
      month, ctx.allocationMap, ctx.teamMembers, ctx.costInputs, availableHours, factor,
    ),
    hours: calculateTotalMonthlyHours(month, ctx.allocationMap, availableHours, factor),
    factor,
    productiveDays: factor * workingDays.length,
  };
}

/**
 * What the plan expected to spend from the reforecast start through
 * throughDate (clipped to the reforecast end) — the ETC's twin over the
 * elapsed part of the window, priced by the same planMonth (v0.44.0).
 */
function plannedCostThrough(
  throughDate: string,
  months: string[],
  reforecast: Reforecast,
  ctx: PlanContext,
): number {
  const end = throughDate < reforecast.endDate ? throughDate : reforecast.endDate;
  const endMonth = end.slice(0, 7);
  let total = 0;
  for (const month of months) {
    if (month > endMonth) break;
    total += planMonth(month, reforecast.startDate, end, undefined, ctx).cost;
  }
  return total;
}

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
      plannedCostToDate: null,
    };
  }

  const ctx: PlanContext = {
    allocationMap: buildAllocationMap(reforecast.allocations),
    teamMembers,
    costInputs,
    holidays: costInputs.holidays,
    windows: reforecast.productivityWindows,
  };
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
  // Weeks of work for the burn rate (v0.44.0): productive days — weighted by
  // productivity, so a holiday and a 0% window both count zero — in months the
  // plan staffs. A month nobody is allocated to is not a week of work.
  let workDays = 0;

  for (const month of months) {
    const plan = planMonth(month, reforecast.startDate, reforecast.endDate, etcStartDate, ctx);
    monthlyCostValues.push(plan.cost);
    monthlyHourValues.push(plan.hours);
    costMap.set(month, plan.cost);
    hourMap.set(month, plan.hours);
    productivityMap.set(month, plan.factor);
    if (plan.hours > 0) workDays += plan.productiveDays;
  }

  const etc = calculateETC(monthlyCostValues);
  const eac = calculateEAC(reforecast.actualCost, etc);
  const monthlyData = generateMonthlyCalculations(months, costMap, hourMap, productivityMap);

  return {
    etc,
    eac,
    variance: calculateVariance(eac, reforecast.baselineBudget),
    variancePercent: calculateVariancePercent(eac, reforecast.baselineBudget),
    budgetRatio: calculateBudgetPerformanceRatio(reforecast.baselineBudget, eac),
    weeklyBurnRate: calculateWeeklyBurnRate(etc, workDays),
    npv: calculateNPV(costInputs.discountRateAnnual, monthlyCostValues),
    totalHours: monthlyHourValues.reduce((sum, h) => sum + h, 0),
    monthlyData,
    plannedCostToDate: reforecast.actualsThroughDate
      ? plannedCostThrough(reforecast.actualsThroughDate, months, reforecast, ctx)
      : null,
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
  calculateSpendToDate,
  generateMonthlyCalculations,
} from './metrics';
export type { SpendToDate } from './metrics';
export { calculateNPV } from './npv';
export { getProductivityFactor } from './productivity';
export { getTrafficLightStatus, getTrafficLightDisplay, DEFAULT_THRESHOLDS } from './trafficLight';
