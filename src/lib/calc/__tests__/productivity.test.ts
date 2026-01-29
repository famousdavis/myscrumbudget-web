import { describe, it, expect } from 'vitest';
import { getProductivityFactor } from '../productivity';
import type { ProductivityWindow } from '@/types/domain';

describe('getProductivityFactor', () => {
  it('returns 1 when no windows defined', () => {
    expect(getProductivityFactor('2026-06', [])).toBe(1);
  });

  it('returns factor when month falls within a window', () => {
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-06-01', endDate: '2026-06-30', factor: 0.5 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBe(0.5);
  });

  it('returns 1 when month is outside all windows', () => {
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-12-01', endDate: '2026-12-31', factor: 0.5 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBe(1);
  });

  it('returns minimum factor when multiple windows overlap', () => {
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-06-01', endDate: '2026-06-30', factor: 0.8 },
      { id: 'w2', startDate: '2026-06-15', endDate: '2026-07-15', factor: 0.5 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBe(0.5);
  });

  it('handles window that spans the entire month', () => {
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-05-01', endDate: '2026-08-31', factor: 0.7 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBe(0.7);
  });

  it('handles window starting mid-month', () => {
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-06-20', endDate: '2026-07-10', factor: 0.6 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBe(0.6);
  });

  it('handles window ending mid-month', () => {
    const windows: ProductivityWindow[] = [
      { id: 'w1', startDate: '2026-05-15', endDate: '2026-06-10', factor: 0.7 },
    ];
    expect(getProductivityFactor('2026-06', windows)).toBe(0.7);
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
});
