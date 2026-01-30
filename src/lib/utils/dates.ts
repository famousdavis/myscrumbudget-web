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
  const holidayWorkdays = new Set<string>();

  for (const holiday of holidays) {
    // Clip holiday range to [startDate, endDate]
    const effectiveStart = holiday.startDate > startDate ? holiday.startDate : startDate;
    const effectiveEnd = holiday.endDate < endDate ? holiday.endDate : endDate;

    if (effectiveStart > effectiveEnd) continue;

    const [sy, sm, sd] = effectiveStart.split('-').map(Number);
    const [ey, em, ed] = effectiveEnd.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    const current = new Date(start);

    while (current <= end) {
      const dow = current.getDay();
      if (dow >= 1 && dow <= 5) {
        const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        holidayWorkdays.add(key);
      }
      current.setDate(current.getDate() + 1);
    }
  }

  return holidayWorkdays.size;
}

/**
 * Get available workday hours for a YYYY-MM month, clipped to project date range.
 * - First month: count workdays from project startDate to end of month
 * - Last month: count workdays from start of month to project endDate
 * - Middle months: count all workdays in the full month
 * Holidays (non-work days) are subtracted from the workday count.
 * Returns (workdays - holidays) * HOURS_PER_DAY.
 */
export function getMonthlyWorkHours(
  month: string,
  projectStartDate: string,
  projectEndDate: string,
  holidays: Holiday[] = [],
): number {
  const [year, mon] = month.split('-').map(Number);

  // Full month boundaries
  const monthStart = `${year}-${String(mon).padStart(2, '0')}-01`;
  const lastDay = new Date(year, mon, 0).getDate(); // last day of month
  const monthEnd = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Clip to project date range
  const effectiveStart = projectStartDate > monthStart ? projectStartDate : monthStart;
  const effectiveEnd = projectEndDate < monthEnd ? projectEndDate : monthEnd;

  if (effectiveStart > effectiveEnd) return 0;

  const workdays = countWorkdays(effectiveStart, effectiveEnd);
  const holidayDays = holidays.length > 0
    ? countHolidayWorkdays(effectiveStart, effectiveEnd, holidays)
    : 0;

  return Math.max(0, workdays - holidayDays) * HOURS_PER_DAY;
}
