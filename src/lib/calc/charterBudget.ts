// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Charter Budget engine — an explainable parametric contingency heuristic.
 *
 * A PM completes a five-question risk profile; the model derives a coefficient
 * of variation (CV), and a charter budget is computed at a chosen percentile and
 * distribution, with ETC as the cost basis (the distribution's center / mean).
 *
 * All three distributions share `center` (= ETC × (1 + uplift)) and
 * `σ = center × CV_applied`; they differ only in how uncertainty maps to a
 * percentile. This is NOT a guarantee — see the Charter Budget plan §1.4.
 *
 * Pure functions, zero UI/Firebase deps. See the plan §3–§4 for the "why."
 */

import type {
  RiskProfile,
  Distribution,
  CharterBudgetResult,
} from '@/types/domain';
import { normalCDF, normalInverse } from './normal';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base CV by project type (coefficient of variation, as a fraction). */
export const BASE_CV = {
  vendor: 0.15, // COTS / vendor implementation
  infra: 0.18, // Infrastructure / cloud migration
  biz: 0.22, // Business process / org transformation
  custom: 0.25, // Custom software development
  data: 0.25, // Data engineering / analytics / BI
  ai: 0.4, // AI / ML / data science
} as const;

/** Per-factor additive CV deltas (ρ=1 / positively-correlated assumption). */
export const ADJUSTMENTS = {
  requirements: { well: -0.05, partial: 0.0, expl: 0.08 },
  experience: { high: -0.05, some: 0.0, new: 0.07 },
  orgChange: { low: -0.03, mod: 0.0, high: 0.06 },
  integration: { solo: -0.03, mod: 0.0, high: 0.06 },
} as const;

/**
 * z reference table — for labels/docs only. The canonical Normal path computes
 * via `normalInverse(p)`; keep this consistent with it to ±0.001.
 */
export const Z_SCORES = {
  60: 0.253,
  70: 0.524,
  75: 0.674,
  80: 0.842,
  85: 1.036,
  90: 1.282,
  95: 1.645,
} as const;

export const CV_FLOOR = 0.08;
export const CV_CEILING = 0.5;
export const CV_WARN_THRESHOLD = 0.3; // triggers P85 suggestion
export const UPLIFT_MIN = 0.0; // optimism uplift bounds (fraction)
export const UPLIFT_MAX = 1.0; // 100% cap; sanity guard (fraction)

/** Allowed charter percentiles (the UI selector + the strict import validator). */
export const ALLOWED_PERCENTILES = [60, 70, 75, 80, 85, 90, 95] as const;

// ---------------------------------------------------------------------------
// CV computation
// ---------------------------------------------------------------------------

export interface CvResult {
  base: number;
  adj: number;
  composite: number;
  applied: number;
  overrideActive: boolean;
  ceilingActive: boolean;
  floorActive: boolean;
}

/**
 * Derive the applied CV from a risk profile.
 *
 * A manual `cvOverride` is a deliberate user assertion and BYPASSES the
 * governance-ceiling semantics: `ceilingActive`/`floorActive` describe the
 * *computed composite* only, never an override. The override is still clamped to
 * [CV_FLOOR, CV_CEILING] for numerical safety — but since the UI/validator
 * constrain it to [0.08, 0.50] the floor clamp never actually bumps a valid
 * value (so `floorActive` is structurally false on the override path).
 */
export function computeCV(profile: RiskProfile): CvResult {
  const base = BASE_CV[profile.projectType] ?? 0.25;
  const adj =
    (ADJUSTMENTS.requirements[profile.requirementsClarity] ?? 0) +
    (ADJUSTMENTS.experience[profile.teamExperience] ?? 0) +
    (ADJUSTMENTS.orgChange[profile.orgChangeImpact] ?? 0) +
    (ADJUSTMENTS.integration[profile.integrationComplexity] ?? 0);
  const composite = base + adj; // may be negative (e.g. -0.01)
  const hasOverride = profile.cvOverride != null;
  const applied = hasOverride
    ? Math.max(CV_FLOOR, Math.min(CV_CEILING, profile.cvOverride as number))
    : Math.max(CV_FLOOR, Math.min(CV_CEILING, composite));

  return {
    base,
    adj,
    composite,
    applied,
    overrideActive: hasOverride,
    ceilingActive: !hasOverride && composite > CV_CEILING,
    floorActive: !hasOverride && composite < CV_FLOOR,
  };
}

// ---------------------------------------------------------------------------
// Distribution quantiles — all share (center=mu, sigma)
// ---------------------------------------------------------------------------

/** Truncated-at-0 Normal quantile (default, labeled "Normal"). */
export function quantileNormal(p: number, mu: number, sigma: number): number {
  const alpha = -mu / sigma; // = -1/CV; < -2 for CV < 50%
  const Z = normalCDF(-alpha); // normalizing constant
  return mu + sigma * normalInverse(normalCDF(alpha) + p * Z);
}

/** Mean-anchored Lognormal quantile (P50 < center by construction). */
export function quantileLognormal(p: number, mu: number, sigma: number): number {
  const cv = sigma / mu;
  const sigmaLn = Math.sqrt(Math.log(1 + cv * cv));
  const muLn = Math.log(mu) - (sigmaLn * sigmaLn) / 2;
  return Math.exp(muLn + normalInverse(p) * sigmaLn);
}

/** Lognormal median (= exp(muLn)); always < mu (= center). */
export function medianLognormal(mu: number, sigma: number): number {
  const cv = sigma / mu;
  const sigmaLn = Math.sqrt(Math.log(1 + cv * cv));
  const muLn = Math.log(mu) - (sigmaLn * sigmaLn) / 2;
  return Math.exp(muLn);
}

/** Beta(3,3) CDF on [0,1]. */
function betaCDF33(x: number): number {
  return 10 * x ** 3 - 15 * x ** 4 + 6 * x ** 5;
}

/** Beta(3,3) quantile via bisection (40 iters → precision < 1e-12). */
function betaQuantile33(p: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (betaCDF33(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Symmetric Beta-PERT (α₁ = α₂ = 3) quantile.
 *
 * √7 is LOAD-BEARING: the unit Beta(3,3) standard deviation is 1/(2√7) ≈ 0.18898,
 * so a half-width of √7·σ makes the rendered SD equal the requested σ (true-SD
 * matching). Do NOT replace with the textbook PERT "range = 6·sd" rule — at
 * CV 0.25 that gives Custom P80 +26.0% instead of +23.0% (off by ~3 pp). At high
 * CV the same clip rule converges both forms to +34.7%, so the divergence is at
 * low–mid CV. Post-clip, the effective spread is CAPPED (half-width = µ), so a
 * requested CV = 0.40 renders less dispersed than asked.
 */
export function quantileBetaPERT(p: number, mu: number, sigma: number): number {
  const sqrt7 = Math.sqrt(7); // ≈ 2.6458
  let O = mu - sqrt7 * sigma;
  let Pb = mu + sqrt7 * sigma;
  if (O < 0) {
    // CV > ~38%: clip and shift; mean stays = mu, support [0, 2µ].
    O = 0;
    Pb = 2 * mu;
  }
  return O + (Pb - O) * betaQuantile33(p);
}

// ---------------------------------------------------------------------------
// Unified entry point
// ---------------------------------------------------------------------------

export function computeCharterBudget(
  profile: RiskProfile,
  distribution: Distribution,
  percentile: number,
  ETC: number,
): CharterBudgetResult {
  const cvResult = computeCV(profile);
  const cv = cvResult.applied;
  const uplift = profile.optimismUpliftPct ?? 0; // Option 1 default = 0
  const center = ETC * (1 + uplift); // adjusted cost basis
  const sigma = center * cv; // σ off adjusted center
  const p = percentile / 100;

  let charterAmount: number;
  let medianAmount: number;
  if (distribution === 'lognormal') {
    charterAmount = quantileLognormal(p, center, sigma);
    medianAmount = medianLognormal(center, sigma);
  } else if (distribution === 'beta_pert') {
    charterAmount = quantileBetaPERT(p, center, sigma);
    medianAmount = center; // symmetric (even post-clip)
  } else {
    charterAmount = quantileNormal(p, center, sigma);
    medianAmount = center;
  }

  return {
    cv,
    sigma,
    center,
    etc: ETC, // persist this as etcAtCalculation
    upliftAmount: center - ETC, // 0 when uplift = 0
    charterAmount,
    medianAmount,
    contingencyAmt: charterAmount - center, // spread only
    contingencyPct: (charterAmount - center) / center, // vs center (uplift-invariant)
    totalOverEtcPct: (charterAmount - ETC) / ETC, // uplift + contingency vs raw ETC
    cvWarn: cv > CV_WARN_THRESHOLD,
    ceilingActive: cvResult.ceilingActive,
    floorActive: cvResult.floorActive,
  };
}
