import { describe, it, expect } from 'vitest';
import { createBaselineReforecast, createNewReforecast } from '../reforecast';
import type { Reforecast } from '@/types/domain';

describe('createBaselineReforecast', () => {
  it('creates a Baseline reforecast with correct defaults', () => {
    const rf = createBaselineReforecast('2026-06-15');
    expect(rf.name).toBe('Baseline');
    expect(rf.startDate).toBe('2026-06');
    expect(rf.allocations).toEqual([]);
    expect(rf.productivityWindows).toEqual([]);
    expect(rf.actualCost).toBe(0);
    expect(rf.id).toBeTruthy();
    expect(rf.createdAt).toBeTruthy();
  });

  it('slices startDate to YYYY-MM format', () => {
    expect(createBaselineReforecast('2027-03-20').startDate).toBe('2027-03');
    expect(createBaselineReforecast('2026-12').startDate).toBe('2026-12');
  });

  it('generates unique IDs across calls', () => {
    const rf1 = createBaselineReforecast('2026-06-15');
    const rf2 = createBaselineReforecast('2026-06-15');
    expect(rf1.id).not.toBe(rf2.id);
  });
});

describe('createNewReforecast', () => {
  it('creates an empty reforecast when no source is provided', () => {
    const rf = createNewReforecast('Q3 Reforecast', '2026-06');
    expect(rf.name).toBe('Q3 Reforecast');
    expect(rf.startDate).toBe('2026-06');
    expect(rf.allocations).toEqual([]);
    expect(rf.productivityWindows).toEqual([]);
    expect(rf.actualCost).toBe(0);
  });

  it('copies allocations from source reforecast', () => {
    const source: Reforecast = {
      id: 'src',
      name: 'Baseline',
      createdAt: '2026-06-01T00:00:00Z',
      startDate: '2026-06',
      allocations: [
        { memberId: 'a1', month: '2026-06', allocation: 0.5 },
        { memberId: 'a2', month: '2026-07', allocation: 0.8 },
      ],
      productivityWindows: [
        { id: 'pw1', startDate: '2026-12-01', endDate: '2026-12-31', factor: 0.5 },
      ],
      actualCost: 75000,
    };

    const rf = createNewReforecast('Copy', '2026-06', source);
    expect(rf.allocations).toHaveLength(2);
    expect(rf.allocations[0]).toEqual(source.allocations[0]);
    expect(rf.productivityWindows).toHaveLength(1);
    expect(rf.productivityWindows[0].factor).toBe(0.5);
    expect(rf.actualCost).toBe(75000);
  });

  it('deep-clones allocations (source is not mutated)', () => {
    const source: Reforecast = {
      id: 'src',
      name: 'Baseline',
      createdAt: '2026-06-01T00:00:00Z',
      startDate: '2026-06',
      allocations: [
        { memberId: 'a1', month: '2026-06', allocation: 0.5 },
      ],
      productivityWindows: [],
      actualCost: 0,
    };

    const rf = createNewReforecast('Copy', '2026-06', source);
    rf.allocations[0].allocation = 0.99;
    expect(source.allocations[0].allocation).toBe(0.5);
  });

  it('assigns new IDs to copied productivity windows', () => {
    const source: Reforecast = {
      id: 'src',
      name: 'Baseline',
      createdAt: '2026-06-01T00:00:00Z',
      startDate: '2026-06',
      allocations: [],
      productivityWindows: [
        { id: 'pw1', startDate: '2026-12-01', endDate: '2026-12-31', factor: 0.5 },
      ],
      actualCost: 0,
    };

    const rf = createNewReforecast('Copy', '2026-06', source);
    expect(rf.productivityWindows[0].id).not.toBe('pw1');
    expect(rf.productivityWindows[0].factor).toBe(0.5);
  });

  it('generates unique IDs across calls', () => {
    const rf1 = createNewReforecast('A', '2026-06');
    const rf2 = createNewReforecast('B', '2026-06');
    expect(rf1.id).not.toBe(rf2.id);
  });

  it('defaults actualCost to 0 when source is undefined', () => {
    const rf = createNewReforecast('Fresh', '2026-06', undefined);
    expect(rf.actualCost).toBe(0);
  });
});
