// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Reject-path coverage for validateHoliday, which had never been invoked once.
 *
 * DISPOSITION — measured 2026-08-15 at 2e99a5e. validateHoliday: 0 hits.
 * Cause: every fixture reaching validateAppState passed `holidays: []`, so the
 * guard was reachable in principle and dead in practice — the same empty-child-
 * array shape that left four validators unexecuted before v0.35.2, surviving in
 * the one subtree that release did not reach.
 *
 * ⚠️ THE STATEMENT AND THE CALLBACK ARE DIFFERENT SYMBOLS, and only the callback
 * was dead. Measured on the same run:
 *
 *   line 110  laborRates.forEach   stmt 117   callback  11
 *   line 118  holidays.forEach     stmt 117   callback   0
 *   validateHoliday                                      0
 *
 * `settings.holidays.forEach` RAN 117 times — calling .forEach on an empty array
 * executes the statement and never enters the callback. So a coverage gate
 * written against the call site reads 117 before a single test is added and
 * cannot fail after them either. Gate the ARROW and validateHoliday itself, both
 * of which were genuinely zero. Command:
 *
 *   npx vitest run --coverage --coverage.include='src/lib/utils/validation.ts' \
 *     --coverage.reporter=json --coverage.reportsDirectory=<dir>
 *
 * then read fnMap/f from coverage-final.json — the arrow's hit count, not the
 * line's. (Line numbers move; resolve by symbol.)
 *
 * SIX cases, not five. The name check is
 *   !isString(holiday.name) || !holiday.name.trim()
 * which is TWO branch arms behind ONE error push. One test per branch ARM, not
 * per message: a five-case plan leaves `.trim()` unexercised and a ||->&& mutant
 * alive. The two name cases below assert the same string on purpose — the test
 * names carry the distinction the message cannot.
 *
 * Reject-first, per v0.35.2: a valid holiday produces no errors, which is
 * indistinguishable from validateHoliday never being called. The rejects prove
 * reachability; the passing twin proves the guards do not misfire.
 *
 * Driven through the exported validateAppState; validateHoliday is module-private
 * and stays so.
 */

import { describe, it, expect } from 'vitest';
import { validateAppState } from '../validation';

/** Path prefix every holiday-scoped error carries. */
const P = 'settings.holidays';

const VALID_HOLIDAY = {
  id: 'h1',
  name: 'New Year',
  startDate: '2026-01-01',
  endDate: '2026-01-01',
};

/** Wraps a holidays array (valid or not) in an otherwise-valid AppState. */
function check(holidays: unknown[]) {
  return validateAppState({
    version: '0.16.0',
    settings: {
      discountRateAnnual: 0.03,
      laborRates: [],
      holidays,
      trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
    },
    teamPool: [],
    projects: [],
  });
}

describe('validateHoliday — one test per branch arm', () => {
  it('arm 1: rejects a non-object holiday and stops there', () => {
    const res = check(['not-an-object']);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain(`${P}[0]: expected object`);
    // Early return: no per-field errors follow the shape rejection.
    expect(res.errors.filter((e) => e.startsWith(`${P}[0].`))).toEqual([]);
  });

  it('arm 2: rejects a non-string id', () => {
    const res = check([{ ...VALID_HOLIDAY, id: 42 }]);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain(`${P}[0].id: expected string`);
  });

  it('arm 3: rejects a non-string name (the isString arm)', () => {
    const res = check([{ ...VALID_HOLIDAY, name: 42 }]);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain(`${P}[0].name: expected non-empty string`);
  });

  it('arm 4: rejects a whitespace-only name (the .trim() arm)', () => {
    // A string, so isString passes and only .trim() can reject it. Without this
    // case the || is never evaluated to its right operand.
    const res = check([{ ...VALID_HOLIDAY, name: '   ' }]);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain(`${P}[0].name: expected non-empty string`);
  });

  it('arm 5: rejects a malformed startDate (semantically invalid date)', () => {
    // Shape-valid, calendar-invalid — exercises isValidDateString past its regex.
    const res = check([{ ...VALID_HOLIDAY, startDate: '2026-02-30' }]);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain(`${P}[0].startDate: expected YYYY-MM-DD date string`);
  });

  it('arm 6: rejects a malformed endDate (fails the shape regex)', () => {
    const res = check([{ ...VALID_HOLIDAY, endDate: 'next tuesday' }]);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain(`${P}[0].endDate: expected YYYY-MM-DD date string`);
  });
});

describe('validateHoliday — reachability and indexing', () => {
  it('accepts a valid holiday (the passing twin)', () => {
    const res = check([VALID_HOLIDAY]);
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
  });

  it('interpolates the array index, so the error names the offending entry', () => {
    // Index >= 1: a hard-coded [0] would pass every case above and fail here.
    const res = check([VALID_HOLIDAY, { ...VALID_HOLIDAY, id: 42 }]);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain(`${P}[1].id: expected string`);
    expect(res.errors).not.toContain(`${P}[0].id: expected string`);
  });
});
