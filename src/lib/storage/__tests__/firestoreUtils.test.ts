// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import {
  buildTeamSnapshot, buildProjectTeamSnapshot, stripUndefined, docToProject,
  sanitizeCostSnapshot,
} from '../firestoreUtils';
import type { Project, ProjectAssignment, PoolMember } from '@/types/domain';

describe('buildTeamSnapshot', () => {
  const pool: PoolMember[] = [
    { id: 'pm-1', name: 'Alice', role: 'BA' },
    { id: 'pm-2', name: 'Bob', role: 'IT-SoftEng' },
    { id: 'pm-3', name: 'Carol', role: 'Manager' },
  ];

  it('maps assigned pool members to name/role snapshot', () => {
    const assignments: ProjectAssignment[] = [
      { id: 'a-1', poolMemberId: 'pm-1' },
      { id: 'a-2', poolMemberId: 'pm-2' },
    ];
    expect(buildTeamSnapshot(assignments, pool)).toEqual({
      'pm-1': { name: 'Alice', role: 'BA' },
      'pm-2': { name: 'Bob', role: 'IT-SoftEng' },
    });
  });

  it('skips assignments with missing pool members', () => {
    const assignments: ProjectAssignment[] = [
      { id: 'a-1', poolMemberId: 'pm-1' },
      { id: 'a-2', poolMemberId: 'pm-deleted' },
    ];
    expect(buildTeamSnapshot(assignments, pool)).toEqual({
      'pm-1': { name: 'Alice', role: 'BA' },
    });
  });

  it('deduplicates when same pool member appears twice', () => {
    const assignments: ProjectAssignment[] = [
      { id: 'a-1', poolMemberId: 'pm-1' },
      { id: 'a-2', poolMemberId: 'pm-1' },
    ];
    const snapshot = buildTeamSnapshot(assignments, pool);
    expect(Object.keys(snapshot)).toHaveLength(1);
    expect(snapshot['pm-1']).toEqual({ name: 'Alice', role: 'BA' });
  });

  it('returns empty object for no assignments', () => {
    expect(buildTeamSnapshot([], pool)).toEqual({});
  });

  it('returns empty object for empty pool', () => {
    const assignments: ProjectAssignment[] = [
      { id: 'a-1', poolMemberId: 'pm-1' },
    ];
    expect(buildTeamSnapshot(assignments, [])).toEqual({});
  });
});

describe('stripUndefined', () => {
  it('removes undefined values', () => {
    const obj = { a: 1, b: undefined, c: 'hello' };
    expect(stripUndefined(obj)).toEqual({ a: 1, c: 'hello' });
  });

  it('preserves null values (Firestore accepts null)', () => {
    const obj = { a: null, b: 'test' };
    expect(stripUndefined(obj)).toEqual({ a: null, b: 'test' });
  });

  it('preserves false and 0', () => {
    const obj = { a: false, b: 0, c: '' };
    expect(stripUndefined(obj)).toEqual({ a: false, b: 0, c: '' });
  });

  it('returns empty object when all values are undefined', () => {
    const obj = { a: undefined, b: undefined };
    expect(stripUndefined(obj)).toEqual({});
  });

  it('returns same object when no undefined values', () => {
    const obj = { a: 1, b: 'test' };
    expect(stripUndefined(obj)).toEqual({ a: 1, b: 'test' });
  });
});

describe('docToProject', () => {
  it('converts a modern (schemaVersion 2) Firestore doc to Project', () => {
    const data = {
      name: 'Test Project',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      reforecasts: [
        {
          id: 'rf-1',
          name: 'Baseline',
          assignments: [{ id: 'a-1', poolMemberId: 'pm-1' }],
        },
      ],
      activeReforecastId: 'rf-1',
      // Cloud-only fields should be ignored
      owner: 'uid-123',
      members: { 'uid-123': 'owner' },
      order: 0,
      schemaVersion: 2,
    };
    const project = docToProject('proj-1', data);
    expect(project).toEqual({
      id: 'proj-1',
      name: 'Test Project',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      reforecasts: [
        {
          id: 'rf-1',
          name: 'Baseline',
          assignments: [{ id: 'a-1', poolMemberId: 'pm-1' }],
        },
      ],
      activeReforecastId: 'rf-1',
    });
    expect((project as unknown as Record<string, unknown>).assignments).toBeUndefined();
  });

  it('provides defaults for missing fields and no project-level assignments', () => {
    const project = docToProject('proj-1', {});
    expect(project).toEqual({
      id: 'proj-1',
      name: '',
      startDate: '',
      endDate: '',
      reforecasts: [],
      activeReforecastId: null,
    });
    expect((project as unknown as Record<string, unknown>).assignments).toBeUndefined();
  });

  it('uses provided id, not data.id', () => {
    const project = docToProject('my-id', { id: 'wrong-id', name: 'Test' });
    expect(project.id).toBe('my-id');
  });

  it('hydrates archived only when data.archived === true', () => {
    expect(docToProject('p', { name: 'X', archived: true }).archived).toBe(true);
  });

  it('leaves archived absent for false / null / missing (all collapse to active)', () => {
    expect(docToProject('p', { name: 'X', archived: false }).archived).toBeUndefined();
    expect(docToProject('p', { name: 'X', archived: null }).archived).toBeUndefined();
    expect(docToProject('p', { name: 'X' }).archived).toBeUndefined();
  });

  describe('backward compat (legacy schemaVersion 1 docs)', () => {
    it('hydrates legacy top-level assignments into reforecasts that lack their own', () => {
      const legacy = {
        name: 'Legacy',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        // Top-level assignments — schemaVersion 1 location
        assignments: [
          { id: 'a-1', poolMemberId: 'pm-1' },
          { id: 'a-2', poolMemberId: 'pm-2' },
        ],
        reforecasts: [
          { id: 'rf-1', name: 'Baseline' },
          { id: 'rf-2', name: 'Q3' },
        ],
        activeReforecastId: 'rf-2',
        schemaVersion: 1,
      };
      const project = docToProject('legacy-1', legacy);
      // Top-level assignments stripped from the returned project
      expect((project as unknown as Record<string, unknown>).assignments).toBeUndefined();
      // Each reforecast hydrated with cloned assignments (deep clone — distinct refs)
      expect(project.reforecasts[0].assignments).toEqual([
        { id: 'a-1', poolMemberId: 'pm-1' },
        { id: 'a-2', poolMemberId: 'pm-2' },
      ]);
      expect(project.reforecasts[1].assignments).toEqual([
        { id: 'a-1', poolMemberId: 'pm-1' },
        { id: 'a-2', poolMemberId: 'pm-2' },
      ]);
      expect(project.reforecasts[0].assignments).not.toBe(project.reforecasts[1].assignments);
    });

    it('per-reforecast assignments win when both legacy and modern fields are present', () => {
      const mixed = {
        name: 'Mixed',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        assignments: [{ id: 'a-legacy', poolMemberId: 'pm-legacy' }],
        reforecasts: [
          {
            id: 'rf-1',
            name: 'Baseline',
            assignments: [{ id: 'a-modern', poolMemberId: 'pm-modern' }],
          },
        ],
        activeReforecastId: 'rf-1',
      };
      const project = docToProject('mixed-1', mixed);
      expect(project.reforecasts[0].assignments).toEqual([
        { id: 'a-modern', poolMemberId: 'pm-modern' },
      ]);
    });

    it('handles legacy doc with empty top-level assignments', () => {
      const legacy = {
        name: 'Legacy Empty',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        assignments: [],
        reforecasts: [{ id: 'rf-1', name: 'Baseline' }],
        activeReforecastId: 'rf-1',
        schemaVersion: 1,
      };
      const project = docToProject('legacy-empty', legacy);
      expect(project.reforecasts[0].assignments).toEqual([]);
    });
  });
});

describe('buildProjectTeamSnapshot', () => {
  const pool: PoolMember[] = [
    { id: 'pm-1', name: 'Alice', role: 'BA' },
    { id: 'pm-2', name: 'Bob', role: 'IT-SoftEng' },
  ];

  function projectWith(
    rosters: ProjectAssignment[][],
    prior?: Record<string, { name: string; role: string }>,
  ): Project {
    return {
      id: 'p1',
      name: 'P',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      activeReforecastId: 'rf0',
      ...(prior ? { _teamSnapshot: prior } : {}),
      reforecasts: rosters.map((assignments, i) => ({
        id: `rf${i}`,
        name: `RF${i}`,
        createdAt: '2026-01-01T00:00:00Z',
        reforecastDate: '2026-01-01',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        assignments,
        allocations: [],
        productivityWindows: [],
        actualCost: 0,
        baselineBudget: 0,
      })),
    };
  }

  it('unions the rosters of every reforecast', () => {
    const p = projectWith([
      [{ id: 'a1', poolMemberId: 'pm-1' }],
      [{ id: 'a2', poolMemberId: 'pm-2' }],
    ]);
    expect(buildProjectTeamSnapshot(p, pool)).toEqual({
      'pm-1': { name: 'Alice', role: 'BA' },
      'pm-2': { name: 'Bob', role: 'IT-SoftEng' },
    });
  });

  it('returns the freshly built map verbatim when there is no prior snapshot', () => {
    const p = projectWith([[{ id: 'a1', poolMemberId: 'pm-1' }]]);
    expect(buildProjectTeamSnapshot(p, pool)).toEqual({ 'pm-1': { name: 'Alice', role: 'BA' } });
  });

  it('tolerates a reforecast whose assignments array is absent', () => {
    // docToProject always supplies one, but legacy/partial docs reach the
    // write path too and a throw here would block the save entirely.
    const p = projectWith([[{ id: 'a1', poolMemberId: 'pm-1' }]]);
    delete (p.reforecasts[0] as { assignments?: unknown }).assignments;
    expect(buildProjectTeamSnapshot(p, pool)).toEqual({});
  });
});

describe('docToProject — _teamSnapshot hydration (v0.38.2)', () => {
  const base = {
    name: 'P', startDate: '2026-01-01', endDate: '2026-12-31',
    reforecasts: [], activeReforecastId: 'rf1',
  };

  it('hydrates a well-formed snapshot onto the domain object', () => {
    // [FAILS-TODAY] docToProject discarded this field from v0.16.0 to v0.38.1.
    // It was written to every project doc and read by nothing, so the fallback
    // in resolveAssignments — which exists and is unit-tested — could never
    // receive it.
    const project = docToProject('p1', {
      ...base,
      _teamSnapshot: { 'pm-1': { name: 'Alice', role: 'BA' } },
    });
    expect(project._teamSnapshot).toEqual({ 'pm-1': { name: 'Alice', role: 'BA' } });
  });

  it('leaves the field ABSENT when the document has no snapshot', () => {
    expect(docToProject('p1', { ...base })).not.toHaveProperty('_teamSnapshot');
  });

  it('collapses an EMPTY map to absent', () => {
    // "no snapshot" and "an empty snapshot" must be the same state, or
    // resolveAssignments consults an object that can tell it nothing.
    expect(docToProject('p1', { ...base, _teamSnapshot: {} })).not.toHaveProperty('_teamSnapshot');
  });

  it('drops malformed ENTRIES without discarding the whole map', () => {
    const project = docToProject('p1', {
      ...base,
      _teamSnapshot: {
        'pm-1': { name: 'Alice', role: 'BA' },
        'pm-bad': { name: 42, role: 'QA' },
        'pm-null': null,
        'pm-str': 'nope',
      },
    });
    expect(project._teamSnapshot).toEqual({ 'pm-1': { name: 'Alice', role: 'BA' } });
  });

  it.each([
    ['a string', 'nope'],
    ['an array', [{ name: 'Alice', role: 'BA' }]],
    ['null', null],
  ])('ignores a snapshot field that is %s', (_label, value) => {
    expect(docToProject('p1', { ...base, _teamSnapshot: value })).not.toHaveProperty('_teamSnapshot');
  });
});

describe('sanitizeCostSnapshot (v0.39.0)', () => {
  const RATES = [{ role: 'BA', hourlyRate: 75 }];
  const HOLIDAY = { id: 'h1', name: 'Independence Day', startDate: '2026-07-03', endDate: '2026-07-03' };
  const valid = { laborRates: RATES, holidays: [HOLIDAY], discountRateAnnual: 0.05 };

  describe('top level', () => {
    it('accepts a well-formed snapshot and returns exactly the three keys', () => {
      const out = sanitizeCostSnapshot(valid);
      expect(out).toEqual(valid);
      expect(Object.keys(out!).sort())
        .toEqual(['discountRateAnnual', 'holidays', 'laborRates']);
    });

    it('DROPS a fourth key rather than passing the stored object through', () => {
      // The rebuild is what stops an unknown key reaching a reader. A sanitizer
      // that returned its input would pass every other test in this block.
      const out = sanitizeCostSnapshot({ ...valid, trafficLightThresholds: { amberPercent: 99 } });
      expect(out).not.toHaveProperty('trafficLightThresholds');
      expect(out).toEqual(valid);
    });

    it.each([
      ['laborRates', { holidays: [HOLIDAY], discountRateAnnual: 0.05 }],
      ['holidays', { laborRates: RATES, discountRateAnnual: 0.05 }],
      ['discountRateAnnual', { laborRates: RATES, holidays: [HOLIDAY] }],
    ])('REJECTS WHOLE when %s is missing — there is nothing to construct', (_f, partial) => {
      expect(sanitizeCostSnapshot(partial)).toBeUndefined();
    });

    it.each([
      ['null', null], ['a string', 'nope'], ['a number', 7], ['an array', [valid]], ['undefined', undefined],
    ])('rejects %s', (_l, v) => {
      expect(sanitizeCostSnapshot(v)).toBeUndefined();
    });

    it('ACCEPTS holidays: [] — an owner with no holidays is a legitimate value', () => {
      // ⚠️ Deliberately NOT copying sanitizeTeamSnapshot's "empty ⇒ undefined"
      // rule. An empty holiday list is a real answer, not a missing one.
      expect(sanitizeCostSnapshot({ ...valid, holidays: [] })?.holidays).toEqual([]);
    });

    it('ACCEPTS discountRateAnnual: 0 — zero is falsy and must not be rejected', () => {
      expect(sanitizeCostSnapshot({ ...valid, discountRateAnnual: 0 })?.discountRateAnnual).toBe(0);
    });
  });

  describe('element level — one rule: a bad ELEMENT drops, an unusable FIELD rejects', () => {
    it('DROPS a null holiday and keeps the rest of the snapshot', () => {
      // ⚠️ Under a top-level-only sanitizer this was ADMITTED and threw a
      // TypeError out of calculateProjectMetrics (countHolidayWorkdays reads
      // holiday.startDate). Dropping is what closes that.
      const out = sanitizeCostSnapshot({ ...valid, holidays: [null, HOLIDAY] });
      expect(out?.holidays).toEqual([HOLIDAY]);
      expect(out?.laborRates, 'the rate card is untouched by a bad holiday').toEqual(RATES);
    });

    it('DROPS a null labor rate and keeps the rest', () => {
      const out = sanitizeCostSnapshot({ ...valid, laborRates: [null, ...RATES] });
      expect(out?.laborRates).toEqual(RATES);
      expect(out?.holidays, 'holidays are untouched by a bad rate').toEqual([HOLIDAY]);
    });

    it('DROPS a holiday whose startDate is not a string', () => {
      const out = sanitizeCostSnapshot({ ...valid, holidays: [{ ...HOLIDAY, startDate: 42 }] });
      expect(out?.holidays).toEqual([]);
    });

    it('DROPS a holiday missing id or name — all four fields are validated', () => {
      const out = sanitizeCostSnapshot({
        ...valid,
        holidays: [{ startDate: '2026-07-03', endDate: '2026-07-03' }, HOLIDAY],
      });
      expect(out?.holidays).toEqual([HOLIDAY]);
    });

    it.each([['NaN', NaN], ['Infinity', Infinity], ['a string', '75']])(
      'DROPS a labor rate whose hourlyRate is %s, keeping its siblings',
      (_l, bad) => {
        const out = sanitizeCostSnapshot({
          ...valid,
          laborRates: [{ role: 'Broken', hourlyRate: bad }, ...RATES],
        });
        expect(out?.laborRates).toEqual(RATES);
      },
    );

    it('KEEPS hourlyRate: 0 — a $0 role is a deliberate feature, not a defect', () => {
      // ⚠️ v0.37.4 accepts `>= 0` for infrastructure roles that carry no cost.
      // The truthy spelling `!hourlyRate` would drop this rate and silently
      // unprice the role. Number.isFinite is the only correct spelling.
      const zero = { role: 'Shared Infrastructure', hourlyRate: 0 };
      const out = sanitizeCostSnapshot({ ...valid, laborRates: [zero, ...RATES] });
      expect(out?.laborRates).toEqual([zero, ...RATES]);
    });

    it.each([['NaN', NaN], ['Infinity', Infinity], ['a string', '0.05'], ['null', null]])(
      'REJECTS WHOLE when discountRateAnnual is %s — a scalar has no element to drop',
      (_l, bad) => {
        // ⚠️ THE COST IS NOT ZERO AND IS ACCEPTED, NOT ABSENT: this discards the
        // owner's laborRates and holidays too, so the reader falls back to their
        // own card and 48% of owner roles reprice silently. A sanitizer must
        // never invent a number, and a partial snapshot would carry mixed,
        // unrecorded provenance no read site could attribute. Revisit in v0.40.0.
        expect(sanitizeCostSnapshot({ ...valid, discountRateAnnual: bad })).toBeUndefined();
      },
    );

    it.each([['laborRates'], ['holidays']])(
      'REJECTS WHOLE when %s is present but not an array',
      (field) => {
        expect(sanitizeCostSnapshot({ ...valid, [field]: 'nope' })).toBeUndefined();
      },
    );

    it('BOUNDARY: every labor rate malformed leaves laborRates: [] rather than rejecting', () => {
      // ⚠️ This is the boundary between the two dispositions, and it is loud
      // rather than silent — which is why drop semantics are acceptable. With
      // an empty rate card every role is unpriced, so AllocationGridRow's
      // v0.37.5 red "Role not in labor rates" marker fires on every row. The
      // alternative (reject whole) would silently reprice at the reader's card.
      const out = sanitizeCostSnapshot({ ...valid, laborRates: [null, 42, { role: 'X' }] });
      expect(out, 'the snapshot survives').toBeDefined();
      expect(out?.laborRates, 'with nothing in it').toEqual([]);
      expect(out?.holidays, 'and the holidays are still the owner’s').toEqual([HOLIDAY]);
    });
  });
});

describe('docToProject — _costSnapshot hydration (v0.39.0)', () => {
  const base = {
    name: 'P', startDate: '2026-01-01', endDate: '2026-12-31',
    reforecasts: [], activeReforecastId: 'rf1',
  };
  const valid = {
    laborRates: [{ role: 'BA', hourlyRate: 75 }],
    holidays: [],
    discountRateAnnual: 0.05,
  };

  it('hydrates a valid snapshot onto the domain object', () => {
    // ⚠️ A field written correctly by every save and never hydrated here is
    // invisible in the UI and green in every local-mode test — `_teamSnapshot`
    // was exactly that for twenty-two minors. This is wired up BEFORE a writer
    // exists so that cannot happen twice.
    expect(docToProject('p1', { ...base, _costSnapshot: valid })._costSnapshot).toEqual(valid);
  });

  it.each([
    ['null', null],
    ['missing', undefined],
    ['malformed', { laborRates: 'nope', holidays: [], discountRateAnnual: 0.05 }],
  ])('leaves the field ABSENT when the stored value is %s', (_l, stored) => {
    const doc = stored === undefined ? { ...base } : { ...base, _costSnapshot: stored };
    expect(docToProject('p1', doc)).not.toHaveProperty('_costSnapshot');
  });
});
