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
  getActiveMonths,
  generateMonthlyCalculations,
} from './metrics';
import { calculateNPV } from './npv';
import { getProductivityFactor } from './productivity';
import { generateMonthRange } from '@/lib/utils/dates';
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
    return {
      etc: 0,
      eac: project.actualCost,
      variance: calculateVariance(project.actualCost, project.baselineBudget),
      variancePercent: calculateVariancePercent(project.actualCost, project.baselineBudget),
      budgetRatio: calculateBudgetPerformanceRatio(project.baselineBudget, project.actualCost),
      weeklyBurnRate: 0,
      npv: 0,
      totalHours: 0,
      monthlyData: [],
    };
  }

  const allocationMap = buildAllocationMap(reforecast.allocations);
  const startMonth = project.startDate.slice(0, 7);
  const endMonth = project.endDate.slice(0, 7);
  const months = generateMonthRange(startMonth, endMonth);

  const monthlyCostValues: number[] = [];
  const monthlyHourValues: number[] = [];
  const costMap = new Map<string, number>();
  const hourMap = new Map<string, number>();

  for (const month of months) {
    const factor = getProductivityFactor(month, reforecast.productivityWindows);
    const cost = calculateTotalMonthlyCost(
      month, allocationMap, teamMembers, settings, factor,
    );
    const hours = calculateTotalMonthlyHours(
      month, allocationMap, settings, factor,
    );
    monthlyCostValues.push(cost);
    monthlyHourValues.push(hours);
    costMap.set(month, cost);
    hourMap.set(month, hours);
  }

  const etc = calculateETC(monthlyCostValues);
  const eac = calculateEAC(project.actualCost, etc);
  const activeMonths = getActiveMonths(reforecast.allocations);
  const monthlyData = generateMonthlyCalculations(months, costMap, hourMap);

  return {
    etc,
    eac,
    variance: calculateVariance(eac, project.baselineBudget),
    variancePercent: calculateVariancePercent(eac, project.baselineBudget),
    budgetRatio: calculateBudgetPerformanceRatio(project.baselineBudget, eac),
    weeklyBurnRate: calculateWeeklyBurnRate(
      etc, new Date(project.startDate), activeMonths,
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
