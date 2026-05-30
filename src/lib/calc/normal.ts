// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Standard normal distribution helpers for the Charter Budget engine.
 *
 * `normalCDF`     — Abramowitz & Stegun 7.1.26 erf approximation (max error ~1.5e-7).
 * `normalInverse` — Acklam's rational approximation for the inverse CDF (probit),
 *                   accurate to ~1e-9 across the open interval (0, 1). We deliberately
 *                   use Acklam rather than A&S 26.2.23: on a $10M / CV=0.25 charter the
 *                   A&S inverse drifts $400–$1,100 ($411 @ P80, $895 @ P95), whereas the
 *                   percentiles this app uses (P60–P95) land well inside Acklam's
 *                   sub-1e-9 band. (See the Charter Budget plan §4.2.)
 *
 * These are greenfield — the repo has no prior stats dependency.
 */

/** erf via Abramowitz & Stegun 7.1.26 (Horner form). */
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x));
  return x >= 0 ? y : -y;
}

/** Standard normal cumulative distribution function. */
export function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/**
 * Inverse standard normal CDF (probit) via Acklam's algorithm.
 * Returns the z such that normalCDF(z) ≈ p. Defined on (0, 1); the boundaries
 * return ±Infinity rather than NaN.
 */
export function normalInverse(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  // Coefficients (Acklam).
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;

  if (p < pLow) {
    // Lower tail.
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    // Central region.
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  // Upper tail.
  q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}
