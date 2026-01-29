import { describe, it, expect } from 'vitest';
import {
  calculateETC,
  calculateEAC,
  calculateVariance,
  calculateVariancePercent,
  calculateBudgetPerformanceRatio,
  calculateWeeklyBurnRate,
  getActiveMonths,
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
  it('matches Excel formula: ETC / ROUND(days / 7)', () => {
    // 14 active months from June 15, 2026
    // EDATE(2026-06-15, 14) = 2027-08-15
    // 426 days / 7 = 60.857 → round = 61
    const activeMonths = [
      '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11',
      '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05',
      '2027-06', '2027-07',
    ];
    const rate = calculateWeeklyBurnRate(856_656, new Date('2026-06-15'), activeMonths);
    expect(rate).toBeCloseTo(14_043.54, 1);
  });

  it('returns 0 with no active months', () => {
    expect(calculateWeeklyBurnRate(100_000, new Date('2026-06-15'), [])).toBe(0);
  });

  it('returns 0 with zero ETC', () => {
    expect(calculateWeeklyBurnRate(0, new Date('2026-06-15'), ['2026-06'])).toBe(0);
  });

  it('handles single active month', () => {
    const rate = calculateWeeklyBurnRate(10_000, new Date('2026-06-15'), ['2026-06']);
    // EDATE(2026-06-15, 1) = 2026-07-15 → 30 days → round(30/7) = 4 weeks
    expect(rate).toBeCloseTo(10_000 / 4, 0);
  });
});

describe('getActiveMonths', () => {
  it('returns months with non-zero allocations', () => {
    const allocs = [
      { memberId: 'tm1', month: '2026-06', allocation: 0.5 },
      { memberId: 'tm1', month: '2026-08', allocation: 0.25 },
    ];
    const active = getActiveMonths(allocs);
    expect(active).toContain('2026-06');
    expect(active).toContain('2026-08');
    expect(active).toHaveLength(2);
  });

  it('excludes months with zero allocation', () => {
    const allocs = [
      { memberId: 'tm1', month: '2026-06', allocation: 0 },
      { memberId: 'tm1', month: '2026-07', allocation: 0.5 },
    ];
    const active = getActiveMonths(allocs);
    expect(active).not.toContain('2026-06');
    expect(active).toContain('2026-07');
  });

  it('deduplicates months with multiple members', () => {
    const allocs = [
      { memberId: 'tm1', month: '2026-06', allocation: 0.5 },
      { memberId: 'tm2', month: '2026-06', allocation: 0.3 },
    ];
    const active = getActiveMonths(allocs);
    expect(active).toHaveLength(1);
    expect(active).toContain('2026-06');
  });

  it('returns empty for no allocations', () => {
    expect(getActiveMonths([])).toHaveLength(0);
  });
});

describe('generateMonthlyCalculations', () => {
  it('builds cumulative totals', () => {
    const months = ['2026-06', '2026-07', '2026-08'];
    const costs = new Map([['2026-06', 1_000], ['2026-07', 2_000], ['2026-08', 3_000]]);
    const hours = new Map([['2026-06', 100], ['2026-07', 200], ['2026-08', 300]]);
    const result = generateMonthlyCalculations(months, costs, hours);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      month: '2026-06', cost: 1_000, hours: 100,
      cumulativeCost: 1_000, cumulativeHours: 100,
    });
    expect(result[1]).toEqual({
      month: '2026-07', cost: 2_000, hours: 200,
      cumulativeCost: 3_000, cumulativeHours: 300,
    });
    expect(result[2]).toEqual({
      month: '2026-08', cost: 3_000, hours: 300,
      cumulativeCost: 6_000, cumulativeHours: 600,
    });
  });

  it('defaults to 0 for missing months in maps', () => {
    const months = ['2026-06'];
    const costs = new Map<string, number>();
    const hours = new Map<string, number>();
    const result = generateMonthlyCalculations(months, costs, hours);
    expect(result[0].cost).toBe(0);
    expect(result[0].hours).toBe(0);
  });
});
