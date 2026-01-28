/**
 * Generate an array of month strings (YYYY-MM) between two dates inclusive.
 */
export function generateMonthRange(
  startDate: string,
  endDate: string
): string[] {
  const months: string[] = [];
  const start = new Date(startDate + '-01');
  const end = new Date(endDate + '-01');

  const current = new Date(start);
  while (current <= end) {
    months.push(formatMonth(current));
    current.setMonth(current.getMonth() + 1);
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
