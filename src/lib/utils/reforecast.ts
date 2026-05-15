// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { HistoricalCostEntry, Reforecast } from '@/types/domain';
import { generateId } from './id';
import { materializeBucketAt } from './historicalCostsView';
import { filterHistoricalCostsByRange } from '@/features/projects/lib/timelineChange';

/**
 * Create a default Baseline reforecast for a new project. The baseline
 * inherits the project's window verbatim. Used by useProjects (project
 * creation) and useReforecast (ensureReforecast fallback).
 */
export function createBaselineReforecast(
  projectStartDate: string,
  projectEndDate: string,
  baselineBudget: number = 0,
): Reforecast {
  return {
    id: generateId(),
    name: 'Baseline',
    createdAt: new Date().toISOString(),
    startDate: projectStartDate,
    endDate: projectEndDate,
    reforecastDate: new Date().toISOString().slice(0, 10),
    assignments: [],
    allocations: [],
    productivityWindows: [],
    actualCost: 0,
    baselineBudget,
  };
}

/**
 * Create a new reforecast, optionally copying data from a source.
 *
 * - With `source`: the new reforecast inherits the source's window
 *   (`startDate`/`endDate`), assignments (IDs preserved for allocation
 *   linkage), allocations, productivity windows (with NEW IDs),
 *   `actualCost`, `baselineBudget`, `actualsThroughDate` (when set), and
 *   historical costs (cloned + materialized at the source's cutoff, then
 *   clipped to the source's window). Notes are NOT copied (a copy starts
 *   with blank notes).
 * - Without `source`: the new reforecast inherits the project's window
 *   and is otherwise empty.
 *
 * baselineBudget is copied from the source (budget persists until re-baselined).
 * reforecastDate is always set to today (each reforecast is a new point in time).
 */
export function createNewReforecast(
  name: string,
  projectStartDate: string,
  projectEndDate: string,
  source?: Reforecast,
): Reforecast {
  const startDate = source ? source.startDate : projectStartDate;
  const endDate = source ? source.endDate : projectEndDate;

  // Carry forward the source's historicalCosts entries (deep-cloned), then
  // materialize the source's CURRENT effective cutoff-bucket value so the
  // prior month's actuals are preserved when the user later advances the
  // cutoff. ALWAYS overwrite any pre-existing entry at the source's cutoff
  // month — that entry can only come from a prior materialization (the
  // cutoff row is never user-editable) and may be a stale snapshot from a
  // grandparent reforecast. Delegated to `materializeBucketAt` for parity
  // with the cutoff-advance path.
  let copiedEntries: HistoricalCostEntry[] =
    source?.historicalCosts && source.historicalCosts.length > 0
      ? source.historicalCosts.map((e) => ({ ...e }))
      : [];

  if (source?.actualsThroughDate) {
    copiedEntries = materializeBucketAt(
      copiedEntries,
      source.actualCost,
      source.actualsThroughDate.slice(0, 7),
      source.startDate.slice(0, 7),
    );
  }

  // Clip any stale entries (materialization preserves all input entries;
  // some may pre-date the source's current start, e.g. if the source's
  // start was shrunk after the entries were captured).
  if (source && copiedEntries.length > 0) {
    copiedEntries = filterHistoricalCostsByRange(
      copiedEntries,
      source.startDate.slice(0, 7),
      source.endDate.slice(0, 7),
    );
  }

  return {
    id: generateId(),
    name,
    createdAt: new Date().toISOString(),
    startDate,
    endDate,
    reforecastDate: new Date().toISOString().slice(0, 10),
    // Preserve assignment IDs verbatim — cloned `allocations` (which key on
    // assignment.id) must continue to resolve. Reforecast independence is
    // preserved because each reforecast holds its own array.
    assignments: source ? source.assignments.map((a) => ({ ...a })) : [],
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
