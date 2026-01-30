import { describe, it, expect } from 'vitest';
import {
  getHourlyRate,
  calculateMemberMonthlyCost,
  calculateMemberMonthlyHours,
  calculateTotalMonthlyCost,
  calculateTotalMonthlyHours,
} from '../costs';
import { buildAllocationMap } from '../allocationMap';
import type { Settings, TeamMember } from '@/types/domain';

const SETTINGS: Settings = {
  discountRateAnnual: 0.03,
  laborRates: [
    { role: 'BA', hourlyRate: 75 },
    { role: 'IT-SoftEng', hourlyRate: 100 },
    { role: 'IT-Security', hourlyRate: 90 },
    { role: 'Manager', hourlyRate: 150 },
    { role: 'PMO', hourlyRate: 120 },
  ],
  holidays: [],
};

describe('getHourlyRate', () => {
  it('returns rate for known role', () => {
    expect(getHourlyRate('BA', SETTINGS)).toBe(75);
    expect(getHourlyRate('IT-SoftEng', SETTINGS)).toBe(100);
    expect(getHourlyRate('Manager', SETTINGS)).toBe(150);
  });

  it('returns 0 for unknown role', () => {
    expect(getHourlyRate('Unknown', SETTINGS)).toBe(0);
  });
});

describe('calculateMemberMonthlyCost', () => {
  it('calculates cost = rate * availableHours * allocation', () => {
    expect(calculateMemberMonthlyCost(0.5, 100, 160)).toBe(8_000);
  });

  it('calculates with 96 available hours: 75 * 96 * 0.25 = 1800', () => {
    expect(calculateMemberMonthlyCost(0.25, 75, 96)).toBe(1_800);
  });

  it('applies productivity factor', () => {
    expect(calculateMemberMonthlyCost(0.5, 100, 160, 0.75)).toBe(6_000);
  });

  it('returns 0 for zero allocation', () => {
    expect(calculateMemberMonthlyCost(0, 100, 160)).toBe(0);
  });

  it('returns 0 for zero productivity', () => {
    expect(calculateMemberMonthlyCost(0.5, 100, 160, 0)).toBe(0);
  });

  it('handles full allocation at full productivity', () => {
    expect(calculateMemberMonthlyCost(1.0, 100, 160, 1.0)).toBe(16_000);
  });
});

describe('calculateMemberMonthlyHours', () => {
  it('calculates hours = availableHours * allocation', () => {
    expect(calculateMemberMonthlyHours(0.5, 160)).toBe(80);
  });

  it('applies productivity factor', () => {
    expect(calculateMemberMonthlyHours(0.5, 160, 0.75)).toBe(60);
  });

  it('returns 0 for zero allocation', () => {
    expect(calculateMemberMonthlyHours(0, 160)).toBe(0);
  });

  it('handles full allocation', () => {
    expect(calculateMemberMonthlyHours(1.0, 160)).toBe(160);
  });
});

describe('calculateTotalMonthlyCost', () => {
  const members: TeamMember[] = [
    { id: 'tm1', name: 'A', role: 'BA' },
    { id: 'tm2', name: 'B', role: 'IT-SoftEng' },
  ];

  it('sums costs across all members for a month', () => {
    const map = buildAllocationMap([
      { memberId: 'tm1', month: '2026-06', allocation: 0.5 },
      { memberId: 'tm2', month: '2026-06', allocation: 1.0 },
    ]);
    // BA: 75*160*0.5=6000, SoftEng: 100*160*1.0=16000
    expect(calculateTotalMonthlyCost('2026-06', map, members, SETTINGS, 160)).toBe(22_000);
  });

  it('returns 0 for month with no allocations', () => {
    const map = buildAllocationMap([]);
    expect(calculateTotalMonthlyCost('2026-06', map, members, SETTINGS, 160)).toBe(0);
  });

  it('ignores members with zero allocation', () => {
    const map = buildAllocationMap([
      { memberId: 'tm1', month: '2026-06', allocation: 0 },
      { memberId: 'tm2', month: '2026-06', allocation: 0.5 },
    ]);
    expect(calculateTotalMonthlyCost('2026-06', map, members, SETTINGS, 160)).toBe(8_000);
  });

  it('applies productivity factor to all members', () => {
    const map = buildAllocationMap([
      { memberId: 'tm1', month: '2026-06', allocation: 0.5 },
      { memberId: 'tm2', month: '2026-06', allocation: 1.0 },
    ]);
    expect(calculateTotalMonthlyCost('2026-06', map, members, SETTINGS, 160, 0.5)).toBe(11_000);
  });
});

describe('calculateTotalMonthlyHours', () => {
  it('sums hours across all members for a month', () => {
    const map = buildAllocationMap([
      { memberId: 'tm1', month: '2026-06', allocation: 0.5 },
      { memberId: 'tm2', month: '2026-06', allocation: 1.0 },
    ]);
    // 160*0.5 + 160*1.0 = 240
    expect(calculateTotalMonthlyHours('2026-06', map, 160)).toBe(240);
  });

  it('returns 0 for month with no allocations', () => {
    const map = buildAllocationMap([]);
    expect(calculateTotalMonthlyHours('2026-06', map, 160)).toBe(0);
  });

  it('applies productivity factor', () => {
    const map = buildAllocationMap([
      { memberId: 'tm1', month: '2026-06', allocation: 1.0 },
    ]);
    expect(calculateTotalMonthlyHours('2026-06', map, 160, 0.5)).toBe(80);
  });
});
