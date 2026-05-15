// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { HistoricalCostEntry, Reforecast } from '@/types/domain';
import { generateMonthRange } from '@/lib/utils/dates';

/**
 * Per-reforecast timeline-change impact summary.
 * Carries enough detail for the toolbar's confirmation dialog to show
 * exact "from → to" values rather than just counts.
 */
export interface TimelineChangeSummary {
  /** Allocations whose month falls outside the new range. */
  allocationsToRemove: number;
  /** historicalCosts entries whose month falls outside the new range. */
  historicalCostEntriesToRemove: number;
  /** Productivity windows that have zero overlap with the new range. */
  productivityWindowsToFlag: number;
  /** When set, the `reforecastDate` will be adjusted from → to. */
  reforecastDateAdjustment: { from: string; to: string } | null;
  /** When set, the `actualsThroughDate` will be adjusted from → to. */
  actualsThroughDateAdjustment: { from: string; to: string } | null;
}

export function summaryHasChanges(summary: TimelineChangeSummary): boolean {
  return (
    summary.allocationsToRemove > 0 ||
    summary.historicalCostEntriesToRemove > 0 ||
    summary.productivityWindowsToFlag > 0 ||
    summary.reforecastDateAdjustment !== null ||
    summary.actualsThroughDateAdjustment !== null
  );
}

/**
 * Filter historical-cost entries to those falling within [startMonth, endMonth]
 * (both inclusive, YYYY-MM strings). Pure; preserves input order.
 *
 * Exported (rather than private) because `createNewReforecast` in
 * `src/lib/utils/reforecast.ts` also needs to clip historical entries
 * to the source's window after `materializeBucketAt`.
 */
export function filterHistoricalCostsByRange(
  entries: HistoricalCostEntry[],
  startMonth: string,
  endMonth: string,
): HistoricalCostEntry[] {
  if (entries.length === 0) return entries;
  const validMonths = new Set(generateMonthRange(startMonth, endMonth));
  return entries.filter((e) => validMonths.has(e.month));
}

/**
 * Conditional forward clamp for `reforecastDate` when a reforecast's
 * start date changes.
 *
 * Rules (per D6):
 *   - If `current >= today` → return `current` (preserve forward-dated values).
 *   - If `current < newStart` → return `min(newStart, today)`.
 *   - Else → return `current`.
 *
 * `today` is an explicit parameter (no internal `Date.now()`) for testability
 * and so the toolbar can freeze `today` at dialog-open time and reuse the
 * exact same value during commit.
 */
export function computeClampedReforecastDate(
  current: string,
  newStart: string,
  today: string,
): string {
  if (current >= today) return current;
  if (current < newStart) {
    return newStart > today ? today : newStart;
  }
  return current;
}

/**
 * Counts the impact of changing one reforecast's window. Pure function —
 * accepts the NEW bounds and `today` as explicit arguments so the toolbar
 * can freeze `today` at dialog-open time (D20).
 */
export function computeSingleReforecastTimelineChangeSummary(
  rf: Reforecast,
  newStartDate: string,
  newEndDate: string,
  today: string,
): TimelineChangeSummary {
  const newStartMonth = newStartDate.slice(0, 7);
  const newEndMonth = newEndDate.slice(0, 7);
  const validMonths = new Set(generateMonthRange(newStartMonth, newEndMonth));

  let allocationsToRemove = 0;
  for (const a of rf.allocations) {
    if (!validMonths.has(a.month)) allocationsToRemove++;
  }

  let historicalCostEntriesToRemove = 0;
  for (const e of rf.historicalCosts ?? []) {
    if (!validMonths.has(e.month)) historicalCostEntriesToRemove++;
  }

  let productivityWindowsToFlag = 0;
  for (const w of rf.productivityWindows) {
    const overlaps = w.startDate <= newEndDate && w.endDate >= newStartDate;
    if (!overlaps) productivityWindowsToFlag++;
  }

  // reforecastDate adjustment fires ONLY when the start date is changing.
  // End-date-only edits never touch reforecastDate (a reforecastDate past
  // endDate is permitted per D6).
  let reforecastDateAdjustment: { from: string; to: string } | null = null;
  if (newStartDate !== rf.startDate) {
    const clamped = computeClampedReforecastDate(rf.reforecastDate, newStartDate, today);
    if (clamped !== rf.reforecastDate) {
      reforecastDateAdjustment = { from: rf.reforecastDate, to: clamped };
    }
  }

  // actualsThroughDate adjustment fires on both start and end changes when set
  // and out of range.
  let actualsThroughDateAdjustment: { from: string; to: string } | null = null;
  if (rf.actualsThroughDate !== undefined) {
    const current = rf.actualsThroughDate;
    let clamped = current;
    if (clamped < newStartDate) clamped = newStartDate;
    if (clamped > newEndDate) clamped = newEndDate;
    if (clamped !== current) {
      actualsThroughDateAdjustment = { from: current, to: clamped };
    }
  }

  return {
    allocationsToRemove,
    historicalCostEntriesToRemove,
    productivityWindowsToFlag,
    reforecastDateAdjustment,
    actualsThroughDateAdjustment,
  };
}

/**
 * Apply a window change to a single reforecast. Pure — returns a new
 * Reforecast; does not mutate input.
 *
 *   - Allocations outside the new month range are removed.
 *   - `actualsThroughDate` is clamped to [newStartDate, newEndDate] when set.
 *   - `historicalCosts` are filtered to the new month range; field removed
 *     when the result is empty (preserves optional-absent semantic).
 *   - `reforecastDate` is NOT touched (caller composes it via
 *     `computeClampedReforecastDate` when the start date is changing).
 *   - `productivityWindows` are NOT touched — flagged visually only (D9).
 */
export function applyTimelineChangeToSingleReforecast(
  rf: Reforecast,
  newStartDate: string,
  newEndDate: string,
): Reforecast {
  const newStartMonth = newStartDate.slice(0, 7);
  const newEndMonth = newEndDate.slice(0, 7);
  const validMonths = new Set(generateMonthRange(newStartMonth, newEndMonth));

  const next: Reforecast = {
    ...rf,
    startDate: newStartDate,
    endDate: newEndDate,
    allocations: rf.allocations.filter((a) => validMonths.has(a.month)),
  };

  if (rf.actualsThroughDate !== undefined) {
    let clamped = rf.actualsThroughDate;
    if (clamped < newStartDate) clamped = newStartDate;
    if (clamped > newEndDate) clamped = newEndDate;
    next.actualsThroughDate = clamped;
  }

  if (rf.historicalCosts !== undefined) {
    const filtered = filterHistoricalCostsByRange(rf.historicalCosts, newStartMonth, newEndMonth);
    if (filtered.length > 0) {
      next.historicalCosts = filtered;
    } else {
      delete next.historicalCosts;
    }
  }

  return next;
}
