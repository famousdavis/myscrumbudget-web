// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { HistoricalCostEntry, Reforecast } from '@/types/domain';
import { generateId } from './id';
import { sumEarlierEntries } from './historicalCostsView';

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
  // Carry forward the source's historicalCosts entries (deep-cloned), then
  // materialize the source's CURRENT effective cutoff-bucket value so the
  // prior month's actuals are preserved when the user later advances the
  // cutoff. ALWAYS overwrite any pre-existing entry at the source's cutoff
  // month — that entry can only come from a prior materialization (the
  // cutoff row is never user-editable) and may be a stale snapshot from a
  // grandparent reforecast. The bucket = actualCost − strictly-earlier
  // entries is the source's authoritative effective value at copy time.
  let copiedEntries: HistoricalCostEntry[] =
    source?.historicalCosts && source.historicalCosts.length > 0
      ? source.historicalCosts.map((e) => ({ ...e }))
      : [];

  if (source?.actualsThroughDate) {
    const sourceCutoffMonth = source.actualsThroughDate.slice(0, 7);
    const projectStartMonth = projectStartDate.slice(0, 7);
    // Range guard: skip materialization when the source's cutoff is before
    // the project start (defensive — shouldn't normally occur).
    if (sourceCutoffMonth >= projectStartMonth) {
      const earlierOnly = copiedEntries.filter((e) => e.month !== sourceCutoffMonth);
      const sourceBucket = Math.max(
        0,
        source.actualCost - sumEarlierEntries(earlierOnly, sourceCutoffMonth),
      );
      copiedEntries =
        sourceBucket > 0
          ? [...earlierOnly, { month: sourceCutoffMonth, cost: sourceBucket, hours: 0 }]
          : earlierOnly;
    }
  }

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
    ...(source?.actualsThroughDate ? { actualsThroughDate: source.actualsThroughDate } : {}),
    ...(copiedEntries.length > 0 ? { historicalCosts: copiedEntries } : {}),
  };
}
