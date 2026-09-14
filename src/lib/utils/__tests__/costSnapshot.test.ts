// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { effectiveSettings, effectiveLaborRates, roleHasNoRate } from '../costSnapshot';
import type { Project, Settings, CostSnapshot } from '@/types/domain';

const READER_RATES = [{ role: 'BA', hourlyRate: 200 }];
const OWNER_RATES = [{ role: 'BA', hourlyRate: 75 }];
const READER_HOLIDAY = {
  id: 'h-reader', name: 'Reader Day', startDate: '2026-01-01', endDate: '2026-01-01',
};
const OWNER_HOLIDAY = {
  id: 'h-owner', name: 'Owner Day', startDate: '2026-07-03', endDate: '2026-07-03',
};

const readerSettings: Settings = {
  discountRateAnnual: 0.10,
  laborRates: READER_RATES,
  holidays: [READER_HOLIDAY],
  trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
};

const ownerSnapshot: CostSnapshot = {
  laborRates: OWNER_RATES,
  holidays: [OWNER_HOLIDAY],
  discountRateAnnual: 0.03,
};

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'p1', name: 'P', startDate: '2026-01-01', endDate: '2026-12-31',
    reforecasts: [], activeReforecastId: null, ...over,
  };
}

describe('effectiveSettings', () => {
  it('takes all three cost inputs from the snapshot when the project carries one', () => {
    const out = effectiveSettings(project({ _costSnapshot: ownerSnapshot }), readerSettings);
    expect(out.laborRates, 'the OWNER’s rates, not the reader’s').toEqual(OWNER_RATES);
    expect(out.holidays, 'the OWNER’s holidays').toEqual([OWNER_HOLIDAY]);
    expect(out.discountRateAnnual, 'the OWNER’s discount rate').toBe(0.03);
  });

  it('returns the reader’s settings unchanged when there is no snapshot', () => {
    const out = effectiveSettings(project(), readerSettings);
    expect(out).toBe(readerSettings);
  });

  /**
   * ⚠️⚠️ D1's ONLY EXECUTABLE ASSERTION, AND THE FIXTURE IS WHAT MAKES IT ABLE
   * TO FAIL. A sanitizer-produced snapshot has exactly three keys, none of them
   * `trafficLightThresholds` — so against a well-formed fixture the construction
   * and BOTH natural spread spellings produce byte-identical output and this
   * test pins nothing. It needs a snapshot carrying a ROGUE fourth key, cast
   * past the type, to discriminate.
   *
   * Measured: with this fixture, `{...settings, ...snapshot}` is CAUGHT (the
   * rogue thresholds win) and `{...snapshot, trafficLightThresholds: s.tlt}` is
   * NOT. So this test refuses the first spelling specifically.
   */
  it('takes trafficLightThresholds from the READER even when the snapshot carries one', () => {
    const rogue = {
      ...ownerSnapshot,
      trafficLightThresholds: { amberPercent: 99, redPercent: 99, violetPercent: 99 },
    } as unknown as CostSnapshot;
    const out = effectiveSettings(project({ _costSnapshot: rogue }), readerSettings);
    expect(out.trafficLightThresholds, 'a display preference stays per-reader')
      .toEqual({ amberPercent: 5, redPercent: 15, violetPercent: 20 });
  });

  it('returns exactly the four Settings keys — no rogue key survives', () => {
    const rogue = { ...ownerSnapshot, somethingElse: 1 } as unknown as CostSnapshot;
    const out = effectiveSettings(project({ _costSnapshot: rogue }), readerSettings);
    expect(Object.keys(out).sort()).toEqual([
      'discountRateAnnual', 'holidays', 'laborRates', 'trafficLightThresholds',
    ]);
  });
});

describe('effectiveLaborRates', () => {
  it('returns the snapshot’s rates when the project carries one', () => {
    expect(effectiveLaborRates(project({ _costSnapshot: ownerSnapshot }), readerSettings))
      .toEqual(OWNER_RATES);
  });

  it('falls back to the reader’s rates when there is no snapshot', () => {
    expect(effectiveLaborRates(project(), readerSettings)).toEqual(READER_RATES);
  });

  it('returns UNDEFINED when there is neither a snapshot nor loaded settings', () => {
    // ⚠️ `undefined` is MEANINGFUL, not defensive: AllocationGridRow reads
    // `laborRates !== undefined` to decide whether to flag a role as rate-less.
    // `[]` here would flag EVERY member mid-fetch. Do not add `?? []`.
    expect(effectiveLaborRates(project(), null)).toBeUndefined();
  });

  it('still returns the snapshot’s rates when settings have not loaded', () => {
    expect(effectiveLaborRates(project({ _costSnapshot: ownerSnapshot }), null))
      .toEqual(OWNER_RATES);
  });
});

describe('the pair agrees on laborRates for every input BOTH accept', () => {
  /**
   * The regression test for the divergence that killed an earlier design: three
   * hand-spelled copies of this merge disagreed under the same input, one
   * crashing and one silently returning the reader's rates.
   *
   * ⚠️ `settings === null` is deliberately NOT in this table — `effectiveSettings`
   * cannot take it (TS2345, it must return a complete Settings), so that case is
   * `effectiveLaborRates`-only and is asserted above. Forcing it past the type
   * here would reproduce the very divergence this test exists to refuse.
   */
  it.each([
    ['seeded', project({ _costSnapshot: ownerSnapshot })],
    ['unseeded', project()],
    ['seeded with an empty rate card', project({
      _costSnapshot: { ...ownerSnapshot, laborRates: [] },
    })],
  ])('%s', (_label, p) => {
    expect(effectiveLaborRates(p, readerSettings))
      .toEqual(effectiveSettings(p, readerSettings).laborRates);
  });
});

/**
 * `roleHasNoRate` — the one spelling of a rule that used to live in three
 * hand-written copies (v0.41.0).
 *
 * ⚠️ No `beforeEach` exists in this file, so appending here inherits nothing and
 * loses nothing. (Checked before appending, because a `describe` that lands
 * outside an outer block's setup is how v0.37.11's new tests passed on
 * carried-over state.)
 */
describe('roleHasNoRate', () => {
  const RATES = [{ role: 'BA', hourlyRate: 75 }];

  it('is FALSE for undefined — "not loaded yet" flags nobody', () => {
    // ⚠️ THE DISCRIMINATING ROW, and it is only evidence against the row below:
    // the wrong build is `?? []`, and a test with either case ALONE passes under
    // both implementations. The pair is what refuses it.
    expect(roleHasNoRate('BA', undefined)).toBe(false);
    expect(roleHasNoRate('Anything At All', undefined)).toBe(false);
  });

  it('is TRUE for an empty list — "loaded, and there are none" flags everybody', () => {
    expect(roleHasNoRate('BA', [])).toBe(true);
  });

  it('is FALSE when the role is priced and TRUE when it is not', () => {
    expect(roleHasNoRate('BA', RATES)).toBe(false);
    expect(roleHasNoRate('Dev', RATES)).toBe(true);
  });

  it('matches EXACTLY, because getHourlyRate does', () => {
    // `costs.ts:12` looks a role up with `find(r => r.role === role)`. A
    // case-insensitive match here would claim a rate exists for a role the calc
    // engine will not find, and price at $0 while reporting the role as priced.
    expect(roleHasNoRate('ba', RATES), 'case-sensitive').toBe(true);
    expect(roleHasNoRate('BA ', RATES), 'whitespace is not trimmed').toBe(true);
  });

  it('is TRUE for the empty role an unresolved assignment carries', () => {
    // ⚠️ A BOUND, PINNED RATHER THAN FIXED. `resolveAssignments` renders an
    // unresolvable member as `{ name: '(Unknown)', role: '' }`, and an empty role
    // matches no rate. Counting them is TRUE about the cost — it really is $0 —
    // but the cause is an unresolved assignment, not a missing rate. The grid's
    // per-row marker makes the identical claim about the identical member, and
    // an aggregate disagreeing with the markers beside it would be worse than
    // one that inherits their bound. v0.38.2's standing residual.
    expect(roleHasNoRate('', RATES)).toBe(true);
  });
});
