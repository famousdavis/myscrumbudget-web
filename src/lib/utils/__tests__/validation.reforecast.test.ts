// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Reject-path coverage for `validateReforecast` and the four child validators
 * reached only through it.
 *
 * Why this file exists: `validateReforecast` ran 39 times across the suite and
 * 20 of its 23 rejection pushes had never fired once. `validateAllocation`,
 * `validateProductivityWindow`, `validateAssignment` and
 * `validateHistoricalCostEntry` had never been invoked AT ALL — every existing
 * fixture passed empty child arrays, so the arrays' `.forEach` bodies never ran.
 * A validator whose reject path has never executed is indistinguishable from one
 * that does not reject.
 *
 * Shape of every case here, deliberately: the REJECT test comes first and is
 * what proves the child validator is reached (a valid entry produces no errors,
 * which is indistinguishable from never being called). The passing twin then
 * proves the guard does not fire on good data. Populating the child arrays with
 * valid data alone would cover only the taken arm of each guard and leave every
 * reject arm dead — which is the state this file exists to end.
 *
 * Everything is driven through the exported `validateAppState`;
 * `validateReforecast` and the child validators are module-private and stay so.
 */

import { describe, it, expect } from 'vitest';
import { validateAppState } from '../validation';
import { REFORECAST_NOTES_MAX_LENGTH } from '@/lib/constants';

/** Path prefix every reforecast-scoped error carries. */
const P = 'projects[0].reforecasts[0]';

const VALID_ASSIGNMENT = { id: 'as1', poolMemberId: 'pm1' };
const VALID_ALLOCATION = { memberId: 'as1', month: '2026-07', allocation: 0.5 };
const VALID_WINDOW = { id: 'w1', startDate: '2026-07-01', endDate: '2026-07-31', factor: 0.8 };
const VALID_HISTORICAL = { month: '2026-06', cost: 1200, hours: 40 };

function makeReforecast(overrides: Record<string, unknown> = {}): unknown {
  return {
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
    ...overrides,
  };
}

/** Wraps a reforecast (valid or not) in an otherwise-valid AppState. */
function makeStateWithReforecast(reforecast: unknown) {
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
        reforecasts: [reforecast],
      },
    ],
  };
}

/** Validate a reforecast built from the base fixture plus `overrides`. */
function check(overrides: Record<string, unknown> = {}) {
  return validateAppState(makeStateWithReforecast(makeReforecast(overrides)));
}

describe('validateReforecast — the base fixture', () => {
  it('accepts the unmodified base reforecast', () => {
    const result = check();
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe('validateReforecast — scalar field rejects', () => {
  it('rejects a non-object reforecast and stops there', () => {
    const result = validateAppState(makeStateWithReforecast('not-an-object'));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}: expected object`);
    // Early return: no per-field errors follow the shape rejection.
    expect(result.errors.filter((e) => e.startsWith(`${P}.`))).toEqual([]);
  });

  it('rejects a non-string id', () => {
    const result = check({ id: 42 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.id: expected string`);
  });

  it('rejects a non-string name', () => {
    const result = check({ name: null });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.name: expected non-empty string`);
  });

  it('rejects a whitespace-only name (the second arm of the name guard)', () => {
    const result = check({ name: '   ' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.name: expected non-empty string`);
  });

  it('rejects a non-string createdAt', () => {
    const result = check({ createdAt: 1717200000000 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.createdAt: expected string`);
  });

  it('rejects a malformed startDate', () => {
    const result = check({ startDate: '2026-6-15' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.startDate: expected YYYY-MM-DD date string`);
  });

  it('rejects a semantically impossible startDate', () => {
    const result = check({ startDate: '2026-02-30' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.startDate: expected YYYY-MM-DD date string`);
  });

  it('rejects a malformed endDate', () => {
    const result = check({ endDate: 'tomorrow' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.endDate: expected YYYY-MM-DD date string`);
  });

  it('rejects a negative actualCost', () => {
    const result = check({ actualCost: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.actualCost: expected non-negative number`);
  });

  it('rejects a non-finite actualCost', () => {
    const result = check({ actualCost: Infinity });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.actualCost: expected non-negative number`);
  });

  it('rejects a negative baselineBudget', () => {
    const result = check({ baselineBudget: -0.01 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.baselineBudget: expected non-negative number`);
  });

  it('rejects a malformed reforecastDate', () => {
    const result = check({ reforecastDate: '06/01/2026' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.reforecastDate: expected YYYY-MM-DD date string`);
  });

  it('accepts a reforecastDate after endDate — deliberately unconstrained', () => {
    // Locks the informed decline recorded at validation.ts: reforecastDate is
    // format-checked only, because a time-dependent rule would reject legally
    // stored data as `today` advances.
    const result = check({ reforecastDate: '2030-01-01' });
    expect(result.valid).toBe(true);
  });
});

describe('validateReforecast — cross-field invariants', () => {
  it('rejects endDate before startDate', () => {
    const result = check({ startDate: '2026-06-15', endDate: '2026-06-14' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.endDate: must be on or after startDate`);
  });

  it('accepts endDate equal to startDate', () => {
    const result = check({ startDate: '2026-06-15', endDate: '2026-06-15' });
    expect(result.valid).toBe(true);
  });

  it('skips the cross-field check when startDate is itself invalid', () => {
    const result = check({ startDate: 'bogus', endDate: '2026-06-14' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.startDate: expected YYYY-MM-DD date string`);
    // The comparison is suppressed rather than run against garbage.
    expect(result.errors).not.toContain(`${P}.endDate: must be on or after startDate`);
  });

  it('skips the cross-field check when endDate is itself invalid', () => {
    const result = check({ endDate: 'bogus' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.endDate: expected YYYY-MM-DD date string`);
    expect(result.errors).not.toContain(`${P}.endDate: must be on or after startDate`);
  });
});

describe('validateReforecast — optional actualsThroughDate', () => {
  it('accepts the field being absent', () => {
    const result = check();
    expect(result.valid).toBe(true);
  });

  it('rejects a malformed actualsThroughDate', () => {
    const result = check({ actualsThroughDate: '2026-13-01' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      `${P}.actualsThroughDate: expected YYYY-MM-DD date string`,
    );
  });

  it('rejects an actualsThroughDate before startDate', () => {
    const result = check({ actualsThroughDate: '2026-06-14' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      `${P}.actualsThroughDate: must lie within [startDate, endDate]`,
    );
  });

  it('rejects an actualsThroughDate after endDate', () => {
    const result = check({ actualsThroughDate: '2027-07-16' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      `${P}.actualsThroughDate: must lie within [startDate, endDate]`,
    );
  });

  it('accepts an actualsThroughDate inside the window', () => {
    const result = check({ actualsThroughDate: '2026-09-30' });
    expect(result.valid).toBe(true);
  });

  it('accepts the boundaries of the window', () => {
    expect(check({ actualsThroughDate: '2026-06-15' }).valid).toBe(true);
    expect(check({ actualsThroughDate: '2027-07-15' }).valid).toBe(true);
  });

  it('skips the window check when the reforecast window is itself invalid', () => {
    const result = check({ startDate: 'bogus', actualsThroughDate: '2020-01-01' });
    expect(result.errors).not.toContain(
      `${P}.actualsThroughDate: must lie within [startDate, endDate]`,
    );
  });
});

describe('validateReforecast — optional notes', () => {
  it('rejects non-string notes', () => {
    const result = check({ notes: 12345 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.notes: expected string`);
  });

  it('rejects notes over the cap', () => {
    const result = check({ notes: 'x'.repeat(REFORECAST_NOTES_MAX_LENGTH + 1) });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      `${P}.notes: exceeds max length of ${REFORECAST_NOTES_MAX_LENGTH} characters`,
    );
  });

  it('accepts notes exactly at the cap', () => {
    const result = check({ notes: 'x'.repeat(REFORECAST_NOTES_MAX_LENGTH) });
    expect(result.valid).toBe(true);
  });
});

describe('validateReforecast — array shape guards', () => {
  it('rejects a non-array allocations', () => {
    const result = check({ allocations: 'nope' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.allocations: expected array`);
  });

  it('rejects a non-array productivityWindows', () => {
    const result = check({ productivityWindows: {} });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.productivityWindows: expected array`);
  });

  it('rejects a non-array assignments', () => {
    const result = check({ assignments: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.assignments: expected array`);
  });

  it('rejects a non-array historicalCosts when present', () => {
    const result = check({ historicalCosts: 'nope' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.historicalCosts: expected array`);
  });

  it('accepts historicalCosts absent, and accepts it explicitly null', () => {
    expect(check().valid).toBe(true);
    // The guard is `!== undefined && !== null`, so null is tolerated, not rejected.
    expect(check({ historicalCosts: null }).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Child validators. Each block leads with a REJECT — that is what proves the
// child is reached at all — then a passing twin proving it does not misfire.
// ---------------------------------------------------------------------------

describe('validateAssignment — reached through reforecast.assignments', () => {
  const at = `${P}.assignments[0]`;

  it('rejects a non-object entry', () => {
    const result = check({ assignments: [null] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}: expected object`);
    expect(result.errors.filter((e) => e.startsWith(`${at}.`))).toEqual([]);
  });

  it('rejects a non-string id', () => {
    const result = check({ assignments: [{ ...VALID_ASSIGNMENT, id: 7 }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.id: expected string`);
  });

  it('rejects a non-string poolMemberId', () => {
    const result = check({ assignments: [{ ...VALID_ASSIGNMENT, poolMemberId: undefined }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.poolMemberId: expected string`);
  });

  it('reports the offending index, not just the first entry', () => {
    const result = check({ assignments: [VALID_ASSIGNMENT, { id: 'as2' }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.assignments[1].poolMemberId: expected string`);
  });

  it('accepts a valid assignment', () => {
    expect(check({ assignments: [VALID_ASSIGNMENT] }).valid).toBe(true);
  });
});

describe('validateAllocation — reached through reforecast.allocations', () => {
  const at = `${P}.allocations[0]`;

  it('rejects a non-object entry', () => {
    const result = check({ allocations: ['nope'] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}: expected object`);
    expect(result.errors.filter((e) => e.startsWith(`${at}.`))).toEqual([]);
  });

  it('rejects a non-string memberId', () => {
    const result = check({ allocations: [{ ...VALID_ALLOCATION, memberId: 1 }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.memberId: expected string`);
  });

  it('rejects a non-string month', () => {
    const result = check({ allocations: [{ ...VALID_ALLOCATION, month: 202607 }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.month: expected YYYY-MM month string`);
  });

  it('rejects a full YYYY-MM-DD date in the month field', () => {
    const result = check({ allocations: [{ ...VALID_ALLOCATION, month: '2026-07-01' }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.month: expected YYYY-MM month string`);
  });

  it('rejects a non-numeric allocation', () => {
    const result = check({ allocations: [{ ...VALID_ALLOCATION, allocation: '0.5' }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.allocation: expected number between 0 and 1`);
  });

  it('rejects an allocation below 0', () => {
    const result = check({ allocations: [{ ...VALID_ALLOCATION, allocation: -0.1 }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.allocation: expected number between 0 and 1`);
  });

  it('rejects an allocation above 1 — the percentage-vs-decimal confusion', () => {
    const result = check({ allocations: [{ ...VALID_ALLOCATION, allocation: 50 }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.allocation: expected number between 0 and 1`);
  });

  it('accepts a valid allocation and both boundary values', () => {
    expect(check({ allocations: [VALID_ALLOCATION] }).valid).toBe(true);
    expect(check({ allocations: [{ ...VALID_ALLOCATION, allocation: 0 }] }).valid).toBe(true);
    expect(check({ allocations: [{ ...VALID_ALLOCATION, allocation: 1 }] }).valid).toBe(true);
  });
});

describe('validateProductivityWindow — reached through reforecast.productivityWindows', () => {
  const at = `${P}.productivityWindows[0]`;

  it('rejects a non-object entry', () => {
    const result = check({ productivityWindows: [42] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}: expected object`);
    expect(result.errors.filter((e) => e.startsWith(`${at}.`))).toEqual([]);
  });

  it('rejects a non-string id', () => {
    const result = check({ productivityWindows: [{ ...VALID_WINDOW, id: null }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.id: expected string`);
  });

  it('rejects a malformed startDate', () => {
    const result = check({ productivityWindows: [{ ...VALID_WINDOW, startDate: '2026-07' }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.startDate: expected YYYY-MM-DD date string`);
  });

  it('rejects a malformed endDate', () => {
    const result = check({ productivityWindows: [{ ...VALID_WINDOW, endDate: '2026-02-30' }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.endDate: expected YYYY-MM-DD date string`);
  });

  it('rejects a non-numeric factor', () => {
    const result = check({ productivityWindows: [{ ...VALID_WINDOW, factor: 'fast' }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.factor: expected number between 0 and 1`);
  });

  it('rejects a factor below 0', () => {
    const result = check({ productivityWindows: [{ ...VALID_WINDOW, factor: -0.5 }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.factor: expected number between 0 and 1`);
  });

  it('rejects a factor above 1', () => {
    const result = check({ productivityWindows: [{ ...VALID_WINDOW, factor: 1.5 }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.factor: expected number between 0 and 1`);
  });

  it('accepts a valid window and both boundary factors', () => {
    expect(check({ productivityWindows: [VALID_WINDOW] }).valid).toBe(true);
    expect(check({ productivityWindows: [{ ...VALID_WINDOW, factor: 0 }] }).valid).toBe(true);
    expect(check({ productivityWindows: [{ ...VALID_WINDOW, factor: 1 }] }).valid).toBe(true);
  });
});

describe('validateHistoricalCostEntry — reached through reforecast.historicalCosts', () => {
  const at = `${P}.historicalCosts[0]`;

  it('rejects a non-object entry', () => {
    const result = check({ historicalCosts: [null] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}: expected object`);
    expect(result.errors.filter((e) => e.startsWith(`${at}.`))).toEqual([]);
  });

  it('rejects a malformed month', () => {
    const result = check({ historicalCosts: [{ ...VALID_HISTORICAL, month: '2026' }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.month: expected YYYY-MM month string`);
  });

  it('rejects a negative cost', () => {
    const result = check({ historicalCosts: [{ ...VALID_HISTORICAL, cost: -1 }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.cost: expected non-negative number`);
  });

  it('rejects a non-finite cost', () => {
    const result = check({ historicalCosts: [{ ...VALID_HISTORICAL, cost: NaN }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.cost: expected non-negative number`);
  });

  it('rejects a negative hours', () => {
    const result = check({ historicalCosts: [{ ...VALID_HISTORICAL, hours: -8 }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.hours: expected non-negative number`);
  });

  it('rejects a missing hours', () => {
    const result = check({ historicalCosts: [{ month: '2026-06', cost: 100 }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${at}.hours: expected non-negative number`);
  });

  it('accepts a valid entry and a zero-cost zero-hours entry', () => {
    expect(check({ historicalCosts: [VALID_HISTORICAL] }).valid).toBe(true);
    expect(check({ historicalCosts: [{ month: '2026-06', cost: 0, hours: 0 }] }).valid).toBe(true);
  });
});

describe('validateReforecast — a fully populated reforecast', () => {
  it('accepts every child array populated with valid entries at once', () => {
    const result = check({
      assignments: [VALID_ASSIGNMENT],
      allocations: [VALID_ALLOCATION],
      productivityWindows: [VALID_WINDOW],
      historicalCosts: [VALID_HISTORICAL],
      actualsThroughDate: '2026-09-30',
      notes: 'Populated fixture.',
    });
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('reports every child rejection together rather than stopping at the first', () => {
    const result = check({
      assignments: [{ id: 'as1' }],
      allocations: [{ memberId: 'as1', month: 'nope', allocation: 2 }],
      productivityWindows: [{ ...VALID_WINDOW, factor: 9 }],
      historicalCosts: [{ month: '2026-06', cost: -1, hours: 1 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${P}.assignments[0].poolMemberId: expected string`);
    expect(result.errors).toContain(`${P}.allocations[0].month: expected YYYY-MM month string`);
    expect(result.errors).toContain(
      `${P}.allocations[0].allocation: expected number between 0 and 1`,
    );
    expect(result.errors).toContain(
      `${P}.productivityWindows[0].factor: expected number between 0 and 1`,
    );
    expect(result.errors).toContain(`${P}.historicalCosts[0].cost: expected non-negative number`);
  });
});
