import type { Reforecast } from '@/types/domain';
import { generateId } from './id';

/**
 * Create a default Baseline reforecast for a new project.
 * Used by useProjects (project creation) and useReforecast (ensureReforecast fallback).
 */
export function createBaselineReforecast(
  projectStartDate: string,
  baselineBudget: number = 0,
): Reforecast {
  return {
    id: generateId(),
    name: 'Baseline',
    createdAt: new Date().toISOString(),
    startDate: projectStartDate.slice(0, 7),
    reforecastDate: new Date().toISOString().slice(0, 10),
    allocations: [],
    productivityWindows: [],
    actualCost: 0,
    baselineBudget,
  };
}

/**
 * Create a new reforecast, optionally copying data from a source reforecast.
 * Used by useReforecast hook for reforecast creation.
 *
 * baselineBudget is copied from the source (budget persists until re-baselined).
 * reforecastDate is always set to today (each reforecast is a new point in time).
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
    startDate: projectStartDate.slice(0, 7),
    reforecastDate: new Date().toISOString().slice(0, 10),
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
    baselineBudget: source ? source.baselineBudget : 0,
  };
}
