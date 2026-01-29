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
