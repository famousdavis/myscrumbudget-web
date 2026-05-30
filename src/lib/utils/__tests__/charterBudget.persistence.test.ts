// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import type { AppState, CharterBudget, Reforecast } from '@/types/domain';
import { validateAppState } from '@/lib/utils/validation';
import { sanitizeAppState } from '@/lib/utils/sanitizeImport';

function validCharter(over: Partial<CharterBudget> = {}): CharterBudget {
  return {
    riskProfile: {
      projectType: 'custom',
      requirementsClarity: 'partial',
      teamExperience: 'some',
      orgChangeImpact: 'mod',
      integrationComplexity: 'mod',
      cvOverride: null,
      optimismUpliftPct: 0,
    },
    distribution: 'normal',
    targetPercentile: 80,
    etcIsP80Schedule: false,
    derivedCV: 0.25,
    derivedSigma: 50000,
    etcAtCalculation: 200000,
    adjustedCostBasis: 200000,
    charterBudgetAmount: 242082,
    medianAmount: 200000,
    calculatedAt: '2026-05-01T00:00:00.000Z',
    ...over,
  };
}

function makeAppState(charter?: CharterBudget): AppState {
  const rf: Reforecast = {
    id: 'rf_1',
    name: 'Baseline',
    createdAt: '2026-01-01T00:00:00Z',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    reforecastDate: '2026-01-01',
    allocations: [],
    assignments: [],
    productivityWindows: [],
    actualCost: 0,
    baselineBudget: 100000,
    ...(charter ? { charterBudget: charter } : {}),
  };
  return {
    version: '0.14.0',
    settings: {
      discountRateAnnual: 0.1,
      laborRates: [],
      holidays: [],
      trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
    },
    teamPool: [],
    projects: [
      {
        id: 'p1',
        name: 'P',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        reforecasts: [rf],
        activeReforecastId: 'rf_1',
      },
    ],
  };
}

const charterPath = 'projects[0].reforecasts[0].charterBudget';

describe('validateCharterBudget (strict import gate)', () => {
  it('accepts a fully valid charter', () => {
    const res = validateAppState(makeAppState(validCharter()));
    expect(res.valid).toBe(true);
  });

  it('accepts a reforecast with no charterBudget (optional)', () => {
    const res = validateAppState(makeAppState(undefined));
    expect(res.valid).toBe(true);
  });

  it('accepts cvOverride at the floor and ceiling, and null', () => {
    expect(validateAppState(makeAppState(validCharter({ riskProfile: { ...validCharter().riskProfile, cvOverride: 0.08 } }))).valid).toBe(true);
    expect(validateAppState(makeAppState(validCharter({ riskProfile: { ...validCharter().riskProfile, cvOverride: 0.5 } }))).valid).toBe(true);
    expect(validateAppState(makeAppState(validCharter({ riskProfile: { ...validCharter().riskProfile, cvOverride: null } }))).valid).toBe(true);
  });

  it('rejects an off-list targetPercentile (73)', () => {
    const res = validateAppState(makeAppState(validCharter({ targetPercentile: 73 })));
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes(`${charterPath}.targetPercentile`))).toBe(true);
  });

  it('rejects optimismUpliftPct above UPLIFT_MAX (50 = 5000%)', () => {
    const res = validateAppState(makeAppState(validCharter({ riskProfile: { ...validCharter().riskProfile, optimismUpliftPct: 50 } })));
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('optimismUpliftPct'))).toBe(true);
  });

  it('rejects cvOverride above the ceiling (0.6)', () => {
    const res = validateAppState(makeAppState(validCharter({ riskProfile: { ...validCharter().riskProfile, cvOverride: 0.6 } })));
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('cvOverride'))).toBe(true);
  });

  it('rejects cvOverride below the floor (0.05)', () => {
    const res = validateAppState(makeAppState(validCharter({ riskProfile: { ...validCharter().riskProfile, cvOverride: 0.05 } })));
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('cvOverride'))).toBe(true);
  });

  it('rejects an unknown distribution', () => {
    const bad = validCharter();
    (bad as unknown as { distribution: string }).distribution = 'weibull';
    const res = validateAppState(makeAppState(bad));
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('distribution'))).toBe(true);
  });

  it('rejects an unknown projectType', () => {
    const bad = validCharter();
    (bad.riskProfile as unknown as { projectType: string }).projectType = 'foo';
    const res = validateAppState(makeAppState(bad));
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('projectType'))).toBe(true);
  });

  it('rejects a missing calculatedAt', () => {
    const bad = validCharter();
    delete (bad as unknown as { calculatedAt?: string }).calculatedAt;
    const res = validateAppState(makeAppState(bad));
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('calculatedAt'))).toBe(true);
  });

  it('rejects a non-finite derived numeric', () => {
    const res = validateAppState(makeAppState(validCharter({ charterBudgetAmount: Infinity })));
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('charterBudgetAmount'))).toBe(true);
  });
});

describe('sanitizeCharterBudget (import strip)', () => {
  it('round-trips a valid charter unchanged', () => {
    const charter = validCharter();
    const out = sanitizeAppState(makeAppState(charter));
    expect(out.projects[0].reforecasts[0].charterBudget).toEqual(charter);
  });

  it('strips unknown top-level keys on charterBudget', () => {
    const charter = { ...validCharter(), hacked: true } as unknown as CharterBudget;
    const out = sanitizeAppState(makeAppState(charter));
    const cleaned = out.projects[0].reforecasts[0].charterBudget!;
    expect('hacked' in cleaned).toBe(false);
    expect(cleaned.charterBudgetAmount).toBe(242082);
  });

  it('strips unknown nested keys on riskProfile (two-stage deep pick)', () => {
    const charter = validCharter();
    (charter.riskProfile as unknown as { evil: number }).evil = 1;
    const out = sanitizeAppState(makeAppState(charter));
    const cleaned = out.projects[0].reforecasts[0].charterBudget!;
    expect('evil' in cleaned.riskProfile).toBe(false);
    expect(cleaned.riskProfile.projectType).toBe('custom');
  });

  it('leaves a reforecast without charterBudget unchanged (no key added)', () => {
    const out = sanitizeAppState(makeAppState(undefined));
    expect('charterBudget' in out.projects[0].reforecasts[0]).toBe(false);
  });
});
