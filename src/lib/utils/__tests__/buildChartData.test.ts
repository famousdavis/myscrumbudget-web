// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { buildChartData } from '../buildChartData';
import type { HistoricalCostEntry, MonthlyCalculation } from '@/types/domain';

function mc(month: string, cost: number, hours: number, cumCost: number, cumHours: number): MonthlyCalculation {
  return { month, cost, hours, cumulativeCost: cumCost, cumulativeHours: cumHours };
}

describe('buildChartData', () => {
  describe('legacy mode (no actualsThroughDate)', () => {
    it('cumulative offset by actualCost; all forecast; historicalCost = 0 everywhere', () => {
      const etc: MonthlyCalculation[] = [
        mc('2026-01', 1000, 10, 1000, 10),
        mc('2026-02', 2000, 20, 3000, 30),
        mc('2026-03', 1500, 15, 4500, 45),
      ];
      const result = buildChartData(undefined, etc, undefined, '2026-01-15', 5000);
      expect(result).toHaveLength(3);
      expect(result[0].cumulativeCost).toBe(6000);  // 5000 + 1000
      expect(result[2].cumulativeCost).toBe(9500);  // 5000 + 4500
      expect(result.every((p) => p.segment === 'forecast')).toBe(true);
      expect(result.every((p) => p.historicalCost === 0)).toBe(true);
      expect(result[0].forecastCost).toBe(1000);
      expect(result[2].forecastCost).toBe(1500);
    });
  });

  describe('historical mode — bucket-only (first reforecast scenario)', () => {
    it('cutoff Mar 7, actualCost $5k, no stored entries → Mar bar STACKS $5k actual + $17k forecast', () => {
      const etc: MonthlyCalculation[] = [
        mc('2026-03', 17000, 170, 17000, 170),
        mc('2026-04', 23000, 230, 40000, 400),
        mc('2026-05', 22000, 220, 62000, 620),
      ];
      const result = buildChartData(undefined, etc, '2026-03-07', '2026-03-01', 5000);

      expect(result).toHaveLength(3);
      // Mar: stacked — $5k historical (teal) + $17k forecast (blue) = $22k total
      expect(result[0]).toMatchObject({
        month: '2026-03',
        cost: 22000,
        historicalCost: 5000,
        forecastCost: 17000,
        segment: 'blended',
      });
      // Apr/May: pure forecast (no historical portion)
      expect(result[1]).toMatchObject({
        month: '2026-04',
        cost: 23000,
        historicalCost: 0,
        forecastCost: 23000,
        segment: 'forecast',
      });
      expect(result[2]).toMatchObject({
        month: '2026-05',
        cost: 22000,
        historicalCost: 0,
        forecastCost: 22000,
        segment: 'forecast',
      });

      // Cumulative trajectory: $22k → $45k → $67k
      expect(result[0].cumulativeCost).toBe(22000);
      expect(result[2].cumulativeCost).toBe(67000);
    });

    it('end-of-month cutoff (no ETC remainder) renders bucket-only as historical, no forecast portion', () => {
      const etc: MonthlyCalculation[] = [
        mc('2026-03', 0, 0, 0, 0),
        mc('2026-04', 23000, 230, 23000, 230),
      ];
      const result = buildChartData(undefined, etc, '2026-03-31', '2026-03-01', 20000);

      expect(result[0]).toMatchObject({
        month: '2026-03',
        cost: 20000,
        historicalCost: 20000,
        forecastCost: 0,
        segment: 'historical',
      });
      expect(result[1]).toMatchObject({
        month: '2026-04',
        cost: 23000,
        historicalCost: 0,
        forecastCost: 23000,
        segment: 'forecast',
      });
    });
  });

  describe('historical mode — with stored entries', () => {
    it('past months pure-historical; cutoff month is stacked; future is pure-forecast', () => {
      const entries: HistoricalCostEntry[] = [
        { month: '2026-02', cost: 20000, hours: 0 },
      ];
      const etc: MonthlyCalculation[] = [
        mc('2026-01', 0, 0, 0, 0),
        mc('2026-02', 0, 0, 0, 0),
        mc('2026-03', 4000, 40, 4000, 40),
        mc('2026-04', 6000, 60, 10000, 100),
        mc('2026-05', 6000, 60, 16000, 160),
      ];
      const result = buildChartData(entries, etc, '2026-03-15', '2026-01-15', 50000);

      expect(result[0]).toMatchObject({ month: '2026-01', historicalCost: 0, forecastCost: 0, segment: 'historical' });
      expect(result[1]).toMatchObject({ month: '2026-02', historicalCost: 20000, forecastCost: 0, segment: 'historical' });
      // Mar: bucket $30k + ETC $4k = $34k stacked
      expect(result[2]).toMatchObject({ month: '2026-03', historicalCost: 30000, forecastCost: 4000, segment: 'blended' });
      expect(result[3]).toMatchObject({ month: '2026-04', historicalCost: 0, forecastCost: 6000, segment: 'forecast' });
      expect(result[4]).toMatchObject({ month: '2026-05', historicalCost: 0, forecastCost: 6000, segment: 'forecast' });
    });

    it('historicalCost + forecastCost always sum to cost', () => {
      const entries: HistoricalCostEntry[] = [
        { month: '2026-02', cost: 20000, hours: 0 },
      ];
      const etc: MonthlyCalculation[] = [
        mc('2026-01', 0, 0, 0, 0),
        mc('2026-02', 0, 0, 0, 0),
        mc('2026-03', 4000, 40, 4000, 40),
        mc('2026-04', 6000, 60, 10000, 100),
      ];
      const result = buildChartData(entries, etc, '2026-03-15', '2026-01-15', 50000);
      for (const p of result) {
        expect(p.historicalCost + p.forecastCost).toBe(p.cost);
      }
    });

    it('cumulativeCost is monotonically non-decreasing', () => {
      const entries: HistoricalCostEntry[] = [
        { month: '2026-02', cost: 20000, hours: 0 },
      ];
      const etc: MonthlyCalculation[] = [
        mc('2026-01', 0, 0, 0, 0),
        mc('2026-02', 0, 0, 0, 0),
        mc('2026-03', 4000, 40, 4000, 40),
        mc('2026-04', 6000, 60, 10000, 100),
      ];
      const result = buildChartData(entries, etc, '2026-03-15', '2026-01-15', 50000);
      for (let i = 1; i < result.length; i++) {
        expect(result[i].cumulativeCost).toBeGreaterThanOrEqual(result[i - 1].cumulativeCost);
      }
    });

    it('output is sorted ascending by month', () => {
      const entries: HistoricalCostEntry[] = [
        { month: '2026-02', cost: 1000, hours: 0 },
      ];
      const etc: MonthlyCalculation[] = [
        mc('2026-04', 4000, 40, 4000, 40),
        mc('2026-01', 0, 0, 0, 0),
        mc('2026-03', 2000, 20, 6000, 60),
        mc('2026-02', 0, 0, 0, 0),
      ];
      const result = buildChartData(entries, etc, '2026-03-15', '2026-01-15', 5000);
      expect(result.map((p) => p.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    });
  });

  describe('defensive fallback', () => {
    it('no actualsThroughDate + non-empty historicalCosts → falls back to legacy', () => {
      const entries: HistoricalCostEntry[] = [{ month: '2026-01', cost: 999, hours: 0 }];
      const etc: MonthlyCalculation[] = [mc('2026-01', 1000, 10, 1000, 10)];
      const result = buildChartData(entries, etc, undefined, '2026-01-15', 500);
      expect(result).toHaveLength(1);
      expect(result[0].cumulativeCost).toBe(1500);
      expect(result[0].segment).toBe('forecast');
      expect(result[0].historicalCost).toBe(0);
      expect(result[0].forecastCost).toBe(1000);
    });
  });
});
