import type { MonthlyAllocation } from '@/types/domain';

/**
 * Pre-aggregate allocations into a nested Map for O(1) lookups.
 * Map<month, Map<memberId, allocation>>
 */
export type AllocationMap = Map<string, Map<string, number>>;

export function buildAllocationMap(
  allocations: MonthlyAllocation[]
): AllocationMap {
  const map: AllocationMap = new Map();
  for (const alloc of allocations) {
    if (!map.has(alloc.month)) {
      map.set(alloc.month, new Map());
    }
    map.get(alloc.month)!.set(alloc.memberId, alloc.allocation);
  }
  return map;
}

/**
 * Get allocation value from the map, defaulting to 0.
 */
export function getAllocation(
  map: AllocationMap,
  month: string,
  memberId: string
): number {
  return map.get(month)?.get(memberId) ?? 0;
}
