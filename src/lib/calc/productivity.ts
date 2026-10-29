// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { ProductivityWindow } from '@/types/domain';

/**
 * Get the effective productivity factor for a set of working days.
 *
 * For each day, the factor is the minimum of all windows covering it (or 1.0
 * if none does); the result is the average across the days. So a one-week 0%
 * window in a month with 22 working days yields 17/22 ≈ 0.77, not 0.0 for the
 * whole month.
 *
 * ⚠️ PASS THE DAYS THAT CARRY HOURS — `getMonthlyWorkingDays` for the same
 * month, range, holidays and cutoff the hours were computed from — never the
 * month's calendar days. Weekends and holidays have no hours to reduce, so a
 * window over them must change nothing, and that holds only if they are not
 * in the list. Until v0.43.0 this function took a month and averaged over all
 * of its calendar days, which double-counted holidays, reduced hours for
 * weekends, and under-applied a window used on its own.
 *
 * Dates are compared as YYYY-MM-DD strings, which order correctly; the import
 * validator and the date inputs both guarantee that format.
 *
 * ⚠️ FOR MANY WINDOWS, AN INDEX (v0.44.6). A project document can carry
 * thousands of windows — 11,000 fit under the 1 MiB cap — and checking each
 * one against every working day of 100 years took over a second per
 * calculation. `createProductivityLookup` sorts them once and answers each day
 * from the index. Every day's factor is still the minimum over exactly the
 * windows whose range contains it, compared as strings like before, so the
 * result is identical. A window whose dates are not strings never contained a
 * day and is left out.
 */
export function getProductivityFactor(
  workingDays: readonly string[],
  windows: readonly ProductivityWindow[],
): number {
  return createProductivityLookup(windows)(workingDays);
}

/** Below this many windows a plain scan is cheaper than building the index. */
const SCAN_LIMIT = 64;

/**
 * Build once per calculation; returns the factor for a set of working days.
 * The calc engine builds one per reforecast and calls it for every month.
 */
export function createProductivityLookup(
  windows: readonly ProductivityWindow[],
): (workingDays: readonly string[]) => number {
  const usable = windows.filter(
    (w) => typeof w.startDate === 'string' && typeof w.endDate === 'string',
  );
  const lowestFor = usable.length <= SCAN_LIMIT ? scanLowest(usable) : indexLowest(usable);
  return (workingDays) => {
    if (workingDays.length === 0 || windows.length === 0) return 1;
    let totalFactor = 0;
    for (const day of workingDays) totalFactor += lowestFor(day);
    return totalFactor / workingDays.length;
  };
}

/** The day's factor by checking every window — the rule, stated directly. */
function scanLowest(windows: readonly ProductivityWindow[]): (day: string) => number {
  return (day) => {
    let dayFactor = 1;
    for (const w of windows) {
      if (w.startDate <= day && day <= w.endDate) dayFactor = Math.min(dayFactor, w.factor);
    }
    return dayFactor;
  };
}

interface IndexNode {
  /** End dates of the node's windows, ascending. */
  ends: string[];
  /** Their factors, in the same order. */
  factors: number[];
  /** lowest[i] = the lowest of factors[i..]. */
  lowest: number[];
}

/**
 * The same rule through a segment tree over the windows sorted by start date:
 * the windows starting on or before a day are a prefix, and each node of that
 * prefix answers "lowest factor among my windows ending on or after the day"
 * with one binary search. Math.min over the same windows in a different
 * order gives the same number, NaN and negative zero included.
 */
function indexLowest(windows: readonly ProductivityWindow[]): (day: string) => number {
  const byStart = [...windows].sort((a, b) => compare(a.startDate, b.startDate));
  const starts = byStart.map((w) => w.startDate);
  let size = 1;
  while (size < byStart.length) size *= 2;
  const nodes: IndexNode[] = new Array(2 * size);
  for (let i = 0; i < size; i++) {
    const w = byStart[i];
    nodes[size + i] = w ? withLowest([w.endDate], [w.factor]) : withLowest([], []);
  }
  for (let i = size - 1; i >= 1; i--) nodes[i] = mergeNodes(nodes[2 * i], nodes[2 * i + 1]);

  return (day) => {
    let dayFactor = 1;
    let left = size;
    let right = size + countAtOrBefore(starts, day);
    while (left < right) {
      if (left & 1) dayFactor = Math.min(dayFactor, lowestEndingFrom(nodes[left++], day));
      if (right & 1) dayFactor = Math.min(dayFactor, lowestEndingFrom(nodes[--right], day));
      left >>= 1;
      right >>= 1;
    }
    return dayFactor;
  };
}

function compare(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function withLowest(ends: string[], factors: number[]): IndexNode {
  const lowest = new Array<number>(factors.length);
  let low = Infinity;
  for (let i = factors.length - 1; i >= 0; i--) {
    low = Math.min(low, factors[i]);
    lowest[i] = low;
  }
  return { ends, factors, lowest };
}

/** Both children's windows, merged in end-date order. */
function mergeNodes(a: IndexNode, b: IndexNode): IndexNode {
  const ends: string[] = [];
  const factors: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.ends.length || j < b.ends.length) {
    const takeA = j >= b.ends.length || (i < a.ends.length && a.ends[i] <= b.ends[j]);
    if (takeA) {
      ends.push(a.ends[i]);
      factors.push(a.factors[i++]);
    } else {
      ends.push(b.ends[j]);
      factors.push(b.factors[j++]);
    }
  }
  return withLowest(ends, factors);
}

/** How many of the ascending `starts` are on or before `day`. */
function countAtOrBefore(starts: readonly string[], day: string): number {
  let lo = 0;
  let hi = starts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= day) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The lowest factor among the node's windows that end on or after `day`. */
function lowestEndingFrom(node: IndexNode, day: string): number {
  let lo = 0;
  let hi = node.ends.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (node.ends[mid] < day) lo = mid + 1;
    else hi = mid;
  }
  return lo < node.ends.length ? node.lowest[lo] : Infinity;
}
