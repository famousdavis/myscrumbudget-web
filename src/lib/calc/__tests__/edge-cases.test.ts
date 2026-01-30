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
    reforecastDate: '2026-06-01',
    allocations: [],
    productivityWindows: [],
    actualCost: 0,
    baselineBudget: 1000000,
    ...overrides,
  };
}

const TEAM: TeamMember[] = [{ id: 'a1', name: 'Dev 1', role: 'Dev' }];

describe('Edge Cases', () => {
  describe('Zero-budget project', () => {
    it('calculates metrics without division-by-zero errors', () => {
      const rf = makeReforecast({
        allocations: [{ memberId: 'a1', month: '2026-06', allocation: 0.5 }],
        actualCost: 0,
        baselineBudget: 0,
      });
      const project = makeProject({
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
        actualCost: 0,
        baselineBudget: 50000,
      });
      const project = makeProject({
        startDate: '2026-06-01',
        endDate: '2026-06-30',
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

  describe('EAC uses reforecast.actualCost', () => {
    it('EAC = reforecast.actualCost + ETC', () => {
      const rf = makeReforecast({
        allocations: [{ memberId: 'a1', month: '2026-06', allocation: 1.0 }],
        actualCost: 50000,
        baselineBudget: 100000,
      });
      const project = makeProject({
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const metrics = calculateProjectMetrics(project, SETTINGS, TEAM);
      // June 2026 full month: 22 workdays * 8 hrs = 176 hrs
      // ETC = 1.0 * 100 * 176 = 17,600
      expect(metrics.etc).toBe(17_600);
      expect(metrics.eac).toBe(50000 + 17_600);
    });

    it('different reforecasts produce different EAC values', () => {
      const rf1 = makeReforecast({
        id: 'rf1',
        allocations: [{ memberId: 'a1', month: '2026-06', allocation: 1.0 }],
        actualCost: 10000,
        baselineBudget: 100000,
      });
      const rf2 = makeReforecast({
        id: 'rf2',
        name: 'Q3',
        allocations: [{ memberId: 'a1', month: '2026-06', allocation: 1.0 }],
        actualCost: 90000,
        baselineBudget: 100000,
      });
      const project = makeProject({
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        reforecasts: [rf1, rf2],
        activeReforecastId: 'rf1',
      });

      const metrics1 = calculateProjectMetrics(project, SETTINGS, TEAM);
      expect(metrics1.eac).toBe(10000 + 17_600);

      // Switch active reforecast
      const project2 = { ...project, activeReforecastId: 'rf2' };
      const metrics2 = calculateProjectMetrics(project2, SETTINGS, TEAM);
      expect(metrics2.eac).toBe(90000 + 17_600);
    });
  });

  describe('No-reforecast fallback', () => {
    it('returns zeroed metrics when project has no reforecasts', () => {
      const project = makeProject({
        reforecasts: [],
        activeReforecastId: null,
      });

      const metrics = calculateProjectMetrics(project, SETTINGS, TEAM);
      expect(metrics.etc).toBe(0);
      expect(metrics.eac).toBe(0);
      expect(metrics.variance).toBe(0);
      expect(metrics.budgetRatio).toBe(0);
      expect(metrics.totalHours).toBe(0);
      expect(metrics.monthlyData).toEqual([]);
    });
  });

  describe('Different baselineBudgets produce different variance', () => {
    it('switching reforecasts with different budgets changes variance and budgetRatio', () => {
      const rf1 = makeReforecast({
        id: 'rf1',
        allocations: [{ memberId: 'a1', month: '2026-06', allocation: 1.0 }],
        actualCost: 0,
        baselineBudget: 100000,
      });
      const rf2 = makeReforecast({
        id: 'rf2',
        name: 'Q3',
        allocations: [{ memberId: 'a1', month: '2026-06', allocation: 1.0 }],
        actualCost: 0,
        baselineBudget: 500000,
      });
      const project = makeProject({
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        reforecasts: [rf1, rf2],
        activeReforecastId: 'rf1',
      });

      const metrics1 = calculateProjectMetrics(project, SETTINGS, TEAM);
      // ETC = 17,600, EAC = 17,600, variance = 17,600 - 100,000 = -82,400
      expect(metrics1.variance).toBe(metrics1.eac - 100000);
      expect(metrics1.budgetRatio).toBe(100000 / metrics1.eac);

      // Switch to rf2 (budget = 500,000)
      const project2 = { ...project, activeReforecastId: 'rf2' };
      const metrics2 = calculateProjectMetrics(project2, SETTINGS, TEAM);
      // Same ETC/EAC, but variance = 17,600 - 500,000 = -482,400
      expect(metrics2.variance).toBe(metrics2.eac - 500000);
      expect(metrics2.budgetRatio).toBe(500000 / metrics2.eac);

      // Key assertion: different budgets → different variance
      expect(metrics1.variance).not.toBe(metrics2.variance);
      expect(metrics1.budgetRatio).not.toBe(metrics2.budgetRatio);
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
