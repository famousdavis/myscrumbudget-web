'use client';

import { useMemo } from 'react';
import type { MonthlyCalculation } from '@/types/domain';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { formatShortMonth } from '@/lib/utils/dates';

interface CostByPeriodTableProps {
  monthlyData: MonthlyCalculation[];
  actualCost: number;
}

interface YearRow {
  year: number;
  firstMonth: string;
  lastMonth: string;
  hours: number;
  cost: number;
}

export function CostByPeriodTable({ monthlyData, actualCost }: CostByPeriodTableProps) {
  const yearRows = useMemo(() => {
    const byYear = new Map<number, { hours: number; cost: number; firstMonth: string; lastMonth: string }>();

    for (const entry of monthlyData) {
      const year = parseInt(entry.month.split('-')[0], 10);
      const existing = byYear.get(year);
      if (existing) {
        existing.hours += entry.hours;
        existing.cost += entry.cost;
        existing.lastMonth = entry.month;
      } else {
        byYear.set(year, {
          hours: entry.hours,
          cost: entry.cost,
          firstMonth: entry.month,
          lastMonth: entry.month,
        });
      }
    }

    const rows: YearRow[] = [];
    for (const [year, data] of byYear) {
      rows.push({ year, ...data });
    }
    rows.sort((a, b) => a.year - b.year);
    return rows;
  }, [monthlyData]);

  const totals = useMemo(() => {
    return yearRows.reduce(
      (acc, row) => ({ hours: acc.hours + row.hours, cost: acc.cost + row.cost }),
      { hours: 0, cost: 0 }
    );
  }, [yearRows]);

  if (yearRows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-900">
            <th scope="col" className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">Year</th>
            <th scope="col" className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">Months</th>
            <th scope="col" className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Hours</th>
            <th scope="col" className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Cost</th>
          </tr>
        </thead>
        <tbody>
          {actualCost > 0 && (
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400" colSpan={2}>
                Actual Cost (to date)
              </td>
              <td className="px-4 py-2 text-right text-zinc-400 dark:text-zinc-500">&mdash;</td>
              <td className="px-4 py-2 text-right font-medium">
                {formatCurrency(actualCost)}
              </td>
            </tr>
          )}
          {yearRows.map((row) => (
            <tr key={row.year} className="border-b border-zinc-100 dark:border-zinc-800">
              <td className="px-4 py-2 font-medium">{row.year}</td>
              <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">
                {formatShortMonth(row.firstMonth)}
                {row.firstMonth !== row.lastMonth && ` – ${formatShortMonth(row.lastMonth)}`}
              </td>
              <td className="px-4 py-2 text-right">{formatNumber(row.hours)}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(row.cost)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
            <td className="px-4 py-2" colSpan={2}>
              {actualCost > 0 ? 'Forecast Subtotal (ETC)' : 'Total (ETC)'}
            </td>
            <td className="px-4 py-2 text-right">{formatNumber(totals.hours)}</td>
            <td className="px-4 py-2 text-right">{formatCurrency(totals.cost)}</td>
          </tr>
          {actualCost > 0 && (
            <tr className="font-semibold">
              <td className="px-4 py-2" colSpan={2}>
                Total (EAC)
              </td>
              <td className="px-4 py-2 text-right text-zinc-400 dark:text-zinc-500">&mdash;</td>
              <td className="px-4 py-2 text-right">{formatCurrency(actualCost + totals.cost)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
