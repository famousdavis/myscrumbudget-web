// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Calculate Net Present Value of monthly cash flows.
 *
 * INTENTIONAL DIVERGENCE FROM EXCEL:
 * Excel's =NPV(rate, cashFlows) treats 'rate' as per-period (monthly).
 * Our app stores the rate as ANNUAL and converts to monthly: rate / 12.
 * This is the financially standard approach.
 *
 * Formula: NPV = SUM( cashFlow_i / (1 + monthlyRate)^i ) for i = 1..n
 */
export function calculateNPV(
  annualDiscountRate: number,
  monthlyCashFlows: number[],
): number {
  const monthlyRate = annualDiscountRate / 12;

  return monthlyCashFlows.reduce((npv, cashFlow, index) => {
    const period = index + 1;
    return npv + cashFlow / Math.pow(1 + monthlyRate, period);
  }, 0);
}
