import type { Reforecast } from '@/types/domain';
import { generateId } from './id';

/**
 * Create a default Baseline reforecast for a new project.
 * Used by useProjects (project creation) and useReforecast (ensureReforecast fallback).
 */
export function createBaselineReforecast(projectStartDate: string): Reforecast {
  return {
    id: generateId(),
    name: 'Baseline',
    createdAt: new Date().toISOString(),
    startDate: projectStartDate.slice(0, 7),
    allocations: [],
    productivityWindows: [],
    actualCost: 0,
  };
}

/**
 * Create a new reforecast, optionally copying data from a source reforecast.
 * Used by useReforecast hook for reforecast creation.
 */
export function createNewReforecast(
  name: string,
  projectStartDate: string,
  source?: Reforecast,
): Reforecast {
  return {
    id: generateId(),
    name,
    createdAt: new Date().toISOString(),
    startDate: projectStartDate,
    allocations: source
      ? source.allocations.map((a) => ({ ...a }))
      : [],
    productivityWindows: source
      ? source.productivityWindows.map((w) => ({
          ...w,
          id: generateId(),
        }))
      : [],
    actualCost: source ? source.actualCost : 0,
  };
}
