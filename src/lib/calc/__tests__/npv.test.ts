import { describe, it, expect } from 'vitest';
import { calculateNPV } from '../npv';

describe('calculateNPV', () => {
  it('discounts future cash flows using annual-to-monthly conversion', () => {
    // 12% annual → 1% monthly
    const npv = calculateNPV(0.12, [1_000, 1_000, 1_000]);
    // 1000/1.01 + 1000/1.01^2 + 1000/1.01^3
    const expected = 1000 / 1.01 + 1000 / 1.01 ** 2 + 1000 / 1.01 ** 3;
    expect(npv).toBeCloseTo(expected, 2);
  });

  it('returns 0 for empty cash flows', () => {
    expect(calculateNPV(0.03, [])).toBe(0);
  });

  it('handles zero discount rate (no discounting)', () => {
    const npv = calculateNPV(0, [1_000, 2_000, 3_000]);
    expect(npv).toBe(6_000);
  });

  it('handles single cash flow', () => {
    // 12% annual → 1% monthly
    const npv = calculateNPV(0.12, [10_000]);
    expect(npv).toBeCloseTo(10_000 / 1.01, 2);
  });

  it('uses annual / 12 conversion (3% annual = 0.25% monthly)', () => {
    const npv = calculateNPV(0.03, [10_000]);
    // monthlyRate = 0.03 / 12 = 0.0025
    expect(npv).toBeCloseTo(10_000 / 1.0025, 2);
  });

  it('larger discount rate produces smaller NPV', () => {
    const cashFlows = [50_000, 50_000, 50_000, 50_000];
    const npvLow = calculateNPV(0.03, cashFlows);
    const npvHigh = calculateNPV(0.12, cashFlows);
    expect(npvLow).toBeGreaterThan(npvHigh);
  });

  it('NPV is always less than undiscounted sum (when rate > 0)', () => {
    const cashFlows = [10_000, 20_000, 30_000];
    const npv = calculateNPV(0.06, cashFlows);
    const sum = cashFlows.reduce((a, b) => a + b, 0);
    expect(npv).toBeLessThan(sum);
  });
});
