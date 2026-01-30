import { describe, it, expect } from 'vitest';
import { calculateProjectMetrics } from '../index';
import {
  calculateVariancePercent,
  calculateBudgetPerformanceRatio,
} from '../metrics';
import { getProductivityFactor } from '../productivity';
import type { Project, Settings, TeamMember, Reforecast } from '@/types/domain';

const SETTINGS: Settings = {
  discountRateAnnual: 0.03,
  laborRates: [{ role: 'Dev', hourlyRate: 100 }],
};

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Test',
    startDate: '2026-06-15',
    endDate: '2027-07-15',
    baselineBudget: 1000000,
    actualCost: 200000,
    assignments: [{ id: 'a1', poolMemberId: 'pm1' }],
    reforecasts: [],
    activeReforecastId: null,
    ...overrides,
  };
}

function makeReforecast(overrides: Partial<Reforecast> = {}): Reforecast {
  return {
    id: 'rf1',
    name: 'Baseline',
    createdAt: '2026-06-01T00:00:00Z',
    startDate: '2026-06',
    allocations: [],
    productivityWindows: [],
    ...overrides,
  };
}

const TEAM: TeamMember[] = [{ id: 'a1', name: 'Dev 1', role: 'Dev' }];

describe('Edge Cases', () => {
  describe('Zero-budget project', () => {
    it('calculates metrics without division-by-zero errors', () => {
      const rf = makeReforecast({
        allocations: [{ memberId: 'a1', month: '2026-06', allocation: 0.5 }],
      });
      const project = makeProject({
        baselineBudget: 0,
        actualCost: 0,
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const metrics = calculateProjectMetrics(project, SETTINGS, TEAM);
      expect(metrics.etc).toBeGreaterThan(0);
      expect(metrics.eac).toBeGreaterThan(0);
      expect(Number.isFinite(metrics.variance)).toBe(true);
      expect(Number.isFinite(metrics.budgetRatio)).toBe(true);
      expect(Number.isFinite(metrics.npv)).toBe(true);
    });

    it('variancePercent returns 0 when baseline is 0', () => {
      expect(calculateVariancePercent(5000, 0)).toBe(0);
      expect(calculateVariancePercent(0, 0)).toBe(0);
    });

    it('budgetRatio returns 0 when EAC is 0', () => {
      expect(calculateBudgetPerformanceRatio(100000, 0)).toBe(0);
    });

    it('budgetRatio returns 0 when both are 0', () => {
      expect(calculateBudgetPerformanceRatio(0, 0)).toBe(0);
    });
  });

  describe('Single-month project', () => {
    it('calculates metrics for a one-month project', () => {
      const rf = makeReforecast({
        allocations: [{ memberId: 'a1', month: '2026-06', allocation: 1.0 }],
      });
      const project = makeProject({
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        baselineBudget: 50000,
        actualCost: 0,
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const metrics = calculateProjectMetrics(project, SETTINGS, TEAM);
      expect(metrics.monthlyData).toHaveLength(1);
      // June 2026 (full month): 22 workdays * 8 hrs = 176 available hours
      // 1.0 allocation * 100 $/hr * 176 hrs = $17,600
      expect(metrics.etc).toBe(17_600);
      expect(metrics.totalHours).toBe(176);
    });
  });

  describe('Orphaned assignments', () => {
    it('ignores allocations referencing non-existent team members', () => {
      const rf = makeReforecast({
        allocations: [
          { memberId: 'a1', month: '2026-06', allocation: 0.5 },
          { memberId: 'orphan', month: '2026-06', allocation: 1.0 },
        ],
      });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      // Only 'a1' is in the team — orphan should not cause errors
      const metrics = calculateProjectMetrics(project, SETTINGS, TEAM);
      expect(Number.isFinite(metrics.etc)).toBe(true);
      // Cost should only reflect 'a1': 0.5 * 100 * 96 (12 workdays in Jun 15-30) = 4800
      expect(metrics.monthlyData[0].cost).toBe(4_800);
    });

    it('handles empty team with allocations', () => {
      const rf = makeReforecast({
        allocations: [{ memberId: 'a1', month: '2026-06', allocation: 1.0 }],
      });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      // No team members at all
      const metrics = calculateProjectMetrics(project, SETTINGS, []);
      expect(metrics.etc).toBe(0);
      expect(Number.isFinite(metrics.eac)).toBe(true);
    });
  });

  describe('Non-overlapping productivity windows', () => {
    const windows = [
      { id: 'w1', startDate: '2026-12-01', endDate: '2026-12-31', factor: 0.5 },
    ];

    it('returns 1.0 for months entirely outside all windows', () => {
      expect(getProductivityFactor('2026-06', windows)).toBe(1.0);
      expect(getProductivityFactor('2027-01', windows)).toBe(1.0);
      expect(getProductivityFactor('2026-11', windows)).toBe(1.0);
    });

    it('applies factor for month inside window', () => {
      expect(getProductivityFactor('2026-12', windows)).toBe(0.5);
    });

    it('handles multiple non-overlapping windows', () => {
      const multiWindows = [
        { id: 'w1', startDate: '2026-12-01', endDate: '2026-12-31', factor: 0.5 },
        { id: 'w2', startDate: '2027-03-01', endDate: '2027-03-31', factor: 0.75 },
      ];
      expect(getProductivityFactor('2026-12', multiWindows)).toBe(0.5);
      expect(getProductivityFactor('2027-01', multiWindows)).toBe(1.0);
      expect(getProductivityFactor('2027-02', multiWindows)).toBe(1.0);
      expect(getProductivityFactor('2027-03', multiWindows)).toBe(0.75);
    });

    it('returns 1.0 when no windows exist', () => {
      expect(getProductivityFactor('2026-06', [])).toBe(1.0);
    });
  });
});
