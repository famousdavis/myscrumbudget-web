// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { HistoricalCostEntry } from '@/types/domain';
import { generateMonthRange } from './dates';

export interface HistoricalCostsDisplayRow {
  month: string;
  cost: number;
  hours: number;
  isCutoffBucket: boolean;
}

/**
 * When advancing the cutoff to a later month, capture the prior bucket
 * value as a stored entry so the previously-derived total isn't lost.
 *
 * Returns the (possibly enriched) historicalCosts array. No-op when:
 *   - prevCutoffDate is missing
 *   - new month is not strictly later than prev month
 *   - prior bucket value is 0 (nothing to preserve)
 *   - prev cutoff month falls BEFORE the project start month (prevents
 *     out-of-range phantom entries from a brief mis-typed cutoff date,
 *     e.g. user typed Feb then corrected to March)
 *
 * If the prev cutoff month already has a stored entry, it MUST be from a
 * prior materialization (the cutoff-month row is never user-editable), so
 * it is overwritten with the current effective bucket value
 * (actualCost − sum of strictly-earlier entries) — the source of truth.
 */
export function materializeBucketOnAdvance(
  storedEntries: HistoricalCostEntry[] | undefined,
  actualCost: number,
  prevCutoffDate: string | undefined,
  newCutoffDate: string,
  projectStartDate?: string,
): HistoricalCostEntry[] {
  const stored = storedEntries ?? [];
  if (!prevCutoffDate) return stored;

  const prevMonth = prevCutoffDate.slice(0, 7);
  const newMonth = newCutoffDate.slice(0, 7);
  if (newMonth <= prevMonth) return stored;

  // Range guard: refuse to materialize at a month before the project starts.
  // This prevents phantom entries when the user briefly types an out-of-range
  // cutoff date and then corrects it.
  if (projectStartDate) {
    const startMonth = projectStartDate.slice(0, 7);
    if (prevMonth < startMonth) return stored;
  }

  // Compute the bucket from entries strictly earlier than the prev cutoff.
  // sumEarlierEntries already excludes any entry at the prev cutoff month.
  const priorBucket = Math.max(0, actualCost - sumEarlierEntries(stored, prevMonth));

  // Always upsert: filter out any prior entry at prevMonth, then append the
  // freshly-computed bucket value. Skip only when the bucket is 0 AND there's
  // no stale entry to clean up.
  const without = stored.filter((e) => e.month !== prevMonth);
  if (priorBucket <= 0) return without.length === stored.length ? stored : without;

  return [...without, { month: prevMonth, cost: priorBucket, hours: 0 }];
}

/**
 * Computes the sum of stored entries earlier than the cutoff month.
 * Entries at or after the cutoff month are excluded — by design, only
 * earlier-month entries are stored; the cutoff month is derived.
 */
export function sumEarlierEntries(
  storedEntries: HistoricalCostEntry[] | undefined,
  cutoffMonth: string,
): number {
  if (!storedEntries || storedEntries.length === 0) return 0;
  let sum = 0;
  for (const e of storedEntries) {
    if (e.month < cutoffMonth) sum += e.cost;
  }
  return sum;
}

/**
 * Produces the full display-row set for HistoricalCostsTable.
 *
 * Returns [] if actualsThroughDate is absent (D4 — no section without cutoff).
 *
 * Otherwise produces one row per month in [projectStartMonth, cutoffMonth]:
 *   - Months with a stored entry use the stored values (editable)
 *   - Months without a stored entry are synthetic placeholders with 0/0 (editable)
 *   - The cutoff month is the read-only "bucket": cost = actualCost − sum(stored),
 *     clamped to 0 if negative (over-allocation)
 *
 * If projectStartMonth > cutoffMonth (project hasn't started yet), only the
 * cutoff-bucket row is produced.
 *
 * Invariant: sum(all display rows' cost) === actualCost when stored sums ≤ actualCost.
 */
export function buildHistoricalCostsView(
  storedEntries: HistoricalCostEntry[] | undefined,
  actualCost: number,
  actualsThroughDate: string | undefined,
  projectStartDate: string,
): HistoricalCostsDisplayRow[] {
  if (!actualsThroughDate) return [];

  const cutoffMonth = actualsThroughDate.slice(0, 7);
  const startMonth = projectStartDate.slice(0, 7);

  // Filter stored entries to in-range [startMonth, cutoffMonth) only. Entries
  // before project start are defensively ignored (typically phantom entries
  // from a mis-typed cutoff that was later corrected). Entries at or after
  // the cutoff are ignored by construction (cutoff row is derived).
  const inRangeEntries = (storedEntries ?? []).filter(
    (e) => e.month >= startMonth && e.month < cutoffMonth,
  );
  const stored = new Map<string, HistoricalCostEntry>();
  for (const entry of inRangeEntries) {
    stored.set(entry.month, entry);
  }

  // Enumerate all months from start through cutoff inclusive.
  // If start > cutoff (project hasn't begun), fall back to just the cutoff month.
  const firstMonth = startMonth <= cutoffMonth ? startMonth : cutoffMonth;
  const months = generateMonthRange(firstMonth, cutoffMonth);

  const rows: HistoricalCostsDisplayRow[] = [];
  for (const m of months) {
    if (m === cutoffMonth) continue; // handled separately as bucket row
    const entry = stored.get(m);
    rows.push({
      month: m,
      cost: entry?.cost ?? 0,
      hours: entry?.hours ?? 0,
      isCutoffBucket: false,
    });
  }

  // Cutoff bucket: actualCost minus sum of in-range earlier entries, clamped at 0.
  // Out-of-range entries (e.g. phantom Feb entry on a March-starting project)
  // are intentionally NOT subtracted — only legitimate in-range entries count.
  const earlierSum = inRangeEntries.reduce((acc, e) => acc + e.cost, 0);
  rows.push({
    month: cutoffMonth,
    cost: Math.max(0, actualCost - earlierSum),
    hours: 0,
    isCutoffBucket: true,
  });

  return rows;
}
