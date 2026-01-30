import type { Settings, TeamMember } from '@/types/domain';
import type { AllocationMap } from './allocationMap';

/**
 * Look up the hourly rate for a role from settings.
 * Returns 0 if the role is not found.
 */
export function getHourlyRate(role: string, settings: Settings): number {
  const rate = settings.laborRates.find(r => r.role === role);
  return rate?.hourlyRate ?? 0;
}

/**
 * Calculate a single member's monthly cost.
 *   cost = hourlyRate * availableHours * allocation * productivityFactor
 */
export function calculateMemberMonthlyCost(
  allocation: number,
  hourlyRate: number,
  availableHours: number,
  productivityFactor: number = 1,
): number {
  return hourlyRate * availableHours * allocation * productivityFactor;
}

/**
 * Calculate a single member's monthly hours.
 *   hours = availableHours * allocation * productivityFactor
 */
export function calculateMemberMonthlyHours(
  allocation: number,
  availableHours: number,
  productivityFactor: number = 1,
): number {
  return availableHours * allocation * productivityFactor;
}

/**
 * Calculate total cost for all team members in a given month.
 * Requires teamMembers for role-based rate lookups.
 */
export function calculateTotalMonthlyCost(
  month: string,
  allocationMap: AllocationMap,
  teamMembers: TeamMember[],
  settings: Settings,
  availableHours: number,
  productivityFactor: number = 1,
): number {
  const monthAllocations = allocationMap.get(month);
  if (!monthAllocations) return 0;

  let total = 0;
  for (const member of teamMembers) {
    const allocation = monthAllocations.get(member.id) ?? 0;
    if (allocation > 0) {
      const rate = getHourlyRate(member.role, settings);
      total += calculateMemberMonthlyCost(
        allocation, rate, availableHours, productivityFactor,
      );
    }
  }
  return total;
}

/**
 * Calculate total hours for all members in a given month.
 * Does NOT require teamMembers since hours are role-agnostic.
 */
export function calculateTotalMonthlyHours(
  month: string,
  allocationMap: AllocationMap,
  availableHours: number,
  productivityFactor: number = 1,
): number {
  const monthAllocations = allocationMap.get(month);
  if (!monthAllocations) return 0;

  let total = 0;
  for (const [, allocation] of monthAllocations) {
    total += calculateMemberMonthlyHours(
      allocation, availableHours, productivityFactor,
    );
  }
  return total;
}
