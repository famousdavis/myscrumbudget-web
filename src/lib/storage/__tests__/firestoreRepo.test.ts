// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Behavioural characterisation of the Firestore repository.
 *
 * Why this file exists: `firestoreRepo.ts` measured 4/93 statements, 0/64
 * branches and 0/21 functions, with ZERO complexity findings (7 functions, the
 * highest `importAll` at cc 11 against a threshold of 15). It is invisible to
 * both installed instruments — and it is consequently the file this project's
 * planning documents have been wrong about three separate times. Untested code
 * does not merely risk defects; it degrades the accuracy of everything written
 * about it.
 *
 * ⚠️ LOADED IS NOT EXECUTED. The module was always imported (via
 * `useInvitationLanding`), so it never showed as "never loaded" in the way an
 * unreferenced file does; it simply had nothing executable at module scope until
 * v0.36.10 added the field guards. A self-check that asserts the module imports
 * proves nothing at all. The first test below asserts the boundary is REACHED.
 *
 * ⚠️ TWO MOCKS ARE REQUIRED, and the second is the one that gets forgotten.
 * `config.ts` computes `isFirebaseConfigured = Boolean(firebaseConfig.apiKey)`;
 * vitest loads no `.env.local`, so the key is undefined, `app` is null and
 * `db` is null. `createFirestoreRepository` opens with `if (!db) throw`, so
 * mocking only `firebase/firestore` yields a suite that never constructs the
 * repository — green, and testing nothing.
 *
 * ⚠️ This file is also the PERMANENT SUCCESSOR to the throwaway probe used to
 * prove v0.36.10 changed no behaviour. That probe is deleted. The two things it
 * checked — the resolved `mergeFields` ORDER, and a fully-populated document
 * round-tripped through `docToProject` including the cleared variants — are
 * pinned here, or they are checked nowhere.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Project, Settings } from '@/types/domain';

/** Every setDoc call, in order: { ref, data, options }. */
type SetDocCall = { ref: { col: string; id: string }; data: Record<string, unknown>; options?: { mergeFields?: string[] } };
const setDocCalls: SetDocCall[] = [];
/** Documents the mocked getDoc will claim exist, keyed by id. */
const existingDocs = new Map<string, Record<string, unknown>>();
/** When set, getDoc throws — the PERMISSION_DENIED path importAll catches. */
let getDocThrows = false;
/** Documents the mocked getDocs query will return, as [id, data] pairs. */
const queryDocs = new Map<string, Record<string, unknown>>();

vi.mock('@/lib/firebase/config', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => ({ col, id }),
  getDoc: async (ref: { id: string }) => {
    if (getDocThrows) throw new Error('PERMISSION_DENIED');
    const data = existingDocs.get(ref.id);
    return { exists: () => data !== undefined, data: () => data, id: ref.id };
  },
  setDoc: async (ref: SetDocCall['ref'], data: Record<string, unknown>, options?: SetDocCall['options']) => {
    setDocCalls.push({ ref, data, options });
  },
  deleteDoc: async () => {},
  collection: (_db: unknown, col: string) => ({ col }),
  query: (...args: unknown[]) => ({ args }),
  where: (...args: unknown[]) => ({ args }),
  getDocs: async () => {
    // getProjects uses snap.forEach, not snap.docs — a `{ docs: [] }` mock
    // would throw rather than return an empty result.
    const entries = [...queryDocs.entries()].map(([id, data]) => ({ id, data: () => data }));
    return { forEach: (fn: (d: { id: string; data: () => Record<string, unknown> }) => void) => entries.forEach(fn), docs: entries };
  },
  writeBatch: () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: async () => {} }),
}));

const { createFirestoreRepository } = await import('../firestoreRepo');

const UID = 'uid_1';

function makeProject(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Project One',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    reforecasts: [
      {
        id: 'rf1',
        name: 'Baseline',
        createdAt: '2026-01-01T00:00:00Z',
        reforecastDate: '2026-01-01',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        assignments: [{ id: 'a1', poolMemberId: 'pm1' }],
        allocations: [{ memberId: 'a1', month: '2026-01', allocation: 0.5 }],
        productivityWindows: [],
        actualCost: 0,
        baselineBudget: 100000,
      },
    ],
    activeReforecastId: 'rf1',
    ...over,
  };
}

beforeEach(() => {
  setDocCalls.length = 0;
  existingDocs.clear();
  queryDocs.clear();
  getDocThrows = false;
});

describe('mock self-check — read this before any coverage number', () => {
  it('reaches setDoc with a non-empty payload', async () => {
    // INVERTED PRE-REGISTRATION: any branch coverage above ~20% that cannot be
    // traced to a specific payload assertion is a signal to inspect this mock,
    // not a result. If this test fails, every number in this file is void.
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(makeProject());

    expect(setDocCalls).toHaveLength(1);
    const [call] = setDocCalls;
    expect(call.ref.col).toBe('myscrumbudget_projects');
    expect(call.ref.id).toBe('p1');
    expect(Object.keys(call.data).length).toBeGreaterThan(0);
    // Not merely non-empty — a real field with a real value from the input.
    expect(call.data.name).toBe('Project One');
  });

  it('constructs against a non-null db (the config mock is doing work)', () => {
    // Without the @/lib/firebase/config mock this throws 'Firestore is not
    // initialized' and nothing below ever runs.
    expect(() => createFirestoreRepository(UID)).not.toThrow();
  });
});

describe('saveProject — the v0.30.0 import-replace invariant', () => {
  /** The nine fields saveProject is allowed to write, in resolved order. */
  const EXPECTED_MERGE_FIELDS = [
    'name', 'startDate', 'endDate', 'reforecasts',
    'activeReforecastId', 'color', 'archived', '_teamSnapshot', 'updatedAt',
  ];

  it('writes exactly its nine mergeFields, in order', async () => {
    // PROBE SUCCESSOR (1 of 2). v0.36.10 replaced an inline string[] with a
    // `satisfies`-checked constant resolved via Object.keys; the throwaway probe
    // that proved the ORDER unchanged is gone, so this is the only check of it.
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(makeProject());

    expect(setDocCalls[0].options?.mergeFields).toEqual(EXPECTED_MERGE_FIELDS);
  });

  it('OMITS the seven ownership and identity fields', async () => {
    // Load-bearing: the v0.30.0 import 'replace' path depends on these
    // surviving a save. Writing any of them here would silently reset
    // ownership or reorder the dashboard on every autosave.
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(makeProject());

    const written = Object.keys(setDocCalls[0].data);
    for (const forbidden of ['owner', 'members', 'order', 'createdAt', '_originRef', '_changeLog', 'schemaVersion']) {
      expect(written).not.toContain(forbidden);
    }
    expect(setDocCalls[0].options?.mergeFields).not.toContain('owner');
  });

  it('writes color and archived as null — not undefined — when absent', async () => {
    // `mergeFields` only unsets a listed field if the payload carries an
    // explicit null; `undefined` is stripped before the write and the stale
    // cloud value survives. So "cleared" must serialise as null.
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(makeProject({ color: undefined, archived: undefined }));

    expect(setDocCalls[0].data.color).toBeNull();
    expect(setDocCalls[0].data.archived).toBeNull();
    expect('color' in setDocCalls[0].data).toBe(true);
  });

  it('round-trips a set color and archived unchanged', async () => {
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(makeProject({ color: 'teal', archived: true }));

    expect(setDocCalls[0].data.color).toBe('teal');
    expect(setDocCalls[0].data.archived).toBe(true);
  });
});

describe('getSettings — the v0.27.0 field-wise merge', () => {
  async function readSettings(stored: Record<string, unknown> | undefined): Promise<Settings> {
    existingDocs.clear();
    if (stored) existingDocs.set(UID, stored);
    const repo = createFirestoreRepository(UID);
    return repo.getSettings();
  }

  it('injects a missing threshold field into a pre-v0.27.0 document', async () => {
    // THE SHIPPED DEFECT, by symbol: getSettings' trafficLightThresholds merge.
    // The original `data.trafficLightThresholds ?? DEFAULT` short-circuited on
    // the truthy stored object, so violetPercent was never injected and cloud
    // users read an incomplete thresholds object.
    const settings = await readSettings({
      discountRateAnnual: 0.07,
      laborRates: [{ role: 'BA', hourlyRate: 100 }],
      holidays: [],
      trafficLightThresholds: { amberPercent: 3, redPercent: 9 },
    });

    // User-customised values survive...
    expect(settings.trafficLightThresholds.amberPercent).toBe(3);
    expect(settings.trafficLightThresholds.redPercent).toBe(9);
    // ...and the field the stored document predates is filled from defaults.
    expect(settings.trafficLightThresholds.violetPercent).toBe(20);
  });

  it('keeps the three sibling `??` fallbacks WHOLE-VALUE — they are correct as-is', async () => {
    // ⚠️ The distinction this test exists to pin. discountRateAnnual, laborRates
    // and holidays use `data.x ?? DEFAULT.x`, which is the same shape as the
    // v0.27.0 bug — and here it is RIGHT, because they are a scalar and two
    // arrays with no fields to merge. Converting one of these to a spread would
    // change behaviour: a stored empty laborRates array would be replaced by the
    // defaults instead of respected. Do not "fix" them to match the sibling.
    const settings = await readSettings({
      discountRateAnnual: 0,
      laborRates: [],
      holidays: [],
      trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
    });

    // The values 0 and [] are chosen deliberately, not incidentally: they are
    // exactly where `??` and a spread diverge in a way that matters. `??` keeps a
    // stored 0 and a stored []; spreading an array into an object would destroy
    // it outright, and `||` would replace the 0. Values that merely differ from
    // the defaults would pass under every implementation and pin nothing.
    expect(settings.discountRateAnnual).toBe(0);
    expect(settings.laborRates).toEqual([]);
    expect(settings.holidays).toEqual([]);
  });

  it('returns defaults wholesale when no settings document exists', async () => {
    const settings = await readSettings(undefined);
    expect(settings.trafficLightThresholds).toEqual({
      amberPercent: 5, redPercent: 15, violetPercent: 20,
    });
  });
});

describe('createProject — ownership is set here and nowhere else', () => {
  it('stamps owner, members, order and schemaVersion', async () => {
    // order is assigned from the CURRENT project count, so seed two.
    queryDocs.set('existing1', { name: 'A', members: { [UID]: 'owner' }, order: 0 });
    queryDocs.set('existing2', { name: 'B', members: { [UID]: 'owner' }, order: 1 });

    const repo = createFirestoreRepository(UID);
    await repo.createProject(makeProject({ id: 'p_new' }));

    const call = setDocCalls.find((c) => c.ref.id === 'p_new')!;
    expect(call.data.owner).toBe(UID);
    expect(call.data.members).toEqual({ [UID]: 'owner' });
    expect(call.data.order).toBe(2);
    expect(call.data.schemaVersion).toBe(2);
  });

  it('writes with NO merge — a create replaces the document entirely', async () => {
    // The counterpart to saveProject's mergeFields. If a create merged, a
    // recycled document id would inherit the previous owner's fields.
    const repo = createFirestoreRepository(UID);
    await repo.createProject(makeProject({ id: 'p_new' }));

    const call = setDocCalls.find((c) => c.ref.id === 'p_new')!;
    expect(call.options).toBeUndefined();
  });
});

describe('getProjects / getProject — the docToProject round-trip', () => {
  /** A document with every field populated, as Firestore would hold it. */
  function fullDoc(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      name: 'Project One',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      reforecasts: makeProject().reforecasts,
      activeReforecastId: 'rf1',
      color: 'teal',
      archived: true,
      owner: UID,
      members: { [UID]: 'owner', other: 'editor' },
      order: 0,
      _teamSnapshot: { a1: { name: 'Alice', role: 'BA' } },
      _originRef: UID,
      _changeLog: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
      schemaVersion: 2,
      ...over,
    };
  }

  it('hydrates every domain field from a fully-populated document', async () => {
    // PROBE SUCCESSOR (2 of 2). v0.36.10 added a compile-time completeness guard
    // to docToProject; the throwaway probe that proved the READ half unchanged is
    // gone, so this is the only behavioural check that a populated document
    // round-trips. A field written correctly by every save and never hydrated
    // here is invisible in the UI and green in every local-mode test.
    existingDocs.set('p1', fullDoc());
    const repo = createFirestoreRepository(UID);
    const project = await repo.getProject('p1');

    expect(project).not.toBeNull();
    expect(Object.keys(project!).sort()).toEqual([
      'activeReforecastId', 'archived', 'color', 'endDate', 'id', 'name', 'reforecasts', 'startDate',
    ]);
    expect(project!.id).toBe('p1');
    expect(project!.color).toBe('teal');
    expect(project!.archived).toBe(true);
    expect(project!.activeReforecastId).toBe('rf1');
    // Cloud-only metadata must NOT leak onto the domain object.
    expect('owner' in project!).toBe(false);
    expect('_changeLog' in project!).toBe(false);
  });

  it('collapses the CLEARED variants back to absent, not to null or false', async () => {
    // The other half of what the probe checked. color: null and archived: false
    // are how "cleared" is stored (so mergeFields can unset), and they must not
    // hydrate as null/false — absent is the domain representation.
    existingDocs.set('p1', fullDoc({ color: null, archived: false }));
    const repo = createFirestoreRepository(UID);
    const project = await repo.getProject('p1');

    expect('color' in project!).toBe(false);
    expect('archived' in project!).toBe(false);
  });

  it('ignores an unknown colour rather than hydrating it', async () => {
    existingDocs.set('p1', fullDoc({ color: 'chartreuse' }));
    const repo = createFirestoreRepository(UID);
    expect('color' in (await repo.getProject('p1'))!).toBe(false);
  });

  it('returns null for a document that does not exist', async () => {
    const repo = createFirestoreRepository(UID);
    expect(await repo.getProject('nope')).toBeNull();
  });

  it('sorts by the stored order field and strips it from the result', async () => {
    queryDocs.set('pB', fullDoc({ name: 'B', order: 2 }));
    queryDocs.set('pA', fullDoc({ name: 'A', order: 0 }));
    queryDocs.set('pC', fullDoc({ name: 'C', order: 1 }));

    const repo = createFirestoreRepository(UID);
    const projects = await repo.getProjects();

    expect(projects.map((p) => p.name)).toEqual(['A', 'C', 'B']);
    expect('_order' in projects[0]).toBe(false);
    // _memberCount is deliberately KEPT — the dashboard "Shared" badge reads it.
    expect((projects[0] as Project & { _memberCount?: number })._memberCount).toBe(2);
  });
});

describe('importAll — RECORDED TECH DEBT, characterised and deliberately not fixed', () => {
  function makeState(over: Record<string, unknown> = {}) {
    return {
      version: '0.16.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
        holidays: [],
        trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
      },
      teamPool: [{ id: 'pm1', name: 'Alice', role: 'BA' }],
      projects: [makeProject()],
      ...over,
    } as unknown as Parameters<ReturnType<typeof createFirestoreRepository>['importAll']>[0];
  }

  const projectWrites = () => setDocCalls.filter((c) => c.ref.col === 'myscrumbudget_projects');

  it('DOES NOT preserve a project’s existing createdAt — it stamps import time', async () => {
    // ⚠️ THE QUALITY CONDITION, pre-registered: assert the OBSERVABLE
    // CONSEQUENCE, not the literal. A test reading `expect(data.createdAt)
    // .toBe(now)` would transcribe the implementation and lock the debt in
    // place — it would fail the day someone legitimately fixes this. Asserting
    // that a KNOWN PRIOR VALUE does not survive states the behaviour, and stays
    // correct as a failing test the moment the debt is repaid.
    const original = '2020-06-01T00:00:00Z';
    existingDocs.set('p1', { members: { [UID]: 'owner' }, createdAt: original, order: 7 });

    const repo = createFirestoreRepository(UID);
    await repo.importAll(makeState());

    const write = projectWrites()[0];
    expect(write.data.createdAt).not.toBe(original);
    // Same for order: the imported index wins over whatever was stored.
    expect(write.data.order).not.toBe(7);
    expect(write.data.order).toBe(0);
  });

  it('overwrites _originRef with the UID when the import carries none', async () => {
    const repo = createFirestoreRepository(UID);
    await repo.importAll(makeState());
    expect(projectWrites()[0].data._originRef).toBe(UID);
  });

  it('preserves the imported _originRef when one is present', async () => {
    const repo = createFirestoreRepository(UID);
    await repo.importAll(makeState({ _originRef: 'origin_from_file' }));
    expect(projectWrites()[0].data._originRef).toBe('origin_from_file');
  });

  it('keeps the document id when the importer is already a member', async () => {
    existingDocs.set('p1', { members: { [UID]: 'owner' } });
    const repo = createFirestoreRepository(UID);
    await repo.importAll(makeState());

    expect(projectWrites()[0].ref.id).toBe('p1');
  });

  it('REGENERATES the id when the document exists but belongs to someone else', async () => {
    // Stops an imported project id from colliding with another user's doc.
    existingDocs.set('p1', { members: { someone_else: 'owner' } });
    const repo = createFirestoreRepository(UID);
    await repo.importAll(makeState());

    expect(projectWrites()[0].ref.id).not.toBe('p1');
    expect(projectWrites()[0].ref.id).toHaveLength(36); // a UUID
  });

  it('regenerates the id when the existing document has no members map at all', async () => {
    existingDocs.set('p1', { name: 'orphan' });
    const repo = createFirestoreRepository(UID);
    await repo.importAll(makeState());
    expect(projectWrites()[0].ref.id).not.toBe('p1');
  });

  it('regenerates the id when the existence check is REJECTED, not just false', async () => {
    // getDoc throws PERMISSION_DENIED when rules read resource.data on a doc the
    // user cannot see. The catch treats that as "not mine" and mints a new id.
    getDocThrows = true;
    const repo = createFirestoreRepository(UID);
    await repo.importAll(makeState());

    expect(projectWrites()[0].ref.id).not.toBe('p1');
  });

  it('writes settings and team pool BEFORE projects', async () => {
    // Load-bearing ordering: each project's _teamSnapshot is built at write
    // time, so the pool must already be current.
    const repo = createFirestoreRepository(UID);
    await repo.importAll(makeState());

    const cols = setDocCalls.map((c) => c.ref.col);
    expect(cols.indexOf('myscrumbudget_settings')).toBeLessThan(cols.indexOf('myscrumbudget_projects'));
  });

  it('assigns order by array position across multiple projects', async () => {
    const repo = createFirestoreRepository(UID);
    await repo.importAll(makeState({
      projects: [makeProject({ id: 'pA' }), makeProject({ id: 'pB' }), makeProject({ id: 'pC' })],
    }));

    expect(projectWrites().map((c) => c.data.order)).toEqual([0, 1, 2]);
  });
});
