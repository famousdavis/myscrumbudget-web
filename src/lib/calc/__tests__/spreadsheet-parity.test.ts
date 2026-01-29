/**
 * Spreadsheet Parity Tests - MyScrumBudget_1.5.xlsx
 *
 * These golden-file tests verify that our calculation engine produces
 * the same results as the original Excel spreadsheet.
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

const FIX = SPREADSHEET_FIXTURE;
const allocationMap = buildAllocationMap(FIX.allocations);

describe('Spreadsheet Parity - MyScrumBudget_1.5.xlsx', () => {
  describe('Individual Member Calculations', () => {
    it('Aaliyah month 1 cost = $3,000 (BA, $75/hr, 25%)', () => {
      const rate = getHourlyRate('BA', FIX.settings);
      const cost = calculateMemberMonthlyCost(0.25, rate, FIX.settings.hoursPerMonth);
      expect(cost).toBe(FIX.expected.aaliyahMonth1Cost);
    });

    it('Aaliyah month 1 hours = 40', () => {
      const hours = calculateMemberMonthlyHours(0.25, FIX.settings.hoursPerMonth);
      expect(hours).toBe(FIX.expected.aaliyahMonth1Hours);
    });

    it('Sofia month 1 cost = $1,872 (IT-Security, $90/hr, 13%)', () => {
      const rate = getHourlyRate('IT-Security', FIX.settings);
      const cost = calculateMemberMonthlyCost(0.13, rate, FIX.settings.hoursPerMonth);
      expect(cost).toBe(1_872);
    });

    it('Ethan month 2 cost = $12,800 (IT-SoftEng, $100/hr, 80%)', () => {
      const rate = getHourlyRate('IT-SoftEng', FIX.settings);
      const cost = calculateMemberMonthlyCost(0.80, rate, FIX.settings.hoursPerMonth);
      expect(cost).toBe(12_800);
    });

    it('Luca month 1 cost = $720 (Manager, $150/hr, 3%)', () => {
      const rate = getHourlyRate('Manager', FIX.settings);
      const cost = calculateMemberMonthlyCost(0.03, rate, FIX.settings.hoursPerMonth);
      expect(cost).toBe(720);
    });
  });

  describe('Monthly Cost Totals (Row 213)', () => {
    FIX.months.forEach((month, i) => {
      it(`month ${i + 1} (${month}) cost = $${FIX.expected.totalMonthlyCosts[i].toLocaleString()}`, () => {
        const cost = calculateTotalMonthlyCost(
          month, allocationMap, FIX.teamMembers, FIX.settings,
        );
        expect(cost).toBe(FIX.expected.totalMonthlyCosts[i]);
      });
    });
  });

  describe('Monthly Hours Totals (Row 315)', () => {
    FIX.months.forEach((month, i) => {
      it(`month ${i + 1} (${month}) hours = ${FIX.expected.totalMonthlyHours[i]}`, () => {
        const hours = calculateTotalMonthlyHours(
          month, allocationMap, FIX.settings,
        );
        expect(hours).toBeCloseTo(FIX.expected.totalMonthlyHours[i], 0);
      });
    });
  });

  describe('Cumulative Calculations', () => {
    it('cumulative costs match Excel Row 214', () => {
      const monthlyCosts = new Map(
        FIX.months.map((m, i) => [m, FIX.expected.totalMonthlyCosts[i]]),
      );
      const monthlyHours = new Map(
        FIX.months.map((m, i) => [m, FIX.expected.totalMonthlyHours[i]]),
      );
      const calcs = generateMonthlyCalculations(FIX.months, monthlyCosts, monthlyHours);
      calcs.forEach((calc, i) => {
        expect(calc.cumulativeCost).toBe(FIX.expected.cumulativeCosts[i]);
      });
    });

    it('cumulative hours match Excel Row 316', () => {
      const monthlyCosts = new Map(
        FIX.months.map((m, i) => [m, FIX.expected.totalMonthlyCosts[i]]),
      );
      const monthlyHours = new Map(
        FIX.months.map((m, i) => [m, FIX.expected.totalMonthlyHours[i]]),
      );
      const calcs = generateMonthlyCalculations(FIX.months, monthlyCosts, monthlyHours);
      calcs.forEach((calc, i) => {
        expect(calc.cumulativeHours).toBeCloseTo(FIX.expected.cumulativeHours[i], 0);
      });
    });
  });

  describe('Project Metrics', () => {
    it('ETC = $856,656 (Cell K3)', () => {
      const monthlyCosts = FIX.months.map(m =>
        calculateTotalMonthlyCost(m, allocationMap, FIX.teamMembers, FIX.settings),
      );
      expect(calculateETC(monthlyCosts)).toBe(FIX.expected.etc);
    });

    it('EAC = $1,056,656 (Cell K4 = AC + ETC)', () => {
      expect(calculateEAC(FIX.project.actualCost, FIX.expected.etc))
        .toBe(FIX.expected.eac);
    });

    it('weekly burn rate = $14,043.54 (Cell P2)', () => {
      const activeMonths = getActiveMonths(FIX.allocations);
      const burnRate = calculateWeeklyBurnRate(
        FIX.expected.etc,
        new Date(FIX.project.startDate),
        activeMonths,
      );
      expect(burnRate).toBeCloseTo(FIX.expected.weeklyBurnRate, 2);
    });

    it('total hours = 8,712 (Cell P4)', () => {
      const monthlyHours = FIX.months.map(m =>
        calculateTotalMonthlyHours(m, allocationMap, FIX.settings),
      );
      const total = monthlyHours.reduce((sum, h) => sum + h, 0);
      expect(total).toBeCloseTo(FIX.expected.totalHours, 0);
    });
  });

  describe('NPV (intentional divergence from Excel)', () => {
    // Excel uses 0.03 as per-period (monthly) rate → NPV = $690,379.25
    // Our app uses 0.03 as annual rate → monthly = 0.0025 → NPV ≈ $846,055
    // This divergence is intentional and documented.

    it('NPV uses annual-to-monthly conversion (0.03 / 12 = 0.0025)', () => {
      const monthlyCosts = FIX.months.map(m =>
        calculateTotalMonthlyCost(m, allocationMap, FIX.teamMembers, FIX.settings),
      );
      const npv = calculateNPV(FIX.settings.discountRateAnnual, monthlyCosts);
      // With 0.25% monthly rate, NPV should be close to but slightly less than ETC
      expect(npv).toBeLessThan(FIX.expected.etc);
      expect(npv).toBeGreaterThan(FIX.expected.etc * 0.95);
    });
  });

  describe('Full Orchestrator', () => {
    it('calculateProjectMetrics produces correct aggregate results', () => {
      const project = {
        id: 'parity-test',
        name: 'Parity Test Project',
        startDate: FIX.project.startDate,
        endDate: FIX.project.endDate,
        baselineBudget: 1_000_000,
        actualCost: FIX.project.actualCost,
        teamMembers: FIX.teamMembers,
        reforecasts: [{
          id: 'rf-baseline',
          name: 'Baseline',
          createdAt: new Date().toISOString(),
          startDate: '2026-06',
          allocations: FIX.allocations,
          productivityWindows: [],
        }],
        activeReforecastId: 'rf-baseline',
      };

      const metrics = calculateProjectMetrics(project, FIX.settings);

      expect(metrics.etc).toBe(FIX.expected.etc);
      expect(metrics.eac).toBe(FIX.expected.eac);
      expect(metrics.weeklyBurnRate).toBeCloseTo(FIX.expected.weeklyBurnRate, 2);
      expect(metrics.totalHours).toBeCloseTo(FIX.expected.totalHours, 0);
      expect(metrics.variance).toBe(FIX.expected.eac - 1_000_000);
      expect(metrics.budgetRatio).toBeCloseTo(1_000_000 / FIX.expected.eac, 4);
      expect(metrics.monthlyData).toHaveLength(FIX.months.length);
    });
  });
});
