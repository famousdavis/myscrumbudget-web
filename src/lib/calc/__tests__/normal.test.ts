// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * First direct tests for the standard-normal helpers behind the Charter Budget
 * engine. Until now `normal.ts` had NO test file of its own — it was exercised
 * only incidentally through `charterBudget.test.ts`, which asks for P60–P95.
 * Every one of those percentiles lands in Acklam's CENTRAL region, so both tail
 * branches had never executed: the mutation baseline reported 46 no-coverage
 * mutants here, the largest such block in src/lib/calc/.
 *
 * Reference values are the true quantiles/probabilities of the standard normal,
 * not values scraped from this implementation — otherwise the tests would pin
 * whatever the code currently does, including any error.
 *
 * Tolerances are set by the documented accuracy of each approximation:
 *   normalInverse — Acklam, ~1.15e-9 relative  -> 1e-8 here
 *   normalCDF     — A&S 7.1.26, max error ~1.5e-7 -> 1e-6 here
 * A round trip through both is bounded by the weaker of the two (the CDF).
 */

import { describe, it, expect } from 'vitest';
import { normalCDF, normalInverse } from '../normal';

const CDF_TOL = 1e-6;

/** Standard normal density — used to size round-trip tolerances (see below). */
const pdf = (z: number) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);

describe('normalCDF', () => {
  it('is 0.5 at the mean', () => {
    // NOT exactly 0.5: A&S 7.1.26 leaves a residual of ~5e-10 at x = 0, which is
    // three orders inside its documented 1.5e-7 bound. Asserting exact equality
    // here would be asserting more precision than the approximation claims.
    expect(normalCDF(0)).toBeCloseTo(0.5, 6);
  });

  it('matches known probabilities at ±1σ, ±2σ and 1.96σ', () => {
    expect(normalCDF(1)).toBeCloseTo(0.8413447460685429, 6);
    expect(normalCDF(-1)).toBeCloseTo(0.15865525393145705, 6);
    expect(normalCDF(2)).toBeCloseTo(0.9772498680518208, 6);
    expect(normalCDF(-2)).toBeCloseTo(0.022750131948179195, 6);
    expect(normalCDF(1.959963984540054)).toBeCloseTo(0.975, 6);
  });

  it('is symmetric: F(-x) = 1 - F(x)', () => {
    for (const x of [0.25, 0.5, 1, 1.5, 2.5, 3]) {
      expect(normalCDF(-x)).toBeCloseTo(1 - normalCDF(x), 9);
    }
  });

  it('is monotonically increasing', () => {
    let prev = -Infinity;
    for (let x = -4; x <= 4; x += 0.25) {
      const v = normalCDF(x);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });

  it('stays within [0, 1] far into both tails', () => {
    for (const x of [-40, -10, -6, 6, 10, 40]) {
      const v = normalCDF(x);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(normalCDF(-10)).toBeLessThan(CDF_TOL);
    expect(normalCDF(10)).toBeGreaterThan(1 - CDF_TOL);
  });
});

describe('normalInverse — boundaries', () => {
  it('returns -Infinity at and below 0, +Infinity at and above 1', () => {
    // Documented contract: the boundaries return ±Infinity rather than NaN.
    expect(normalInverse(0)).toBe(-Infinity);
    expect(normalInverse(-0.5)).toBe(-Infinity);
    expect(normalInverse(1)).toBe(Infinity);
    expect(normalInverse(1.5)).toBe(Infinity);
  });
});

describe('normalInverse — central region (0.02425 <= p <= 0.97575)', () => {
  it('is 0 at the median', () => {
    expect(normalInverse(0.5)).toBeCloseTo(0, 10);
  });

  it('matches known quantiles', () => {
    expect(normalInverse(0.975)).toBeCloseTo(1.959963984540054, 8);
    expect(normalInverse(0.95)).toBeCloseTo(1.6448536269514722, 8);
    expect(normalInverse(0.9)).toBeCloseTo(1.2815515655446004, 8);
    expect(normalInverse(0.8)).toBeCloseTo(0.8416212335729143, 8);
    expect(normalInverse(0.6)).toBeCloseTo(0.2533471031357997, 8);
    expect(normalInverse(0.05)).toBeCloseTo(-1.6448536269514722, 8);
  });

  it('is antisymmetric: F⁻¹(p) = -F⁻¹(1-p)', () => {
    for (const p of [0.05, 0.1, 0.25, 0.4, 0.6, 0.75, 0.9, 0.95]) {
      expect(normalInverse(p)).toBeCloseTo(-normalInverse(1 - p), 8);
    }
  });

  it('covers the percentiles the Charter Budget panel offers (P60–P95)', () => {
    const expected: Record<number, number> = {
      0.6: 0.2533471031357997,
      0.7: 0.5244005127080409,
      0.8: 0.8416212335729143,
      0.9: 1.2815515655446004,
      0.95: 1.6448536269514722,
    };
    for (const [p, z] of Object.entries(expected)) {
      expect(normalInverse(Number(p))).toBeCloseTo(z, 8);
    }
  });
});

describe('normalInverse — tail regions', () => {
  // These are the branches charterBudget.test.ts never reaches: every percentile
  // the UI offers (P60–P95) sits in the central region.
  it('lower tail (p < 0.02425) matches known quantiles', () => {
    expect(normalInverse(0.02)).toBeCloseTo(-2.053748910631823, 8);
    expect(normalInverse(0.01)).toBeCloseTo(-2.3263478740408408, 8);
    expect(normalInverse(0.001)).toBeCloseTo(-3.0902323061678132, 8);
    expect(normalInverse(0.0001)).toBeCloseTo(-3.719016485455709, 7);
  });

  it('upper tail (p > 0.97575) matches known quantiles', () => {
    expect(normalInverse(0.98)).toBeCloseTo(2.053748910631823, 8);
    expect(normalInverse(0.99)).toBeCloseTo(2.3263478740408408, 8);
    expect(normalInverse(0.999)).toBeCloseTo(3.0902323061678132, 8);
    expect(normalInverse(0.9999)).toBeCloseTo(3.719016485455709, 7);
  });

  it('is continuous across both region boundaries', () => {
    // pLow = 0.02425 — the switch between the lower-tail and central branches.
    const eps = 1e-9;
    expect(normalInverse(0.02425 - eps)).toBeCloseTo(normalInverse(0.02425 + eps), 7);
    // pHigh = 1 - 0.02425 = 0.97575 — central to upper tail.
    expect(normalInverse(0.97575 - eps)).toBeCloseTo(normalInverse(0.97575 + eps), 7);
  });

  it('is monotonically increasing across all three regions', () => {
    const ps = [0.0001, 0.001, 0.01, 0.02, 0.02425, 0.1, 0.5, 0.9, 0.97575, 0.98, 0.99, 0.9999];
    let prev = -Infinity;
    for (const p of ps) {
      const z = normalInverse(p);
      expect(z).toBeGreaterThan(prev);
      prev = z;
    }
  });
});

describe('normalCDF and normalInverse are mutual inverses', () => {
  it('round-trips p -> z -> p across all three regions', () => {
    for (const p of [0.001, 0.01, 0.02, 0.05, 0.25, 0.5, 0.75, 0.95, 0.98, 0.99, 0.999]) {
      expect(normalCDF(normalInverse(p))).toBeCloseTo(p, 6);
    }
  });

  it('round-trips z -> p -> z, within the tolerance the CDF error implies', () => {
    // The tolerance is DERIVED, not guessed. An absolute error e in the CDF maps
    // to a z error of roughly e / φ(z), because dp/dz = φ(z). φ is small in the
    // tails, so the same CDF error is amplified there: at |z| = 3, φ ≈ 0.0044 and
    // the round trip is accurate to ~2e-5 rather than ~1e-6. A single flat
    // tolerance would either fail at the tails or be vacuous at the centre.
    for (const z of [-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3]) {
      const tol = (CDF_TOL / pdf(z)) * 1.5;
      expect(Math.abs(normalInverse(normalCDF(z)) - z)).toBeLessThan(tol);
    }
  });
});
