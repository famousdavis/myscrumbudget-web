import type { ProductivityWindow } from '@/types/domain';

/**
 * Get the effective productivity factor for a given month.
 *
 * Computes a day-weighted blended factor: for each day in the month,
 * the effective factor is the minimum of all overlapping windows
 * (or 1.0 if no windows cover that day). The monthly factor is the
 * average across all days.
 *
 * This means a one-week 0% window in a 30-day month yields ~0.767
 * rather than 0.0 for the whole month.
 */
export function getProductivityFactor(
  month: string,
  windows: ProductivityWindow[],
): number {
  if (windows.length === 0) return 1;

  const [year, m] = month.split('-').map(Number);
  const monthStart = new Date(year, m - 1, 1);
  const monthEnd = new Date(year, m, 0); // last day of month
  const daysInMonth = monthEnd.getDate();

  // Parse YYYY-MM-DD as local date (avoid UTC shift issues)
  const parseLocal = (s: string) => {
    const [y, mo, d] = s.split('-').map(Number);
    return new Date(y, mo - 1, d);
  };

  // Pre-filter to windows that overlap this month at all
  const overlapping = windows.filter(w => {
    const ws = parseLocal(w.startDate);
    const we = parseLocal(w.endDate);
    return ws <= monthEnd && we >= monthStart;
  });

  if (overlapping.length === 0) return 1;

  // Parse window dates once
  const parsed = overlapping.map(w => ({
    start: parseLocal(w.startDate),
    end: parseLocal(w.endDate),
    factor: w.factor,
  }));

  // For each day, compute the minimum factor from covering windows
  let totalFactor = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, m - 1, day);
    let dayFactor = 1;
    for (const pw of parsed) {
      if (date >= pw.start && date <= pw.end) {
        dayFactor = Math.min(dayFactor, pw.factor);
      }
    }
    totalFactor += dayFactor;
  }

  return totalFactor / daysInMonth;
}
