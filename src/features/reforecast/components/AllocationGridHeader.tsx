// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { MonthlyCalculation } from '@/types/domain';
import { formatMonthLabel } from '@/lib/utils/dates';

type SortMode = 'none' | 'name' | 'role-name';

interface AllocationGridHeaderProps {
  months: string[];
  /**
   * The calc engine's monthly breakdown. The amber productivity figure under
   * each month is read from here — the factor the hours and cost were actually
   * computed with — rather than recomputed from the windows. A header that ran
   * its own calculation is how the two disagreed before v0.43.0: it showed a
   * calendar-day average (e.g. 83% for a holiday week the engine then removed
   * twice). Undefined while metrics are unavailable; no figure is shown then.
   */
  monthlyData?: MonthlyCalculation[];
  sortMode: SortMode;
  onSortClick?: () => void;
  hasRowControls: boolean;
  sortable: boolean;
}

export function AllocationGridHeader({
  months,
  monthlyData,
  sortMode,
  onSortClick,
  hasRowControls,
  sortable,
}: AllocationGridHeaderProps) {
  const factorByMonth = new Map(
    (monthlyData ?? []).map((d) => [d.month, d.productivityFactor]),
  );
  return (
    <thead>
      <tr>
        <th
          scope="col"
          className={`sticky left-0 z-[25] border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900${sortable ? ' cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800' : ''}`}
          onClick={sortable ? onSortClick : undefined}
          title={sortable ? (sortMode === 'none' ? 'Sort by name' : sortMode === 'name' ? 'Sort by role, then name' : 'Clear sort') : undefined}
        >
          <span className="flex items-center gap-1">
            Team Member
            {sortable && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {sortMode === 'name' ? '▲ A–Z' : sortMode === 'role-name' ? '▲ Role' : '⇅'}
              </span>
            )}
          </span>
        </th>
        {months.map((month) => {
          const factor = factorByMonth.get(month) ?? 1;
          return (
            <th
              scope="col"
              key={month}
              className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-center text-sm font-medium whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-900"
              title={
                factor < 1
                  ? `Productivity: ${Math.round(factor * 100)}% (reduced capacity)`
                  : undefined
              }
            >
              <div>{formatMonthLabel(month)}</div>
              {factor < 1 && (
                <div className="text-[10px] font-normal text-amber-600 dark:text-amber-400">
                  {Math.round(factor * 100)}%
                </div>
              )}
            </th>
          );
        })}
        {hasRowControls && (
          <th scope="col" className="sticky right-0 z-[25] border border-zinc-200 bg-zinc-50 px-2 py-2 text-center text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900">
          </th>
        )}
      </tr>
    </thead>
  );
}
