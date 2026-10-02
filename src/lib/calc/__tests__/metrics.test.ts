// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import {
  calculateETC,
  calculateEAC,
  calculateVariance,
  calculateVariancePercent,
  calculateBudgetPerformanceRatio,
  calculateWeeklyBurnRate,
  generateMonthlyCalculations,
} from '../metrics';

describe('calculateETC', () => {
  it('sums all monthly costs', () => {
    expect(calculateETC([10_000, 20_000, 15_000])).toBe(45_000);
  });

  it('returns 0 for empty array', () => {
    expect(calculateETC([])).toBe(0);
  });

  it('handles single value', () => {
    expect(calculateETC([42_000])).toBe(42_000);
  });
});

describe('calculateEAC', () => {
  it('returns actualCost + ETC', () => {
    expect(calculateEAC(200_000, 856_656)).toBe(1_056_656);
  });

  it('returns just ETC when no actual cost', () => {
    expect(calculateEAC(0, 500_000)).toBe(500_000);
  });
});

describe('calculateVariance', () => {
  it('positive when over budget (EAC > baseline)', () => {
    expect(calculateVariance(1_100_000, 1_000_000)).toBe(100_000);
  });

  it('negative when under budget (EAC < baseline)', () => {
    expect(calculateVariance(900_000, 1_000_000)).toBe(-100_000);
  });

  it('zero when on budget', () => {
    expect(calculateVariance(1_000_000, 1_000_000)).toBe(0);
  });
});

describe('calculateVariancePercent', () => {
  it('calculates percentage over budget', () => {
    expect(calculateVariancePercent(1_100_000, 1_000_000)).toBe(10);
  });

  it('calculates percentage under budget', () => {
    expect(calculateVariancePercent(900_000, 1_000_000)).toBe(-10);
  });

  it('returns 0 when baseline is 0', () => {
    expect(calculateVariancePercent(1_000, 0)).toBe(0);
  });
});

describe('calculateBudgetPerformanceRatio', () => {
  it('returns > 1 when under budget', () => {
    expect(calculateBudgetPerformanceRatio(1_000_000, 900_000)).toBeCloseTo(1.111, 2);
  });

  it('returns < 1 when over budget', () => {
    expect(calculateBudgetPerformanceRatio(1_000_000, 1_200_000)).toBeCloseTo(0.833, 2);
  });

  it('returns 1 when on budget', () => {
    expect(calculateBudgetPerformanceRatio(1_000_000, 1_000_000)).toBe(1);
  });

  it('returns 0 when EAC is 0', () => {
    expect(calculateBudgetPerformanceRatio(1_000_000, 0)).toBe(0);
  });
});

describe('calculateWeeklyBurnRate', () => {
  // workDays: the full-capacity working days the ETC covers, as the engine
  // counts them (holidays out, productivity-weighted, staffed months only).
  // Weeks of work = workDays ÷ 5. Since v0.44.0.

  it('divides ETC by the weeks of work: working days ÷ 5', () => {
    // 66 working days = 13.2 weeks.
    expect(calculateWeeklyBurnRate(52_800, 66)).toBeCloseTo(4_000, 9);
  });

  it('accepts fractional days from partial productivity', () => {
    // 79.5 days (a week at 50%) = 15.9 weeks.
    expect(calculateWeeklyBurnRate(63_600, 79.5)).toBeCloseTo(4_000, 9);
  });

  it('counts a part week by its working days, with no one-week floor', () => {
    expect(calculateWeeklyBurnRate(1_600, 2)).toBeCloseTo(4_000, 9);
  });

  it('returns 0 with zero ETC', () => {
    expect(calculateWeeklyBurnRate(0, 66)).toBe(0);
  });

  it('returns 0, not Infinity, when there are no working days', () => {
    expect(calculateWeeklyBurnRate(1_000, 0)).toBe(0);
    expect(calculateWeeklyBurnRate(1_000, -1)).toBe(0);
  });
});

describe('generateMonthlyCalculations', () => {
  it('builds cumulative totals and carries each month\'s productivity factor', () => {
    const months = ['2026-06', '2026-07', '2026-08'];
    const costs = new Map([['2026-06', 1_000], ['2026-07', 2_000], ['2026-08', 3_000]]);
    const hours = new Map([['2026-06', 100], ['2026-07', 200], ['2026-08', 300]]);
    const productivity = new Map([['2026-06', 1], ['2026-07', 0.75], ['2026-08', 1]]);
    const result = generateMonthlyCalculations(months, costs, hours, productivity);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      month: '2026-06', cost: 1_000, hours: 100,
      cumulativeCost: 1_000, cumulativeHours: 100, productivityFactor: 1,
    });
    expect(result[1]).toEqual({
      month: '2026-07', cost: 2_000, hours: 200,
      cumulativeCost: 3_000, cumulativeHours: 300, productivityFactor: 0.75,
    });
    expect(result[2]).toEqual({
      month: '2026-08', cost: 3_000, hours: 300,
      cumulativeCost: 6_000, cumulativeHours: 600, productivityFactor: 1,
    });
  });

  it('defaults to 0 cost/hours and a factor of 1 for months missing from the maps', () => {
    const months = ['2026-06'];
    const result = generateMonthlyCalculations(months, new Map(), new Map(), new Map());
    expect(result[0].cost).toBe(0);
    expect(result[0].hours).toBe(0);
    expect(result[0].productivityFactor).toBe(1);
  });
});
