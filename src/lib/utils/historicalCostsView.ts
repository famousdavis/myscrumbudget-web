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

export interface CommitResult {
  /** New entries array to persist; `null` means no change (skip onUpdate). */
  next: HistoricalCostEntry[] | null;
  /** When non-null, over-allocation was clamped to this ceiling. */
  cappedAt: number | null;
}

/**
 * Pure function for committing an inline edit on a historical-cost row.
 *
 * Sanitizes the raw input (NaN/Infinity/negative → 0), then clamps to the
 * ceiling `actualCost − sum(other in-range earlier entries)`. Returns:
 *   - `next`: the upserted entries array, or `null` if nothing changed
 *   - `cappedAt`: the ceiling, when clamping was applied; otherwise `null`
 *
 * Zero-value commits remove the entry entirely (rather than storing a
 * cost-0 row); when the existing value was already 0 and the typed value
 * is also 0, returns `next: null` as a no-op.
 *
 * `projectStartMonth` (optional) restricts the ceiling-sum scope to
 * in-range entries only — matching `buildHistoricalCostsView`'s display
 * semantics. Out-of-range stored entries (e.g., months earlier than
 * project start after a bounds tightening) are excluded from the
 * ceiling, so the edit ceiling agrees with the displayed cutoff bucket.
 */
export function commitHistoricalCostEdit(
  stored: HistoricalCostEntry[],
  month: string,
  rawValue: string,
  actualCost: number,
  cutoffMonth: string,
  projectStartMonth?: string,
): CommitResult {
  const parsed = parseFloat(rawValue);
  const sanitized = Math.max(0, Number.isFinite(parsed) ? parsed : 0);

  // Sum of OTHER in-range earlier entries (excluding the one being edited).
  // When `projectStartMonth` is provided, entries earlier than project start
  // are excluded so the ceiling matches `buildHistoricalCostsView`'s
  // displayed cutoff bucket.
  const otherSum = stored
    .filter((e) => {
      if (e.month === month) return false;
      if (e.month >= cutoffMonth) return false;
      if (projectStartMonth && e.month < projectStartMonth) return false;
      return true;
    })
    .reduce((acc, e) => acc + e.cost, 0);

  const ceiling = Math.max(0, actualCost - otherSum);
  const cappedAt = sanitized > ceiling ? ceiling : null;
  const finalCost = cappedAt !== null ? ceiling : sanitized;

  // Build the new entries array: remove existing entry for this month,
  // then append fresh entry if cost > 0.
  const without = stored.filter((e) => e.month !== month);
  const next: HistoricalCostEntry[] =
    finalCost > 0
      ? [...without, { month, cost: finalCost, hours: 0 }]
      : without;

  // No-op detection: when the resulting cost matches existing AND we
  // aren't transitioning between absent ↔ zero in a meaningful way.
  const existing = stored.find((e) => e.month === month);
  const noChange =
    (existing?.cost ?? 0) === finalCost &&
    (finalCost === 0 ? !existing : true);
  if (noChange) return { next: null, cappedAt };

  return { next, cappedAt };
}

/**
 * Compute the effective bucket at `cutoffMonth` and upsert it as a stored
 * entry. The bucket is `max(0, actualCost − sum(entries strictly earlier
 * than cutoffMonth))`. Any pre-existing entry at `cutoffMonth` is always
 * overwritten — the cutoff-month row is never user-editable, so a prior
 * entry there can only be a stale materialization.
 *
 * Returns the (possibly trimmed) array. When the bucket is 0, only strips
 * a stale entry — no upsert. Range-guards against `projectStartMonth` when
 * provided: refuses to materialize at a month before project start
 * (prevents phantom entries from briefly mis-typed cutoffs).
 */
export function materializeBucketAt(
  stored: HistoricalCostEntry[],
  actualCost: number,
  cutoffMonth: string,
  projectStartMonth?: string,
): HistoricalCostEntry[] {
  // Range guard: refuse to materialize at a month before project start.
  if (projectStartMonth && cutoffMonth < projectStartMonth) return stored;

  const bucket = Math.max(0, actualCost - sumEarlierEntries(stored, cutoffMonth));
  const without = stored.filter((e) => e.month !== cutoffMonth);

  // Bucket is 0: only strip a stale entry, don't append a zero-cost entry.
  if (bucket <= 0) return without.length === stored.length ? stored : without;

  return [...without, { month: cutoffMonth, cost: bucket, hours: 0 }];
}

/**
 * When advancing the cutoff to a later month, capture the prior bucket
 * value as a stored entry so the previously-derived total isn't lost.
 *
 * Thin wrapper over `materializeBucketAt`: handles the should-we-materialize-
 * at-all guards (missing prev cutoff, non-advancing change), then delegates.
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

  return materializeBucketAt(
    stored,
    actualCost,
    prevMonth,
    projectStartDate?.slice(0, 7),
  );
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
