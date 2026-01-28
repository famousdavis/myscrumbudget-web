import { describe, it, expect } from 'vitest';
import {
  buildAllocationMap,
  getAllocation,
} from '@/lib/calc/allocationMap';
import type { MonthlyAllocation } from '@/types/domain';

describe('buildAllocationMap', () => {
  it('returns empty map for no allocations', () => {
    const map = buildAllocationMap([]);
    expect(map.size).toBe(0);
  });

  it('builds map from single allocation', () => {
    const allocations: MonthlyAllocation[] = [
      { memberId: 'tm1', month: '2025-01', allocation: 0.5 },
    ];
    const map = buildAllocationMap(allocations);
    expect(getAllocation(map, '2025-01', 'tm1')).toBe(0.5);
  });

  it('builds map from multiple allocations across months', () => {
    const allocations: MonthlyAllocation[] = [
      { memberId: 'tm1', month: '2025-01', allocation: 0.25 },
      { memberId: 'tm1', month: '2025-02', allocation: 0.5 },
      { memberId: 'tm2', month: '2025-01', allocation: 1.0 },
      { memberId: 'tm2', month: '2025-02', allocation: 0.75 },
    ];
    const map = buildAllocationMap(allocations);

    expect(getAllocation(map, '2025-01', 'tm1')).toBe(0.25);
    expect(getAllocation(map, '2025-02', 'tm1')).toBe(0.5);
    expect(getAllocation(map, '2025-01', 'tm2')).toBe(1.0);
    expect(getAllocation(map, '2025-02', 'tm2')).toBe(0.75);
  });

  it('returns 0 for missing allocation', () => {
    const map = buildAllocationMap([
      { memberId: 'tm1', month: '2025-01', allocation: 0.5 },
    ]);
    expect(getAllocation(map, '2025-01', 'tm99')).toBe(0);
    expect(getAllocation(map, '2025-03', 'tm1')).toBe(0);
  });

  it('handles duplicate entries by keeping last value', () => {
    const allocations: MonthlyAllocation[] = [
      { memberId: 'tm1', month: '2025-01', allocation: 0.25 },
      { memberId: 'tm1', month: '2025-01', allocation: 0.75 },
    ];
    const map = buildAllocationMap(allocations);
    // Last write wins since Map.set overwrites
    expect(getAllocation(map, '2025-01', 'tm1')).toBe(0.75);
  });
});
