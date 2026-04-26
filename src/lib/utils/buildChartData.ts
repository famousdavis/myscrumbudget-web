// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { HistoricalCostEntry, MonthlyCalculation } from '@/types/domain';
import { buildHistoricalCostsView } from './historicalCostsView';

export type ChartSegment = 'historical' | 'blended' | 'forecast';

/**
 * A merged chart point. `cost` (inherited from MonthlyCalculation) is the
 * total bar height; `historicalCost` + `forecastCost` always sum to it.
 * The bar chart stacks the two portions; the line chart uses `cost` for
 * cumulative trajectory and `segment` to pick the line/dot style.
 */
export type ChartDataPoint = MonthlyCalculation & {
  segment: ChartSegment;
  historicalCost: number;
  forecastCost: number;
};

/**
 * Merges historical entries and ETC monthly data into a single sorted series.
 *
 * Modes:
 *   Legacy (no actualsThroughDate): adds actualCost to every cumulativeCost
 *     in etcMonthlyData (preserves pre-v0.22.0 scalar-offset behavior). All
 *     points → 'forecast' (historicalCost=0, forecastCost=cost).
 *
 *   Historical (view produces at least one row):
 *     - 'historical' month: historicalCost = bucket/stored value, forecastCost = 0
 *     - 'blended' month (typically the cutoff month with mid-month date):
 *         historicalCost = bucket, forecastCost = ETC prorated remainder.
 *         Bar stacks the two; line chart cumulative includes both.
 *     - 'forecast' month: historicalCost = 0, forecastCost = ETC value
 */
export function buildChartData(
  historicalCosts: HistoricalCostEntry[] | undefined,
  etcMonthlyData: MonthlyCalculation[],
  actualsThroughDate: string | undefined,
  projectStartDate: string,
  actualCost: number,
): ChartDataPoint[] {
  const displayRows = buildHistoricalCostsView(
    historicalCosts,
    actualCost,
    actualsThroughDate,
    projectStartDate,
  );

  const hasBreakdown = displayRows.length > 0;

  if (!hasBreakdown) {
    return etcMonthlyData.map((d) => ({
      ...d,
      cumulativeCost: actualCost + d.cumulativeCost,
      segment: 'forecast' as const,
      historicalCost: 0,
      forecastCost: d.cost,
    }));
  }

  const historicalByMonth = new Map<string, { cost: number; hours: number }>();
  for (const row of displayRows) {
    historicalByMonth.set(row.month, { cost: row.cost, hours: row.hours });
  }

  const etcByMonth = new Map<string, MonthlyCalculation>();
  for (const d of etcMonthlyData) {
    etcByMonth.set(d.month, d);
  }

  const allMonths = new Set<string>();
  for (const row of displayRows) allMonths.add(row.month);
  for (const d of etcMonthlyData) allMonths.add(d.month);
  const sortedMonths = Array.from(allMonths).sort();

  let cumulativeCost = 0;
  let cumulativeHours = 0;
  const result: ChartDataPoint[] = [];

  for (const m of sortedMonths) {
    const hist = historicalByMonth.get(m);
    const etc = etcByMonth.get(m);
    const etcCost = etc?.cost ?? 0;
    const etcHours = etc?.hours ?? 0;

    if (hist) {
      const isBlended = etcCost > 0;
      const historicalCost = hist.cost;
      const forecastCost = isBlended ? etcCost : 0;
      const cost = historicalCost + forecastCost;
      const hours = hist.hours + (isBlended ? etcHours : 0);
      cumulativeCost += cost;
      cumulativeHours += hours;
      result.push({
        month: m,
        cost,
        hours,
        cumulativeCost,
        cumulativeHours,
        segment: isBlended ? 'blended' : 'historical',
        historicalCost,
        forecastCost,
      });
    } else {
      cumulativeCost += etcCost;
      cumulativeHours += etcHours;
      result.push({
        month: m,
        cost: etcCost,
        hours: etcHours,
        cumulativeCost,
        cumulativeHours,
        segment: 'forecast',
        historicalCost: 0,
        forecastCost: etcCost,
      });
    }
  }

  return result;
}
