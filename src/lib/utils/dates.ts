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
