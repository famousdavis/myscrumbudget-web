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
 */
export function getProductivityFactor(
  workingDays: readonly string[],
  windows: readonly ProductivityWindow[],
): number {
  if (workingDays.length === 0 || windows.length === 0) return 1;

  let totalFactor = 0;
  for (const day of workingDays) {
    let dayFactor = 1;
    for (const w of windows) {
      if (w.startDate <= day && day <= w.endDate) {
        dayFactor = Math.min(dayFactor, w.factor);
      }
    }
    totalFactor += dayFactor;
  }

  return totalFactor / workingDays.length;
}
