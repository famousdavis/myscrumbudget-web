// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { HOURS_PER_DAY } from '@/lib/constants';
import type { Holiday } from '@/types/domain';

/**
 * Generate an array of month strings (YYYY-MM) between two dates inclusive.
 */
export function generateMonthRange(
  startDate: string,
  endDate: string
): string[] {
  const months: string[] = [];
  const [startYear, startMonth] = startDate.split('-').map(Number);
  const [endYear, endMonth] = endDate.split('-').map(Number);

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

/**
 * Format a Date as YYYY-MM.
 */
export function formatMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Format a month string (YYYY-MM) as a short label like "Jun 2026".
 */
export function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year, m - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Get the current month as YYYY-MM.
 */
export function getCurrentMonth(): string {
  return formatMonth(new Date());
}

/**
 * Format a month string (YYYY-MM) as a short name like "Jan", "Feb", etc.
 */
export function formatShortMonth(month: string): string {
  const [, m] = month.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[m - 1] ?? month;
}

/**
 * Returns the next business day (Mon-Fri) after the given YYYY-MM-DD string.
 */
export function nextBusinessDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 1);
  const dow = date.getDay();
  if (dow === 0) date.setDate(date.getDate() + 1); // Sun -> Mon
  if (dow === 6) date.setDate(date.getDate() + 2); // Sat -> Mon
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Count weekdays (Mon-Fri) between two YYYY-MM-DD dates, inclusive of both ends.
 */
export function countWorkdays(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dow = current.getDay();
    if (dow >= 1 && dow <= 5) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/** Format a local Date as YYYY-MM-DD. */
function formatIsoDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Every weekday (Mon-Fri) between two YYYY-MM-DD dates, inclusive of both
 * ends, as YYYY-MM-DD strings in date order.
 */
function weekdaysBetween(startDate: string, endDate: string): string[] {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const current = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  const days: string[] = [];
  while (current <= end) {
    const dow = current.getDay();
    if (dow >= 1 && dow <= 5) days.push(formatIsoDate(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/**
 * The weekday dates within [startDate, endDate] that any of the holidays
 * covers. A date inside two overlapping holidays is one date.
 */
function holidayWeekdays(
  startDate: string,
  endDate: string,
  holidays: Holiday[],
): Set<string> {
  const dates = new Set<string>();

  for (const holiday of holidays) {
    // Clip holiday range to [startDate, endDate]
    const effectiveStart = holiday.startDate > startDate ? holiday.startDate : startDate;
    const effectiveEnd = holiday.endDate < endDate ? holiday.endDate : endDate;

    if (effectiveStart > effectiveEnd) continue;

    for (const day of weekdaysBetween(effectiveStart, effectiveEnd)) dates.add(day);
  }

  return dates;
}

/**
 * Count how many of the given holidays fall on workdays (Mon-Fri)
 * within the specified date range [startDate, endDate], inclusive.
 * Deduplicates days so overlapping holiday ranges don't double-count.
 */
export function countHolidayWorkdays(
  startDate: string,
  endDate: string,
  holidays: Holiday[],
): number {
  return holidayWeekdays(startDate, endDate, holidays).size;
}

/**
 * Compute the ETC start date from an actuals-through date.
 * Returns the calendar day after the cutoff. The workday engine
 * naturally handles weekends and holidays.
 */
export function getEtcStartDate(actualsThroughDate: string): string {
  const [y, m, d] = actualsThroughDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 1);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * The working days of a YYYY-MM month that carry forecast hours, as YYYY-MM-DD
 * strings in date order: the weekdays of the month, clipped to the project
 * date range, that no holiday covers.
 * - First month: from project startDate to end of month
 * - Last month: from start of month to project endDate
 * - Middle months: the full month
 * When etcStartDate is provided, it acts as an additional lower bound on the
 * start — leaving no days in months covered by actuals and only the days after
 * the cutoff in the cutoff month.
 *
 * ⚠️ This list is the calc engine's ONE definition of a day the team works.
 * Available hours are its length × HOURS_PER_DAY (getMonthlyWorkHours), and
 * the productivity factor is averaged over exactly these days (v0.43.0).
 * Before that release the factor was averaged over every CALENDAR day of the
 * month and then multiplied into hours that already excluded holidays — so a
 * window over a holiday took that time off twice, a window over a weekend took
 * off hours nobody works, and a window on its own took off too little (5 of 30
 * calendar days instead of 5 of 21 working days). Taking both from one list
 * makes that disagreement impossible, not merely tested against.
 */
export function getMonthlyWorkingDays(
  month: string,
  projectStartDate: string,
  projectEndDate: string,
  holidays: Holiday[] = [],
  etcStartDate?: string,
): string[] {
  const [year, mon] = month.split('-').map(Number);

  // Full month boundaries
  const monthStart = `${year}-${String(mon).padStart(2, '0')}-01`;
  const lastDay = new Date(year, mon, 0).getDate(); // last day of month
  const monthEnd = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Clip to project date range and ETC start date
  let effectiveStart = projectStartDate > monthStart ? projectStartDate : monthStart;
  if (etcStartDate && etcStartDate > effectiveStart) {
    effectiveStart = etcStartDate;
  }
  const effectiveEnd = projectEndDate < monthEnd ? projectEndDate : monthEnd;

  if (effectiveStart > effectiveEnd) return [];

  const weekdays = weekdaysBetween(effectiveStart, effectiveEnd);
  if (holidays.length === 0) return weekdays;

  const daysOff = holidayWeekdays(effectiveStart, effectiveEnd, holidays);
  return weekdays.filter((day) => !daysOff.has(day));
}

/**
 * Get available workday hours for a YYYY-MM month, clipped to project date
 * range, with holidays subtracted and etcStartDate as an optional lower bound.
 * Returns getMonthlyWorkingDays(...).length × HOURS_PER_DAY — see that
 * function for how the days are chosen.
 */
export function getMonthlyWorkHours(
  month: string,
  projectStartDate: string,
  projectEndDate: string,
  holidays: Holiday[] = [],
  etcStartDate?: string,
): number {
  return getMonthlyWorkingDays(
    month, projectStartDate, projectEndDate, holidays, etcStartDate,
  ).length * HOURS_PER_DAY;
}
