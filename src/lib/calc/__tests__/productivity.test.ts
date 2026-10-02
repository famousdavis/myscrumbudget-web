// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * getProductivityFactor averages, over the WORKING DAYS it is given, the lowest
 * window factor covering each day. The engine passes getMonthlyWorkingDays'
 * output, so weekends and holidays never reach it — that end-to-end contract
 * is pinned in productivityWorkingDays.test.ts. These tests cover the averaging.
 *
 * Until v0.43.0 the function took a month and averaged over its CALENDAR days;
 * the expected values here were all re-derived for working days.
 */

import { describe, it, expect } from 'vitest';
import { getProductivityFactor } from '../productivity';
import { getMonthlyWorkingDays } from '@/lib/utils/dates';
import type { ProductivityWindow } from '@/types/domain';

// November 2026, no holidays: 21 weekdays, Mon Nov 2 → Mon Nov 30.
const NOVEMBER = getMonthlyWorkingDays('2026-11', '2026-01-01', '2026-12-31');

function win(startDate: string, endDate: string, factor: number): ProductivityWindow {
  return { id: `${startDate}_${endDate}`, startDate, endDate, factor };
}

describe('getProductivityFactor', () => {
  it('precondition: the November fixture is its 21 weekdays', () => {
    expect(NOVEMBER).toHaveLength(21);
    expect(NOVEMBER[0]).toBe('2026-11-02');
    expect(NOVEMBER[20]).toBe('2026-11-30');
  });

  it('returns 1 when no windows are defined', () => {
    expect(getProductivityFactor(NOVEMBER, [])).toBe(1);
  });

  it('returns 1 when there are no working days, whatever the windows say', () => {
    expect(getProductivityFactor([], [win('2026-11-01', '2026-11-30', 0)])).toBe(1);
  });

  it('returns the window factor when it covers every working day', () => {
    expect(getProductivityFactor(NOVEMBER, [win('2026-11-01', '2026-11-30', 0.5)])).toBeCloseTo(0.5, 12);
  });

  it('returns the factor when the window extends beyond the days on both sides', () => {
    expect(getProductivityFactor(NOVEMBER, [win('2026-10-01', '2026-12-31', 0.7)])).toBeCloseTo(0.7, 12);
  });

  it('returns 1 when no window covers any of the days', () => {
    expect(getProductivityFactor(NOVEMBER, [win('2026-12-01', '2026-12-31', 0.5)])).toBe(1);
  });

  it('averages over working days: a Mon–Fri week at 0% leaves 16 of 21', () => {
    expect(getProductivityFactor(NOVEMBER, [win('2026-11-23', '2026-11-27', 0)])).toBeCloseTo(16 / 21, 12);
  });

  it('a seven-day window covers five working days — the weekend is not in the list', () => {
    // Mon Nov 23 → Sun Nov 29 removes the same five days as Mon–Fri.
    expect(getProductivityFactor(NOVEMBER, [win('2026-11-23', '2026-11-29', 0)])).toBeCloseTo(16 / 21, 12);
  });

  it('a window covering only weekend dates changes nothing', () => {
    expect(getProductivityFactor(NOVEMBER, [win('2026-11-07', '2026-11-08', 0)])).toBe(1);
  });

  it('includes both the start and the end date of a window', () => {
    // A single-day window on the first and on the last working day.
    expect(getProductivityFactor(NOVEMBER, [win('2026-11-02', '2026-11-02', 0)])).toBeCloseTo(20 / 21, 12);
    expect(getProductivityFactor(NOVEMBER, [win('2026-11-30', '2026-11-30', 0)])).toBeCloseTo(20 / 21, 12);
    // A window ending on the first day, starting in the previous month.
    expect(getProductivityFactor(NOVEMBER, [win('2026-10-26', '2026-11-02', 0)])).toBeCloseTo(20 / 21, 12);
  });

  it('weights a partial factor by days: 5 of 21 days at 50%', () => {
    expect(getProductivityFactor(NOVEMBER, [win('2026-11-23', '2026-11-27', 0.5)])).toBeCloseTo(18.5 / 21, 12);
  });

  it('takes the lowest factor on days where windows overlap', () => {
    // Four days. A (Nov 2–4) at 50%, B (Nov 4–5) at 20%:
    // 0.5 + 0.5 + min(0.5, 0.2) + 0.2 = 1.4 → 1.4 / 4 = 0.35.
    // B is listed FIRST on purpose: with the lower factor last, "the last
    // window wins" would also give 0.2 on Nov 4 and pass. This order makes
    // that rule give 0.425.
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
    const windows = [win('2026-11-04', '2026-11-05', 0.2), win('2026-11-02', '2026-11-04', 0.5)];
    expect(getProductivityFactor(days, windows)).toBeCloseTo(0.35, 12);
  });
});
