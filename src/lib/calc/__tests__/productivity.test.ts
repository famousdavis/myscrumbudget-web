import { describe, it, expect } from 'vitest';
import { getProductivityFactor } from '../productivity';
import type { ProductivityWindow } from '@/types/domain';

describe('getProductivityFactor', () => {
  it('returns 1 when no windows defined', () => {
    expect(getProductivityFactor('2026-06', [])).toBe(1);
  });

  it('returns exact factor when window covers entire month', () => {
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-06-01', endDate: '2026-06-30', factor: 0.5 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBeCloseTo(0.5, 10);
  });

  it('returns 1 when month is outside all windows', () => {
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-12-01', endDate: '2026-12-31', factor: 0.5 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBe(1);
  });

  it('blends day-weighted factors when multiple windows overlap', () => {
    // June has 30 days
    // w1: Jun 1-30 at 0.8 (all 30 days)
    // w2: Jun 15-Jul 15 at 0.5 (Jun 15-30 = 16 days)
    // Days 1-14: min(0.8) = 0.8 → 14 * 0.8 = 11.2
    // Days 15-30: min(0.8, 0.5) = 0.5 → 16 * 0.5 = 8.0
    // Total: 19.2 / 30 = 0.64
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-06-01', endDate: '2026-06-30', factor: 0.8 },
      { id: 'w2', startDate: '2026-06-15', endDate: '2026-07-15', factor: 0.5 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBeCloseTo(0.64, 10);
  });

  it('returns exact factor when window spans beyond entire month', () => {
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-05-01', endDate: '2026-08-31', factor: 0.7 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBeCloseTo(0.7, 10);
  });

  it('blends correctly when window starts mid-month', () => {
    // June has 30 days, window covers Jun 20-Jul 10 → 11 days in June (20-30)
    // 19 days at 1.0 + 11 days at 0.6 = 25.6 / 30
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-06-20', endDate: '2026-07-10', factor: 0.6 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBeCloseTo(25.6 / 30, 10);
  });

  it('blends correctly when window ends mid-month', () => {
    // June has 30 days, window covers May 15-Jun 10 → 10 days in June (1-10)
    // 10 days at 0.7 + 20 days at 1.0 = 27 / 30
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-05-15', endDate: '2026-06-10', factor: 0.7 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBeCloseTo(27 / 30, 10);
  });

  it('returns 1 when window ends before month starts', () => {
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-05-01', endDate: '2026-05-31', factor: 0.5 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBe(1);
  });

  it('returns 1 when window starts after month ends', () => {
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-07-01', endDate: '2026-07-31', factor: 0.5 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBe(1);
  });

  it('handles a one-week 0% window correctly (partial month reduction)', () => {
    // June has 30 days, window covers Jun 1-5 at 0% → 5 days at 0.0
    // 5 days at 0.0 + 25 days at 1.0 = 25 / 30 ≈ 0.8333
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-06-01', endDate: '2026-06-05', factor: 0 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBeCloseTo(25 / 30, 10);
  });

  it('handles a single-day window', () => {
    // June has 30 days, window covers Jun 15 at 0% → 1 day at 0.0
    // 1 day at 0.0 + 29 days at 1.0 = 29 / 30
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-06-15', endDate: '2026-06-15', factor: 0 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBeCloseTo(29 / 30, 10);
  });

  it('handles February correctly (28 days)', () => {
    // Feb 2026 has 28 days, window covers Feb 1-7 at 50%
    // 7 days at 0.5 + 21 days at 1.0 = 24.5 / 28
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-02-01', endDate: '2026-02-07', factor: 0.5 },
    ];
    expect(getProductivityFactor('2026-02', windows)).toBeCloseTo(24.5 / 28, 10);
  });
});
