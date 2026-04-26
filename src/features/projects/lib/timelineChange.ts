// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { HistoricalCostEntry, Reforecast } from '@/types/domain';
import { generateMonthRange } from '@/lib/utils/dates';

export interface TimelineChangeSummary {
  /** Number of monthly allocations whose month falls outside the new range. */
  allocationsToRemove: number;
  /**
   * Number of date fields (`reforecastDate` or `actualsThroughDate`)
   * across all reforecasts that need to be clamped to fit the new range.
   */
  datesToAdjust: number;
  /**
   * Number of `historicalCosts` entries whose `month` falls outside the
   * new range and will be stripped.
   */
  historicalCostEntriesToStrip: number;
}

export function summaryHasChanges(summary: TimelineChangeSummary): boolean {
  return (
    summary.allocationsToRemove > 0 ||
    summary.datesToAdjust > 0 ||
    summary.historicalCostEntriesToStrip > 0
  );
}

function clampDate(date: string, min: string, max: string): string {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

/**
 * Counts the impact of changing a project's bounds on its reforecasts.
 * Pure function — accepts the NEW bounds as explicit arguments rather
 * than reading from project (caller controls source of truth).
 *
 * Out-of-range entities counted:
 *   - `allocations` whose month is outside `[newStartMonth, newEndMonth]`
 *   - `reforecastDate` outside `[newStartDate, newEndDate]`
 *   - `actualsThroughDate` outside `[newStartDate, newEndDate]` (when set)
 *   - `historicalCosts` entries with month outside `[newStartMonth, newEndMonth]`
 */
export function computeTimelineChangeSummary(
  reforecasts: Reforecast[],
  newStartDate: string,
  newEndDate: string,
): TimelineChangeSummary {
  const newStartMonth = newStartDate.slice(0, 7);
  const newEndMonth = newEndDate.slice(0, 7);
  const validMonths = new Set(generateMonthRange(newStartMonth, newEndMonth));

  let allocationsToRemove = 0;
  let datesToAdjust = 0;
  let historicalCostEntriesToStrip = 0;

  for (const rf of reforecasts) {
    for (const a of rf.allocations) {
      if (!validMonths.has(a.month)) allocationsToRemove++;
    }

    if (rf.reforecastDate < newStartDate || rf.reforecastDate > newEndDate) {
      datesToAdjust++;
    }
    if (
      rf.actualsThroughDate !== undefined &&
      (rf.actualsThroughDate < newStartDate ||
        rf.actualsThroughDate > newEndDate)
    ) {
      datesToAdjust++;
    }

    for (const e of rf.historicalCosts ?? []) {
      if (!validMonths.has(e.month)) historicalCostEntriesToStrip++;
    }
  }

  return {
    allocationsToRemove,
    datesToAdjust,
    historicalCostEntriesToStrip,
  };
}

/**
 * Applies a timeline change to a list of reforecasts, returning a new list.
 * Pure function — does not mutate input. Accepts the NEW bounds as
 * explicit arguments so the caller controls the source of truth (avoids
 * any sequencing ambiguity around which `startDate`/`endDate` is current).
 *
 * Per reforecast:
 *   - Allocations with month outside `[newStartMonth, newEndMonth]` are removed.
 *   - `reforecastDate` is clamped to `[newStartDate, newEndDate]`.
 *   - `actualsThroughDate` is clamped to `[newStartDate, newEndDate]` if set.
 *   - `historicalCosts` entries with month outside the new range are
 *     stripped. If the resulting array is empty, the field is removed
 *     (preserving the optional-absent semantic).
 */
export function applyTimelineChangeToReforecasts(
  reforecasts: Reforecast[],
  newStartDate: string,
  newEndDate: string,
): Reforecast[] {
  const newStartMonth = newStartDate.slice(0, 7);
  const newEndMonth = newEndDate.slice(0, 7);
  const validMonths = new Set(generateMonthRange(newStartMonth, newEndMonth));

  return reforecasts.map((rf) => {
    const next: Reforecast = {
      ...rf,
      allocations: rf.allocations.filter((a) => validMonths.has(a.month)),
      reforecastDate: clampDate(rf.reforecastDate, newStartDate, newEndDate),
    };

    if (rf.actualsThroughDate !== undefined) {
      next.actualsThroughDate = clampDate(
        rf.actualsThroughDate,
        newStartDate,
        newEndDate,
      );
    }

    if (rf.historicalCosts !== undefined) {
      const filtered: HistoricalCostEntry[] = rf.historicalCosts.filter((e) =>
        validMonths.has(e.month),
      );
      if (filtered.length > 0) {
        next.historicalCosts = filtered;
      } else {
        delete next.historicalCosts;
      }
    }

    return next;
  });
}
