import type { ProductivityWindow } from '@/types/domain';

/**
 * Get the effective productivity factor for a given month.
 *
 * - If multiple windows overlap, use the MINIMUM factor.
 * - If no windows apply, returns 1.0 (full productivity).
 * - A window overlaps a month if it starts before the month ends
 *   AND ends on or after the month starts.
 */
export function getProductivityFactor(
  month: string,
  windows: ProductivityWindow[],
): number {
  if (windows.length === 0) return 1;

  const [year, m] = month.split('-').map(Number);
  const monthStart = new Date(year, m - 1, 1);
  const monthEnd = new Date(year, m, 0); // last day of month

  const overlapping = windows.filter(w => {
    const windowStart = new Date(w.startDate);
    const windowEnd = new Date(w.endDate);
    return windowStart <= monthEnd && windowEnd >= monthStart;
  });

  if (overlapping.length === 0) return 1;
  return Math.min(...overlapping.map(w => w.factor));
}
