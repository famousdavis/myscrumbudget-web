// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import type { RiskProfile } from '@/types/domain';
import { normalInverse } from '../normal';
import {
  computeCV,
  computeCharterBudget,
  CV_FLOOR,
  CV_CEILING,
} from '../charterBudget';

// ETC fixture used across the §4.7 gate. Arbitrary; the engine is a pure fn.
const ETC = 164834;

/**
 * A "neutral" Custom profile: every adjustment factor sits on its 0.00 option,
 * so composite CV == BASE_CV.custom (0.25). Neutral == {partial, some, mod, mod}.
 */
function neutral(overrides: Partial<RiskProfile> = {}): RiskProfile {
  return {
    projectType: 'custom',
    requirementsClarity: 'partial',
    teamExperience: 'some',
    orgChangeImpact: 'mod',
    integrationComplexity: 'mod',
    cvOverride: null,
    optimismUpliftPct: 0,
    ...overrides,
  };
}

const mult = (charter: number) => charter / ETC;

describe('charterBudget engine — §4.7 gate (exact engine multiples)', () => {
  it('Custom, neutral, Normal, P80, uplift 0 → 1.210411', () => {
    const r = computeCharterBudget(neutral(), 'normal', 80, ETC);
    expect(mult(r.charterAmount)).toBeCloseTo(1.210411, 3);
  });

  it('Custom, neutral, Lognormal, P80, uplift 0 → 1.193526', () => {
    const r = computeCharterBudget(neutral(), 'lognormal', 80, ETC);
    expect(mult(r.charterAmount)).toBeCloseTo(1.193526, 3);
  });

  it('Custom, neutral, Beta-PERT, P80, uplift 0 → 1.229389', () => {
    const r = computeCharterBudget(neutral(), 'beta_pert', 80, ETC);
    expect(mult(r.charterAmount)).toBeCloseTo(1.229389, 3);
  });

  it('AI/ML, neutral, Normal, P80, uplift 0 → 1.338426', () => {
    const r = computeCharterBudget(neutral({ projectType: 'ai' }), 'normal', 80, ETC);
    expect(mult(r.charterAmount)).toBeCloseTo(1.338426, 3);
  });

  it('P60, Custom, neutral, Normal → 1.063345', () => {
    const r = computeCharterBudget(neutral(), 'normal', 60, ETC);
    expect(mult(r.charterAmount)).toBeCloseTo(1.063345, 3);
  });

  it('Beta-PERT, CV 0.40 (AI) → O clips to 0, Pb = 2×center → 1.346804', () => {
    const r = computeCharterBudget(neutral({ projectType: 'ai' }), 'beta_pert', 80, ETC);
    expect(mult(r.charterAmount)).toBeCloseTo(1.346804, 3);
  });
});

describe('charterBudget engine — optimism uplift', () => {
  it('Custom, Normal, P80, uplift 10% → charter/ETC 1.331452', () => {
    const r = computeCharterBudget(neutral({ optimismUpliftPct: 0.1 }), 'normal', 80, ETC);
    expect(mult(r.charterAmount)).toBeCloseTo(1.331452, 3);
  });

  it('uplift 10%: contingencyPct (vs center) === Custom P80 multiple − 1 (0.210411)', () => {
    const r = computeCharterBudget(neutral({ optimismUpliftPct: 0.1 }), 'normal', 80, ETC);
    expect(r.contingencyPct).toBeCloseTo(0.210411, 3);
  });

  it('uplift 10%: center == 1.10×ETC (toBe-safe); upliftAmount == 0.10×ETC (toBeCloseTo — float trap)', () => {
    const r = computeCharterBudget(neutral({ optimismUpliftPct: 0.1 }), 'normal', 80, ETC);
    // center is computed as ETC*(1+uplift); 1+0.10 === 1.1, so this is bit-exact.
    expect(r.center).toBe(ETC * (1 + 0.1));
    // upliftAmount = center − ETC ≠ 0.10×ETC by ~2e-11 — assert with tolerance, not toBe.
    expect(r.upliftAmount).toBeCloseTo(0.1 * ETC, 2);
  });

  it('uplift 0 invariant: upliftAmount === 0 and center === ETC (both toBe-safe)', () => {
    const r = computeCharterBudget(neutral(), 'normal', 80, ETC);
    expect(r.upliftAmount).toBe(0);
    expect(r.center).toBe(ETC);
  });
});

describe('charterBudget engine — CV clamp & governance flags', () => {
  it('composite CV > 50% (AI + all unfavorable, raw 0.67) → applied 0.50, ceilingActive', () => {
    const cv = computeCV(
      neutral({
        projectType: 'ai',
        requirementsClarity: 'expl',
        teamExperience: 'new',
        orgChangeImpact: 'high',
        integrationComplexity: 'high',
      }),
    );
    expect(cv.composite).toBeCloseTo(0.67, 10);
    expect(cv.applied).toBe(CV_CEILING);
    expect(cv.ceilingActive).toBe(true);
    expect(cv.floorActive).toBe(false);
    expect(cv.overrideActive).toBe(false);
  });

  it('vendor + all favorable (raw −0.01) → applied 0.08, floorActive; composite negative', () => {
    const cv = computeCV({
      projectType: 'vendor',
      requirementsClarity: 'well',
      teamExperience: 'high',
      orgChangeImpact: 'low',
      integrationComplexity: 'solo',
      cvOverride: null,
      optimismUpliftPct: 0,
    });
    expect(cv.composite).toBeCloseTo(-0.01, 10);
    expect(cv.applied).toBe(CV_FLOOR);
    expect(cv.floorActive).toBe(true);
    expect(cv.ceilingActive).toBe(false);
  });

  it('cvOverride = 0.60 (above ceiling) → applied 0.50, ceilingActive FALSE, overrideActive', () => {
    const cv = computeCV(neutral({ cvOverride: 0.6 }));
    expect(cv.applied).toBe(CV_CEILING);
    expect(cv.ceilingActive).toBe(false); // override bypasses the governance flag
    expect(cv.overrideActive).toBe(true);
  });

  it('cvOverride below floor (0.05) → clamped to 0.08, floorActive FALSE (decision 1a)', () => {
    const cv = computeCV(neutral({ cvOverride: 0.05 }));
    expect(cv.applied).toBe(CV_FLOOR);
    expect(cv.floorActive).toBe(false); // floorActive reflects composite only, never an override
    expect(cv.overrideActive).toBe(true);
  });
});

describe('charterBudget engine — distribution invariants', () => {
  it('Lognormal medianAmount < center for any CV > 0', () => {
    const r = computeCharterBudget(neutral(), 'lognormal', 80, ETC);
    expect(r.medianAmount).toBeLessThan(r.center);
  });

  it('Beta-PERT medianAmount === center even at CV 0.40 (post-clip)', () => {
    const r = computeCharterBudget(neutral({ projectType: 'ai' }), 'beta_pert', 80, ETC);
    expect(r.medianAmount).toBe(r.center);
  });

  it('Normal medianAmount === center', () => {
    const r = computeCharterBudget(neutral(), 'normal', 80, ETC);
    expect(r.medianAmount).toBe(r.center);
  });
});

describe('normalInverse — precision (8 digits, not 9; §4.2)', () => {
  it('normalInverse(0.80) ≈ 0.8416212327', () => {
    expect(normalInverse(0.8)).toBeCloseTo(0.8416212327, 8);
  });

  it('normalInverse(0.60) ≈ 0.2533471029', () => {
    expect(normalInverse(0.6)).toBeCloseTo(0.2533471029, 8);
  });

  it('Z_SCORES table consistency (±0.001)', () => {
    expect(normalInverse(0.8)).toBeCloseTo(0.842, 3);
    expect(normalInverse(0.6)).toBeCloseTo(0.253, 3);
  });
});
