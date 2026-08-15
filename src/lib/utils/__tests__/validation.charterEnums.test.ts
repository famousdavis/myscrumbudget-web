// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Accept-path coverage for the six CHARTER_* enum allowlists in validation.ts.
 *
 * DISPOSITION — measured 2026-08-15 at 2e99a5e:
 *   npx stryker run --mutate 'src/lib/utils/validation.ts:236-241' --reporters clear-text
 *   -> 6 killed / 15 survived / 0 NoCoverage / 6 CompileError
 *
 * 15 of the 21 enum values had never been validated. Exactly one fixture reached
 * validateAppState carrying a charterBudget (charterBudget.persistence.test.ts)
 * and it used a single value per Set — custom/partial/some/mod/mod/normal — so
 * the other 15 were membership data no test had ever asserted on:
 *   vendor infra biz data ai | well expl | high new | low high | solo high |
 *   lognormal beta_pert
 *
 * RECORD THE COUNT (15), NEVER THE PERCENTAGE. The 28.57% score depends on six
 * typechecker-errored mutants staying out of the denominator; the count
 * reproduces across runs, the percentage does not.
 *
 * The survivors were NOT equivalent mutants. These Sets are membership DATA, not
 * message text. Mutating 'vendor' to "" makes CHARTER_PROJECT_TYPES.has('vendor')
 * false, so a valid charter budget is REJECTED at import — silent round-trip data
 * loss, not a cosmetic diff.
 *
 * THE ACCEPT CASES ARE THE MUTANT-KILLERS, and that is why this file is shaped
 * the opposite way to validation.reforecast.test.ts. A reject test proves the
 * guard is reachable, but it passes just as well with a value missing from the
 * Set. Only an accept case for value V can fail when V is deleted. All 21 are
 * enumerated rather than only the 15, so the matrix is self-documenting and the
 * count assertion below fails if domain.ts gains a value the Set never got.
 *
 * Same root cause as validation.reforecast.test.ts (v0.35.2) and
 * validation.holiday.test.ts: a fixture that reaches validateAppState but
 * supplies one value where the guard admits many.
 *
 * Everything is driven through the exported validateAppState; validateRiskProfile
 * and validateCharterBudget are module-private and stay so.
 */

import { describe, it, expect } from 'vitest';
import { validateAppState } from '../validation';
import type { AppState, CharterBudget, Reforecast } from '@/types/domain';

/** Path prefix every charter-scoped error carries. */
const P = 'projects[0].reforecasts[0].charterBudget';

/** The known-good base. Every case below varies exactly one field from this. */
function validCharter(): CharterBudget {
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
  };
}

/** The five enum fields that live on riskProfile; `distribution` is on the root. */
const RISK_PROFILE_FIELDS: ReadonlySet<string> = new Set([
  'projectType',
  'requirementsClarity',
  'teamExperience',
  'orgChangeImpact',
  'integrationComplexity',
]);

/**
 * Base charter with exactly one enum field replaced. The cast is confined here:
 * the reject cases deliberately supply values outside the union, which is the
 * whole point of a runtime allowlist.
 */
function charterWith(field: string, value: string): CharterBudget {
  const base = validCharter();
  const next = RISK_PROFILE_FIELDS.has(field)
    ? { ...base, riskProfile: { ...base.riskProfile, [field]: value } }
    : { ...base, [field]: value };
  return next as unknown as CharterBudget;
}

function makeAppState(charter: CharterBudget): AppState {
  const rf: Reforecast = {
    id: 'rf_1',
    name: 'Baseline',
    createdAt: '2026-06-01T00:00:00Z',
    reforecastDate: '2026-06-01',
    startDate: '2026-06-15',
    endDate: '2027-07-15',
    assignments: [],
    allocations: [],
    productivityWindows: [],
    actualCost: 0,
    baselineBudget: 100000,
    charterBudget: charter,
  };
  return {
    version: '0.16.0',
    settings: {
      discountRateAnnual: 0.03,
      laborRates: [],
      holidays: [],
      trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
    },
    teamPool: [],
    projects: [
      {
        id: 'p1',
        name: 'Project',
        startDate: '2026-06-15',
        endDate: '2027-07-15',
        activeReforecastId: 'rf_1',
        reforecasts: [rf],
      },
    ],
  };
}

/**
 * All 21 values across the six Sets, as [set, field, value].
 * The six the pre-existing fixture already exercised are marked; the other 15
 * are the mutants that survived before this file existed.
 */
const ACCEPT_CASES: ReadonlyArray<readonly [string, string, string]> = [
  // CHARTER_PROJECT_TYPES — 6 values
  ['CHARTER_PROJECT_TYPES', 'projectType', 'vendor'],
  ['CHARTER_PROJECT_TYPES', 'projectType', 'infra'],
  ['CHARTER_PROJECT_TYPES', 'projectType', 'biz'],
  ['CHARTER_PROJECT_TYPES', 'projectType', 'custom'], // pre-existing fixture value
  ['CHARTER_PROJECT_TYPES', 'projectType', 'data'],
  ['CHARTER_PROJECT_TYPES', 'projectType', 'ai'],
  // CHARTER_REQUIREMENTS — 3 values
  ['CHARTER_REQUIREMENTS', 'requirementsClarity', 'well'],
  ['CHARTER_REQUIREMENTS', 'requirementsClarity', 'partial'], // pre-existing fixture value
  ['CHARTER_REQUIREMENTS', 'requirementsClarity', 'expl'],
  // CHARTER_EXPERIENCE — 3 values
  ['CHARTER_EXPERIENCE', 'teamExperience', 'high'],
  ['CHARTER_EXPERIENCE', 'teamExperience', 'some'], // pre-existing fixture value
  ['CHARTER_EXPERIENCE', 'teamExperience', 'new'],
  // CHARTER_ORGCHANGE — 3 values
  ['CHARTER_ORGCHANGE', 'orgChangeImpact', 'low'],
  ['CHARTER_ORGCHANGE', 'orgChangeImpact', 'mod'], // pre-existing fixture value
  ['CHARTER_ORGCHANGE', 'orgChangeImpact', 'high'],
  // CHARTER_INTEGRATION — 3 values
  ['CHARTER_INTEGRATION', 'integrationComplexity', 'solo'],
  ['CHARTER_INTEGRATION', 'integrationComplexity', 'mod'], // pre-existing fixture value
  ['CHARTER_INTEGRATION', 'integrationComplexity', 'high'],
  // CHARTER_DISTRIBUTIONS — 3 values
  ['CHARTER_DISTRIBUTIONS', 'distribution', 'normal'], // pre-existing fixture value
  ['CHARTER_DISTRIBUTIONS', 'distribution', 'lognormal'],
  ['CHARTER_DISTRIBUTIONS', 'distribution', 'beta_pert'],
];

/** One reject per Set: the reachability proof, asserted on the exact full message. */
const REJECT_CASES: ReadonlyArray<readonly [string, string, string]> = [
  ['CHARTER_PROJECT_TYPES', 'projectType', `${P}.riskProfile.projectType: expected one of vendor|infra|biz|custom|data|ai`],
  ['CHARTER_REQUIREMENTS', 'requirementsClarity', `${P}.riskProfile.requirementsClarity: expected one of well|partial|expl`],
  ['CHARTER_EXPERIENCE', 'teamExperience', `${P}.riskProfile.teamExperience: expected one of high|some|new`],
  ['CHARTER_ORGCHANGE', 'orgChangeImpact', `${P}.riskProfile.orgChangeImpact: expected one of low|mod|high`],
  ['CHARTER_INTEGRATION', 'integrationComplexity', `${P}.riskProfile.integrationComplexity: expected one of solo|mod|high`],
  ['CHARTER_DISTRIBUTIONS', 'distribution', `${P}.distribution: expected one of normal|lognormal|beta_pert`],
];

describe('CHARTER_* allowlists — the base fixture', () => {
  it('accepts the unmodified base charter', () => {
    const res = validateAppState(makeAppState(validCharter()));
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
  });
});

describe('CHARTER_* allowlists — every enum value is accepted', () => {
  // Asserting errors is EXACTLY empty, not merely that the field's own error is
  // absent: deleting a value from a Set must fail loudly here, and an assertion
  // scoped to one path could be satisfied by an unrelated regression.
  it.each(ACCEPT_CASES)('%s accepts %s = "%s"', (_set, field, value) => {
    const res = validateAppState(makeAppState(charterWith(field, value)));
    expect(res.errors).toEqual([]);
  });

  it('enumerates all 21 values — a Set that gains a value must gain a case', () => {
    expect(ACCEPT_CASES).toHaveLength(21);
    const perSet = ACCEPT_CASES.reduce<Record<string, number>>((acc, [set]) => {
      acc[set] = (acc[set] ?? 0) + 1;
      return acc;
    }, {});
    expect(perSet).toEqual({
      CHARTER_PROJECT_TYPES: 6,
      CHARTER_REQUIREMENTS: 3,
      CHARTER_EXPERIENCE: 3,
      CHARTER_ORGCHANGE: 3,
      CHARTER_INTEGRATION: 3,
      CHARTER_DISTRIBUTIONS: 3,
    });
  });
});

describe('CHARTER_* allowlists — each Set rejects an off-list value', () => {
  it.each(REJECT_CASES)('%s rejects an off-list %s', (_set, field, message) => {
    const res = validateAppState(makeAppState(charterWith(field, 'not-a-member')));
    expect(res.valid).toBe(false);
    expect(res.errors).toContain(message);
  });
});
