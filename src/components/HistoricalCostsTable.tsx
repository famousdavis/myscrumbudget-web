// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';
import type { HistoricalCostEntry, Project, Reforecast } from '@/types/domain';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDateMedium } from '@/lib/utils/format';
import { formatShortMonth } from '@/lib/utils/dates';
import {
  buildHistoricalCostsView,
  commitHistoricalCostEdit,
  sumEarlierEntries,
} from '@/lib/utils/historicalCostsView';

interface HistoricalCostsTableProps {
  activeReforecast: Reforecast;
  project: Project;
  onUpdate: (entries: HistoricalCostEntry[]) => void;
}

export function HistoricalCostsTable({
  activeReforecast,
  project,
  onUpdate,
}: HistoricalCostsTableProps) {
  const [expanded, setExpanded] = useState(false);
  const { addToast } = useToast();

  const cutoff = activeReforecast.actualsThroughDate;
  if (!cutoff) return null;

  const rows = buildHistoricalCostsView(
    activeReforecast.historicalCosts,
    activeReforecast.actualCost,
    cutoff,
    project.startDate,
  );
  if (rows.length === 0) return null;

  const cutoffMonth = cutoff.slice(0, 7);
  const projectStartMonth = project.startDate.slice(0, 7);
  const stored = activeReforecast.historicalCosts ?? [];

  const handleBlur = (month: string, rawValue: string) => {
    const result = commitHistoricalCostEdit(
      stored,
      month,
      rawValue,
      activeReforecast.actualCost,
      cutoffMonth,
      projectStartMonth,
    );
    if (result.cappedAt !== null) {
      addToast(
        `Capped at ${formatCurrency(result.cappedAt)} — cannot exceed the project total`,
        'error',
      );
    }
    if (result.next !== null) onUpdate(result.next);
  };

  const earlierSum = sumEarlierEntries(stored, cutoffMonth);
  const bucketAmount = Math.max(0, activeReforecast.actualCost - earlierSum);
  const cutoffLabel = `Through ${formatDateMedium(cutoff)}`;
  const bucketTooltip =
    'This row holds the remainder of the Actual total after earlier months are distributed. Edit earlier months to redistribute.';

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
        aria-expanded={expanded}
      >
        <span>Historical Costs Breakdown</span>
        <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-500">
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-900">
                <th
                  scope="col"
                  className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400"
                >
                  Month
                </th>
                <th
                  scope="col"
                  className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400"
                >
                  Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                if (row.isCutoffBucket) {
                  return (
                    <tr
                      key={row.month}
                      title={bucketTooltip}
                      className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <td className="px-4 py-2">
                        <span className="font-medium">
                          {formatShortMonth(row.month)}
                        </span>
                        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                          · {cutoffLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatCurrency(bucketAmount)}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={row.month}
                    className="border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-4 py-2">{formatShortMonth(row.month)}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        key={`${row.month}:${row.cost}`}
                        type="number"
                        min="0"
                        step="any"
                        defaultValue={row.cost}
                        onBlur={(e) => handleBlur(row.month, e.currentTarget.value)}
                        onFocus={(e) => e.currentTarget.select()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          } else if (e.key === 'Escape') {
                            e.currentTarget.value = String(row.cost);
                            e.currentTarget.blur();
                          }
                        }}
                        aria-label={`Historical cost for ${formatShortMonth(row.month)}`}
                        className="w-32 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right">
                  {formatCurrency(activeReforecast.actualCost)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
