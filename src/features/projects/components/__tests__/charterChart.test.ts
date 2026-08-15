// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Tests for the decision-carrying half of the Charter Budget mini chart.
 *
 * ⚠️ Why these test `computeChartDomain` / `densityAt` and not `drawCharterChart`:
 * that function is void-returning Canvas 2D, and this repo's jsdom returns null
 * from `getContext('2d')` (the `canvas` package is not installed). A naive
 * render test therefore executes three lines — the window guard, the getContext
 * call, and the null return — then passes, WHILE RAISING MEASURED COVERAGE AND
 * ASSERTING NOTHING. That is the false green this file exists to avoid: the
 * decisions were extracted so they could be tested for real, rather than a test
 * being written against the part that cannot be observed.
 *
 * ⚠️ And why shape properties rather than density values: the three kernels are
 * deliberately UN-NORMALIZED ("shape only" — see charterChart.ts). Their outputs
 * are meaningful only relative to each other, so asserting textbook densities
 * would fail against correct code. Everything below asserts a property that
 * survives an arbitrary positive rescaling: where the peak is, symmetry, which
 * regions are exactly zero, and monotonic decay away from the mode.
 */

import { describe, it, expect } from 'vitest';
import {
  computeChartDomain,
  densityAt,
  type CharterChartParams,
} from '../charterChart';

function params(overrides: Partial<CharterChartParams> = {}): CharterChartParams {
  return {
    distribution: 'normal',
    center: 100_000,
    sigma: 20_000,
    etc: 100_000,
    charterAmount: 125_000,
    medianAmount: 100_000,
    percentile: 80,
    isDark: false,
    ...overrides,
  };
}

/** Sample the density across the domain and return the x of the maximum. */
function peakX(p: CharterChartParams, steps = 4000): number {
  const d = computeChartDomain(p);
  let bestX = 0;
  let bestD = -Infinity;
  for (let i = 0; i <= steps; i++) {
    const x = (d.upper * i) / steps;
    const v = densityAt(x, p, d);
    if (v > bestD) {
      bestD = v;
      bestX = x;
    }
  }
  return bestX;
}

describe('computeChartDomain — axis always starts at 0 and contains everything drawn', () => {
  it('normal: curve reaches centre + 4σ', () => {
    const p = params({ center: 100_000, sigma: 20_000, charterAmount: 0 });
    expect(computeChartDomain(p).upper).toBeCloseTo(180_000, 6);
  });

  it('lognormal: curve reaches centre + 5σ — a longer right tail than normal', () => {
    const p = params({ distribution: 'lognormal', center: 100_000, sigma: 20_000, charterAmount: 0 });
    expect(computeChartDomain(p).upper).toBeCloseTo(200_000, 6);
    // And it is strictly wider than the normal domain for identical inputs.
    expect(computeChartDomain(p).upper).toBeGreaterThan(
      computeChartDomain(params({ center: 100_000, sigma: 20_000, charterAmount: 0 })).upper,
    );
  });

  it('the Pn marker widens the axis when it would otherwise fall off the right edge', () => {
    // charterAmount * 1.08 dominates: the marker plus headroom must fit.
    const p = params({ center: 50_000, sigma: 1_000, charterAmount: 200_000 });
    const d = computeChartDomain(p);
    expect(d.upper).toBeCloseTo(216_000, 6);
    expect(d.upper).toBeGreaterThan(p.charterAmount);
  });

  it('a degenerate sigma still yields an axis wider than the centre', () => {
    // center * 1.05 is the floor that stops a zero-width axis.
    const p = params({ center: 100_000, sigma: 0, charterAmount: 0 });
    expect(computeChartDomain(p).upper).toBeCloseTo(105_000, 6);
  });

  it('the upper bound always covers the charter amount and the centre', () => {
    for (const dist of ['normal', 'lognormal', 'beta_pert'] as const) {
      for (const charterAmount of [0, 50_000, 200_000, 1_000_000]) {
        const p = params({ distribution: dist, charterAmount });
        const d = computeChartDomain(p);
        expect(d.upper).toBeGreaterThanOrEqual(p.charterAmount);
        expect(d.upper).toBeGreaterThan(p.center);
      }
    }
  });
});

describe('computeChartDomain — the β-PERT window and its negative clamp', () => {
  it('uses a symmetric centre ± √7σ window when it stays non-negative', () => {
    const p = params({ distribution: 'beta_pert', center: 100_000, sigma: 20_000, charterAmount: 0 });
    const d = computeChartDomain(p);
    const sqrt7 = Math.sqrt(7);
    expect(d.betaO).toBeCloseTo(100_000 - sqrt7 * 20_000, 6);
    expect(d.betaPb).toBeCloseTo(100_000 + sqrt7 * 20_000, 6);
    // Symmetric about the centre.
    expect((d.betaO + d.betaPb) / 2).toBeCloseTo(100_000, 6);
  });

  it('clamps to [0, 2·centre] when the symmetric window would go negative', () => {
    // A cost cannot be negative, so the window is anchored at 0 and mirrored.
    const p = params({ distribution: 'beta_pert', center: 10_000, sigma: 20_000, charterAmount: 0 });
    const d = computeChartDomain(p);
    expect(d.betaO).toBe(0);
    expect(d.betaPb).toBeCloseTo(20_000, 6);
    // Still centred on the centre, which is what keeps the peak in the right place.
    expect((d.betaO + d.betaPb) / 2).toBeCloseTo(10_000, 6);
  });

  it('at the exact boundary the two paths COINCIDE — the clamp is unobservable there', () => {
    // When centre === √7σ the unclamped window is [0, 2·centre], which is exactly
    // what the clamp produces. The guard is `betaO < 0` (strict), so the unclamped
    // path is taken — and no assertion on the OUTPUT can tell which path ran.
    // Recorded rather than asserted away: a test claiming the two differ here
    // would be asserting something the arithmetic forbids.
    const sigma = 10_000;
    const center = Math.sqrt(7) * sigma;
    const d = computeChartDomain(
      params({ distribution: 'beta_pert', center, sigma, charterAmount: 0 }),
    );
    expect(d.betaO).toBeCloseTo(0, 6);
    expect(d.betaPb).toBeCloseTo(2 * center, 6);
  });

  it('just inside the clamp, the window is NARROWER than the unclamped one would be', () => {
    // This is where the clamp becomes observable: centre slightly below √7σ.
    // Unclamped would give centre + √7σ; the clamp gives 2·centre, which is less.
    const sigma = 10_000;
    const center = Math.sqrt(7) * sigma - 1_000; // betaO would be negative
    const d = computeChartDomain(
      params({ distribution: 'beta_pert', center, sigma, charterAmount: 0 }),
    );
    expect(d.betaO).toBe(0);
    expect(d.betaPb).toBeCloseTo(2 * center, 6);
    expect(d.betaPb).toBeLessThan(center + Math.sqrt(7) * sigma);
  });

  it('leaves betaO/betaPb at 0 for the non-β-PERT distributions', () => {
    for (const dist of ['normal', 'lognormal'] as const) {
      const d = computeChartDomain(params({ distribution: dist }));
      expect(d.betaO).toBe(0);
      expect(d.betaPb).toBe(0);
    }
  });
});

describe('densityAt — normal: symmetric about the centre, truncated at 0', () => {
  const p = params({ distribution: 'normal', center: 100_000, sigma: 20_000 });
  const d = computeChartDomain(p);

  it('peaks at the centre', () => {
    expect(peakX(p)).toBeCloseTo(100_000, -3); // within a sampling step
  });

  it('is symmetric: equal offsets either side give equal density', () => {
    for (const off of [5_000, 20_000, 45_000]) {
      expect(densityAt(100_000 - off, p, d)).toBeCloseTo(densityAt(100_000 + off, p, d), 12);
    }
  });

  it('decays monotonically away from the centre', () => {
    let prev = densityAt(100_000, p, d);
    for (let x = 100_000 + 5_000; x <= 180_000; x += 5_000) {
      const v = densityAt(x, p, d);
      expect(v).toBeLessThan(prev);
      prev = v;
    }
  });

  it('is exactly zero below zero — the truncation, not a small number', () => {
    expect(densityAt(-1, p, d)).toBe(0);
    expect(densityAt(-100_000, p, d)).toBe(0);
  });
});

describe('densityAt — lognormal: zero at and below zero, right-skewed', () => {
  const p = params({ distribution: 'lognormal', center: 100_000, sigma: 25_000 });
  const d = computeChartDomain(p);

  it('is exactly zero at and below zero', () => {
    expect(densityAt(0, p, d)).toBe(0);
    expect(densityAt(-1, p, d)).toBe(0);
  });

  it('is strictly positive across the visible domain', () => {
    for (let i = 1; i <= 50; i++) {
      expect(densityAt((d.upper * i) / 50, p, d)).toBeGreaterThan(0);
    }
  });

  it('peaks BELOW the centre — the defining asymmetry vs normal', () => {
    // The mode of a lognormal sits left of its mean; a symmetric curve here
    // would mean the distribution selector had no effect.
    expect(peakX(p)).toBeLessThan(100_000);
  });

  it('is NOT symmetric about the centre', () => {
    const lo = densityAt(100_000 - 30_000, p, d);
    const hi = densityAt(100_000 + 30_000, p, d);
    expect(Math.abs(lo - hi)).toBeGreaterThan(0);
  });
});

describe('densityAt — β-PERT: exactly zero outside its support', () => {
  const p = params({ distribution: 'beta_pert', center: 100_000, sigma: 20_000 });
  const d = computeChartDomain(p);

  it('is exactly zero outside [O, Pb], including at the endpoints', () => {
    expect(densityAt(d.betaO - 1, p, d)).toBe(0);
    expect(densityAt(d.betaPb + 1, p, d)).toBe(0);
    // t²(1−t)² is 0 at both endpoints too.
    expect(densityAt(d.betaO, p, d)).toBeCloseTo(0, 12);
    expect(densityAt(d.betaPb, p, d)).toBeCloseTo(0, 12);
  });

  it('peaks at the midpoint of its support', () => {
    expect(peakX(p)).toBeCloseTo((d.betaO + d.betaPb) / 2, -3);
  });

  it('is symmetric about the midpoint of its support', () => {
    const mid = (d.betaO + d.betaPb) / 2;
    const half = (d.betaPb - d.betaO) / 2;
    for (const frac of [0.25, 0.5, 0.9]) {
      expect(densityAt(mid - half * frac, p, d)).toBeCloseTo(
        densityAt(mid + half * frac, p, d),
        12,
      );
    }
  });

  it('stays zero outside the support even under the negative clamp', () => {
    const clamped = params({ distribution: 'beta_pert', center: 10_000, sigma: 20_000 });
    const cd = computeChartDomain(clamped);
    expect(densityAt(-1, clamped, cd)).toBe(0);
    expect(densityAt(cd.betaPb + 1, clamped, cd)).toBe(0);
    expect(densityAt((cd.betaO + cd.betaPb) / 2, clamped, cd)).toBeGreaterThan(0);
  });
});

describe('the three distributions genuinely differ', () => {
  it('produce different domains and different peak locations for identical inputs', () => {
    const base = { center: 100_000, sigma: 25_000, charterAmount: 0 } as const;
    const peaks = (['normal', 'lognormal', 'beta_pert'] as const).map((distribution) =>
      peakX(params({ ...base, distribution })),
    );
    // If the selector were ignored, these would coincide.
    expect(peaks[1]).toBeLessThan(peaks[0]); // lognormal mode left of normal
    expect(new Set(peaks.map((x) => Math.round(x / 1000))).size).toBeGreaterThan(1);
  });
});
