/**
 * Regression Tests — MyScrumBudget Calculation Engine
 *
 * These tests verify that the workday-based calculation engine produces
 * consistent, correct results. Originally derived from Excel parity tests,
 * now using workday-based hours instead of fixed 160 hours/month.
 *
 * If PMs lose trust in the math, they go back to Excel.
 * These tests are the foundation of that trust.
 */

import { describe, it, expect } from 'vitest';
import { SPREADSHEET_FIXTURE } from './fixtures/spreadsheet-1.5';
import { buildAllocationMap } from '../allocationMap';
import {
  getHourlyRate,
  calculateMemberMonthlyCost,
  calculateMemberMonthlyHours,
  calculateTotalMonthlyCost,
  calculateTotalMonthlyHours,
} from '../costs';
import {
  calculateETC,
  calculateEAC,
  calculateVariance,
  calculateWeeklyBurnRate,
  getActiveMonths,
  generateMonthlyCalculations,
} from '../metrics';
import { calculateNPV } from '../npv';
import { calculateProjectMetrics } from '../index';
import { getMonthlyWorkHours } from '@/lib/utils/dates';

const FIX = SPREADSHEET_FIXTURE;
const allocationMap = buildAllocationMap(FIX.allocations);

describe('Regression Tests — Workday-Based Calculation Engine', () => {
  describe('Individual Member Calculations', () => {
    it('Aaliyah month 1 cost = $1,800 (BA, $75/hr, 25%, 96 avail hrs)', () => {
      const rate = getHourlyRate('BA', FIX.settings);
      const availableHours = FIX.expected.monthlyAvailableHours[0]; // 96
      const cost = calculateMemberMonthlyCost(0.25, rate, availableHours);
      expect(cost).toBe(FIX.expected.aaliyahMonth1Cost);
    });

    it('Aaliyah month 1 hours = 24', () => {
      const availableHours = FIX.expected.monthlyAvailableHours[0]; // 96
      const hours = calculateMemberMonthlyHours(0.25, availableHours);
      expect(hours).toBe(FIX.expected.aaliyahMonth1Hours);
    });

    it('Sofia month 1 cost (IT-Security, $90/hr, 13%, 96 avail hrs)', () => {
      const rate = getHourlyRate('IT-Security', FIX.settings);
      const availableHours = FIX.expected.monthlyAvailableHours[0];
      const cost = calculateMemberMonthlyCost(0.13, rate, availableHours);
      expect(cost).toBeCloseTo(90 * 96 * 0.13, 2);
    });

    it('Ethan month 2 cost (IT-SoftEng, $100/hr, 80%, 184 avail hrs)', () => {
      const rate = getHourlyRate('IT-SoftEng', FIX.settings);
      const availableHours = FIX.expected.monthlyAvailableHours[1]; // 184
      const cost = calculateMemberMonthlyCost(0.80, rate, availableHours);
      expect(cost).toBe(100 * 184 * 0.80);
    });

    it('Luca month 1 cost (Manager, $150/hr, 3%, 96 avail hrs)', () => {
      const rate = getHourlyRate('Manager', FIX.settings);
      const availableHours = FIX.expected.monthlyAvailableHours[0];
      const cost = calculateMemberMonthlyCost(0.03, rate, availableHours);
      expect(cost).toBe(150 * 96 * 0.03);
    });
  });

  describe('Monthly Cost Totals', () => {
    FIX.months.forEach((month, i) => {
      it(`month ${i + 1} (${month}) cost = $${FIX.expected.totalMonthlyCosts[i].toLocaleString()}`, () => {
        const availableHours = getMonthlyWorkHours(
          month, FIX.project.startDate, FIX.project.endDate,
        );
        const cost = calculateTotalMonthlyCost(
          month, allocationMap, FIX.teamMembers, FIX.settings, availableHours,
        );
        expect(cost).toBeCloseTo(FIX.expected.totalMonthlyCosts[i], 2);
      });
    });
  });

  describe('Monthly Hours Totals', () => {
    FIX.months.forEach((month, i) => {
      it(`month ${i + 1} (${month}) hours = ${FIX.expected.totalMonthlyHours[i]}`, () => {
        const availableHours = getMonthlyWorkHours(
          month, FIX.project.startDate, FIX.project.endDate,
        );
        const hours = calculateTotalMonthlyHours(
          month, allocationMap, availableHours,
        );
        expect(hours).toBeCloseTo(FIX.expected.totalMonthlyHours[i], 1);
      });
    });
  });

  describe('Cumulative Calculations', () => {
    it('cumulative costs match expected values', () => {
      const monthlyCosts = new Map(
        FIX.months.map((m, i) => [m, FIX.expected.totalMonthlyCosts[i]]),
      );
      const monthlyHours = new Map(
        FIX.months.map((m, i) => [m, FIX.expected.totalMonthlyHours[i]]),
      );
      const calcs = generateMonthlyCalculations(FIX.months, monthlyCosts, monthlyHours);
      calcs.forEach((calc, i) => {
        expect(calc.cumulativeCost).toBeCloseTo(FIX.expected.cumulativeCosts[i], 1);
      });
    });

    it('cumulative hours match expected values', () => {
      const monthlyCosts = new Map(
        FIX.months.map((m, i) => [m, FIX.expected.totalMonthlyCosts[i]]),
      );
      const monthlyHours = new Map(
        FIX.months.map((m, i) => [m, FIX.expected.totalMonthlyHours[i]]),
      );
      const calcs = generateMonthlyCalculations(FIX.months, monthlyCosts, monthlyHours);
      calcs.forEach((calc, i) => {
        expect(calc.cumulativeHours).toBeCloseTo(FIX.expected.cumulativeHours[i], 1);
      });
    });
  });

  describe('Project Metrics', () => {
    it('ETC matches expected value', () => {
      const monthlyCosts = FIX.months.map((m, i) => {
        const availableHours = getMonthlyWorkHours(
          m, FIX.project.startDate, FIX.project.endDate,
        );
        return calculateTotalMonthlyCost(
          m, allocationMap, FIX.teamMembers, FIX.settings, availableHours,
        );
      });
      expect(calculateETC(monthlyCosts)).toBeCloseTo(FIX.expected.etc, 1);
    });

    it('EAC = AC + ETC', () => {
      expect(calculateEAC(FIX.project.actualCost, FIX.expected.etc))
        .toBeCloseTo(FIX.expected.eac, 1);
    });

    it('weekly burn rate matches expected value', () => {
      const activeMonths = getActiveMonths(FIX.allocations);
      const burnRate = calculateWeeklyBurnRate(
        FIX.expected.etc,
        new Date(FIX.project.startDate),
        activeMonths,
      );
      expect(burnRate).toBeCloseTo(FIX.expected.weeklyBurnRate, 2);
    });

    it('total hours matches expected value', () => {
      const monthlyHours = FIX.months.map((m) => {
        const availableHours = getMonthlyWorkHours(
          m, FIX.project.startDate, FIX.project.endDate,
        );
        return calculateTotalMonthlyHours(m, allocationMap, availableHours);
      });
      const total = monthlyHours.reduce((sum, h) => sum + h, 0);
      expect(total).toBeCloseTo(FIX.expected.totalHours, 0);
    });
  });

  describe('NPV (intentional divergence from Excel)', () => {
    // Excel uses 0.03 as per-period (monthly) rate
    // Our app uses 0.03 as annual rate → monthly = 0.0025
    // This divergence is intentional and documented.

    it('NPV uses annual-to-monthly conversion (0.03 / 12 = 0.0025)', () => {
      const monthlyCosts = FIX.months.map((m) => {
        const availableHours = getMonthlyWorkHours(
          m, FIX.project.startDate, FIX.project.endDate,
        );
        return calculateTotalMonthlyCost(
          m, allocationMap, FIX.teamMembers, FIX.settings, availableHours,
        );
      });
      const npv = calculateNPV(FIX.settings.discountRateAnnual, monthlyCosts);
      // With 0.25% monthly rate, NPV should be close to but slightly less than ETC
      expect(npv).toBeLessThan(FIX.expected.etc);
      expect(npv).toBeGreaterThan(FIX.expected.etc * 0.95);
    });
  });

  describe('Full Orchestrator', () => {
    it('calculateProjectMetrics produces correct aggregate results', () => {
      const project = {
        id: 'regression-test',
        name: 'Regression Test Project',
        startDate: FIX.project.startDate,
        endDate: FIX.project.endDate,
        baselineBudget: 1_000_000,
        assignments: FIX.teamMembers.map((m) => ({
          id: m.id,
          poolMemberId: m.id,
        })),
        reforecasts: [{
          id: 'rf-baseline',
          name: 'Baseline',
          createdAt: new Date().toISOString(),
          startDate: '2026-06',
          allocations: FIX.allocations,
          productivityWindows: [],
          actualCost: FIX.project.actualCost,
        }],
        activeReforecastId: 'rf-baseline',
      };

      const metrics = calculateProjectMetrics(project, FIX.settings, FIX.teamMembers);

      expect(metrics.etc).toBeCloseTo(FIX.expected.etc, 1);
      expect(metrics.eac).toBeCloseTo(FIX.expected.eac, 1);
      expect(metrics.weeklyBurnRate).toBeCloseTo(FIX.expected.weeklyBurnRate, 2);
      expect(metrics.totalHours).toBeCloseTo(FIX.expected.totalHours, 0);
      expect(metrics.variance).toBeCloseTo(FIX.expected.eac - 1_000_000, 1);
      expect(metrics.budgetRatio).toBeCloseTo(1_000_000 / FIX.expected.eac, 4);
      expect(metrics.monthlyData).toHaveLength(FIX.months.length);
    });
  });
});
