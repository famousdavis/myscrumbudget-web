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
import type { PoolMember, Project, Settings, TeamMember } from '@/types/domain';
import { calculateProjectMetrics } from '@/lib/calc';

/** Every setDoc call, in order: { ref, data, options }. */
type SetDocCall = { ref: { col: string; id: string }; data: Record<string, unknown>; options?: { mergeFields?: string[] } };
const setDocCalls: SetDocCall[] = [];
/** Documents the mocked getDoc will claim exist, keyed by id. */
const existingDocs = new Map<string, Record<string, unknown>>();
/**
 * Every getDoc target id, in order (v0.40.0).
 *
 * ⚠️ Recorded BEFORE the `getDocThrows` check on purpose: this counts reads
 * ATTEMPTED, not reads that succeeded. `saveProject` must make exactly ONE
 * round-trip to the settings document even though it now needs two things from
 * it (the team pool and the owner's rate card), and a read that threw is still
 * a round-trip.
 */
const getDocIds: string[] = [];
/** When set, getDoc throws — the PERMISSION_DENIED path importAll catches. */
let getDocThrows = false;
/** Documents the mocked getDocs query will return, as [id, data] pairs. */
const queryDocs = new Map<string, Record<string, unknown>>();
/** Every writeBatch operation, in order. */
const batchOps: { op: 'update' | 'delete' | 'set'; id: string; data?: unknown }[] = [];
/** Every deleteDoc call, by id. */
const deletedIds: string[] = [];

vi.mock('@/lib/firebase/config', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => ({ col, id }),
  getDoc: async (ref: { id: string }) => {
    getDocIds.push(ref.id);
    if (getDocThrows) throw new Error('PERMISSION_DENIED');
    const data = existingDocs.get(ref.id);
    return { exists: () => data !== undefined, data: () => data, id: ref.id };
  },
  setDoc: async (ref: SetDocCall['ref'], data: Record<string, unknown>, options?: SetDocCall['options']) => {
    setDocCalls.push({ ref, data, options });
  },
  deleteDoc: async (ref: { id: string }) => { deletedIds.push(ref.id); },
  collection: (_db: unknown, col: string) => ({ col }),
  query: (...args: unknown[]) => ({ args }),
  where: (...args: unknown[]) => ({ args }),
  getDocs: async () => {
    // getProjects uses snap.forEach, not snap.docs — a `{ docs: [] }` mock
    // would throw rather than return an empty result.
    const entries = [...queryDocs.entries()].map(([id, data]) => ({ id, data: () => data, ref: { col: 'myscrumbudget_projects', id } }));
    return { forEach: (fn: (d: { id: string; data: () => Record<string, unknown> }) => void) => entries.forEach(fn), docs: entries };
  },
  writeBatch: () => ({
    set: (ref: { id: string }, data: unknown) => { batchOps.push({ op: 'set', id: ref.id, data }); },
    update: (ref: { id: string }, data: unknown) => { batchOps.push({ op: 'update', id: ref.id, data }); },
    delete: (ref: { id: string }) => { batchOps.push({ op: 'delete', id: ref.id }); },
    commit: async () => {},
  }),
}));

const {
  createFirestoreRepository,
  SAVE_PROJECT_MERGE_FIELDS,
  SAVE_PROJECT_OWNER_MERGE_FIELDS,
  SAVE_PROJECT_OWNER_EXTRA,
} = await import('../firestoreRepo');
type ProjectWithOwnership = Project & { _isOwner?: true };

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
  getDocIds.length = 0;
  existingDocs.clear();
  queryDocs.clear();
  batchOps.length = 0;
  deletedIds.length = 0;
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

/**
 * A document with every field populated, as Firestore would hold it.
 *
 * ⚠️ HOISTED to module scope 2026-09-13 (v0.40.0) from inside the round-trip
 * describe below, so the v0.40.0 writer tests read the SAME fixture rather than
 * a near-copy. Two fixture builders for one document shape is how the copies
 * drift apart and start asserting different worlds.
 *
 * ⚠️ NOTE `members` MAKES `UID` THE OWNER. Any test that needs a non-owner must
 * override it — `getProject` now branches on this map.
 */
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

describe('getProjects / getProject — the docToProject round-trip', () => {
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
    // ⚠️ RECLASSIFIED 2026-09-12 (v0.38.2): `_teamSnapshot` was in the EXCLUDED
    // half of this assertion, alongside owner/members/order/_originRef/
    // _changeLog. That grouping is what made this test — whose own comment
    // above names the exact defect class — assert the defect as correct for
    // three releases. The other six really are cloud-only bookkeeping; this one
    // is the display-name fallback `resolveAssignments` consults for a SHARED
    // project, so it has to reach the domain object or a collaborator sees
    // "(Unknown)" for every row. The excluded six are still pinned, by the
    // exactness of this list.
    // ⚠️ AMENDED 2026-09-13 (v0.40.0): `fullDoc()` makes UID the OWNER, and
    // `getProject` now attaches `_isOwner` for an owner. The list gains that
    // key HERE and stays exhaustive — `toEqual` is deliberately NOT relaxed to
    // `toContain`/`arrayContaining`. The exactness is the whole instrument: it
    // is what keeps the excluded six (owner/members/order/_originRef/
    // _changeLog/schemaVersion) pinned, and it is why the v0.38.2
    // `_teamSnapshot` reclassification was forced to be explicit rather than
    // slipping in. The NON-owner half of the same assertion is the test below.
    expect(Object.keys(project!).sort()).toEqual([
      '_isOwner', '_teamSnapshot',
      'activeReforecastId', 'archived', 'color', 'endDate', 'id', 'name', 'reforecasts', 'startDate',
    ]);
    expect((project as ProjectWithOwnership)._isOwner,
      'PRESENT and true for the owner — never false').toBe(true);
    expect(project!._teamSnapshot).toEqual({ a1: { name: 'Alice', role: 'BA' } });
    expect(project!.id).toBe('p1');
    expect(project!.color).toBe('teal');
    expect(project!.archived).toBe(true);
    expect(project!.activeReforecastId).toBe('rf1');
    // Cloud-only metadata must NOT leak onto the domain object.
    expect('owner' in project!).toBe(false);
    expect('_changeLog' in project!).toBe(false);
  });

  it('hydrates the same document for a NON-owner with the flag ABSENT, never false', async () => {
    // ⚠️ ROW 15's SECOND FIXTURE, and ROW 4's duty. These two are the ONLY
    // read-path instruments in the table: every write-path test builds its
    // owner by hand, so none of them can see a regression in the attach.
    //
    // ⚠️ THE OVERLAP IS NAMED RATHER THAN COLLAPSED. This assertion is also
    // row 4's ("a flag written as `false`"), and it has to live on the READ
    // path: `saveProject` tests `_isOwner === true`, so a flag written `false`
    // produces a byte-identical nine-field payload and no write-path assertion
    // can tell the two apart. Deleting either this or the owner test above
    // would silently remove a duty that reads as redundant.
    existingDocs.set('p1', fullDoc({ members: { other: 'owner', [UID]: 'editor' } }));
    const repo = createFirestoreRepository(UID);
    const project = await repo.getProject('p1');

    expect('_isOwner' in project!, 'an editor gets NO key at all — not `false`').toBe(false);
    expect(Object.keys(project!).sort(), 'and the rest of the hydration is unchanged').toEqual([
      '_teamSnapshot',
      'activeReforecastId', 'archived', 'color', 'endDate', 'id', 'name', 'reforecasts', 'startDate',
    ]);
  });

  it('getProjects carries NO _isOwner — and this test FAILING is the signal', async () => {
    // ⚠️⚠️ ROW 6, KEPT AS A TRIPWIRE AND DEMOTED, 2026-09-13. Read this before
    // deleting it as obsolete: its FAILURE is what it exists for. It fires when
    // someone adds the `_isOwner` attach to `getProjects`, which is exactly the
    // moment that needs to become a conversation rather than a commit.
    //
    // ⚠️ It was offered for falsification and FALSIFIED: across four builds it
    // PASSES on the hazard (`DEC-W6` taken without restoring the attach) and
    // FAILS on the correct future (`DEC-W6` with both attaches). It fires when a
    // developer does the right thing and is silent when they do the wrong one,
    // which is why the instrument for the actual hazard is the two-read-paths
    // test below and not this one.
    //
    // ⚠️ THE CONCRETE CONSEQUENCE, which is what earns it its place: `exportAll`
    // returns `getProjects`' output VERBATIM as `AppState.projects`, so adding
    // the attach here would put `_isOwner: true` into every cloud export — a
    // change to the export FORMAT, not just an extra in-memory key. (This test
    // does not PIN that format; `exportAll` is a separate method that merely
    // calls this one. The consequence is the point, not the coupling.)
    queryDocs.set('p1', fullDoc());
    const repo = createFirestoreRepository(UID);
    const projects = await repo.getProjects();

    expect(projects).toHaveLength(1);
    expect('_isOwner' in projects[0],
      'if this fails, someone added the attach — see the note above, do not just update the test',
    ).toBe(false);
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

/**
 * The remaining operations. Not in the charter's named-contract list — added
 * because D exists on the premise that this file is un-instrumented, and
 * stopping at the named contracts would leave 8 of 21 functions unexecuted.
 * Declared as scope, not presented as contract yield.
 */
describe('the remaining repository operations', () => {
  it('deleteProject deletes exactly the requested document', async () => {
    const repo = createFirestoreRepository(UID);
    await repo.deleteProject('p_gone');
    expect(deletedIds).toEqual(['p_gone']);
  });

  it('reorderProjects writes the array INDEX as order, not the id order alone', async () => {
    // The dashboard persists drag-to-reorder through this. Asserting the
    // index values (not just that N updates happened) is what pins it.
    const repo = createFirestoreRepository(UID);
    await repo.reorderProjects(['pC', 'pA', 'pB']);

    expect(batchOps).toEqual([
      { op: 'update', id: 'pC', data: { order: 0 } },
      { op: 'update', id: 'pA', data: { order: 1 } },
      { op: 'update', id: 'pB', data: { order: 2 } },
    ]);
  });

  it('exportAll stamps the dataset discriminant and both provenance refs', async () => {
    queryDocs.set('p1', {
      name: 'Project One', startDate: '2026-01-01', endDate: '2026-12-31',
      reforecasts: [], activeReforecastId: null, members: { [UID]: 'owner' }, order: 0,
    });
    const repo = createFirestoreRepository(UID);
    const data = await repo.exportAll();

    // msbExportKind is the v0.30.0 boundary gate: a payload without it is
    // rejected at import, so an export that forgets it is unimportable.
    expect(data.msbExportKind).toBe('dataset');
    expect(data._originRef).toBe(UID);
    expect(data._storageRef).toBe(UID);
    expect(data.projects.map((p) => p.name)).toEqual(['Project One']);
    expect(data.version).toBeTypeOf('string');
  });

  it('clear deletes every OWNED project and the settings document', async () => {
    queryDocs.set('p1', { name: 'A', owner: UID });
    queryDocs.set('p2', { name: 'B', owner: UID });

    const repo = createFirestoreRepository(UID);
    await repo.clear();

    expect(batchOps).toEqual([
      { op: 'delete', id: 'p1' },
      { op: 'delete', id: 'p2' },
    ]);
    // The settings doc is keyed on the uid and deleted outside the batch.
    expect(deletedIds).toEqual([UID]);
  });

  it('getVersion reports the current data version and migrateIfNeeded is a no-op', async () => {
    // Cloud data is always current — migrations run at the app layer before
    // anything reaches Firestore. Pinned so the no-op stays deliberate.
    const repo = createFirestoreRepository(UID);
    expect(await repo.getVersion()).toBeTypeOf('string');
    await expect(repo.migrateIfNeeded()).resolves.toBeUndefined();
    expect(setDocCalls).toHaveLength(0);
    expect(batchOps).toHaveLength(0);
  });
});

describe('saveSettingsAndTeamPool — one document, one write (PR C1)', () => {
  /**
   * ⚠️ WRITTEN AGAINST THE WRITE, NOT AGAINST THE METHOD NAME, and that is the
   * whole reason these assertions are trustworthy.
   *
   * A criterion written as `repo.saveSettingsAndTeamPool(...)` fails at an
   * unfixed HEAD with `TypeError: ... is not a function` — which is the SAME
   * output as a typo in the test, a mock missing the method, or a bad import.
   * That failure carries no information about the criterion, so pasting it into
   * a PR body looks like compliance while proving nothing.
   *
   * These assertions instead name the OBSERVABLE the PR changes: how many
   * `setDoc` calls the operation produces, and what the resolved field mask
   * contains. `persistSettingsAndPool` below is the only line that differs
   * between the two worlds. In its HEAD-baseline form it was the two-call
   * sequence a caller would otherwise have to write, and these tests failed
   * with `expected 1, received 2` and a mask not containing `teamPool` —
   * informative failures, recorded in the PR body for v0.37.8.
   */
  async function persistSettingsAndPool(
    repo: Awaited<ReturnType<typeof createFirestoreRepository>>,
    settings: Settings,
    pool: PoolMember[],
  ): Promise<void> {
    await repo.saveSettingsAndTeamPool(settings, pool);
  }

  /**
   * The six fields the combined write is allowed to touch, in resolved order.
   *
   * ⚠️ A LITERAL, deliberately — NOT an import of the source constant. Importing
   * it would make this test agree with whatever the constant happens to say,
   * which is exactly the change it exists to catch (the self-referential
   * assertion finding from v0.36.12). `EXPECTED_MERGE_FIELDS` above is a literal
   * for the same reason; keep both that way.
   */
  const EXPECTED_SETTINGS_POOL_MASK = [
    'discountRateAnnual', 'laborRates', 'holidays',
    'trafficLightThresholds', 'schemaVersion', 'teamPool',
  ];

  /** A rate set mid-rename: "BA" has become "Business Analyst". */
  function renamedSettings(): Settings {
    return {
      discountRateAnnual: 0.03,
      laborRates: [{ role: 'Business Analyst', hourlyRate: 75 }, { role: 'IT-Security', hourlyRate: 90 }],
      holidays: [],
      trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
    };
  }

  /** The pool that must land in the same write, or its members are orphaned. */
  function cascadedPool(): PoolMember[] {
    return [
      { id: 'pm1', name: 'Alice', role: 'Business Analyst' },
      { id: 'pm2', name: 'Cara', role: 'Business Analyst', archived: true },
      { id: 'pm3', name: 'Dan', role: 'IT-Security' },
    ];
  }

  it('produces ONE setDoc carrying both laborRates and teamPool', async () => {
    const repo = createFirestoreRepository(UID);
    await persistSettingsAndPool(repo, renamedSettings(), cascadedPool());

    expect(setDocCalls).toHaveLength(1);
    const [call] = setDocCalls;
    expect(call.ref.col).toBe('myscrumbudget_settings');
    expect(call.ref.id).toBe(UID);
    // Both halves of the rename in one payload — the property that makes the
    // write atomic by single-document semantics.
    expect(call.data.laborRates).toEqual(renamedSettings().laborRates);
    expect(call.data.teamPool).toEqual(cascadedPool());
  });

  it('its mask CONTAINS laborRates and teamPool', async () => {
    // ⚠️ CONTAINMENT, not order. A data field absent from the mask is dropped
    // SILENTLY (the mask is built only from mergeFields), so losing either entry
    // is invisible at runtime — which is why it is asserted here.
    const repo = createFirestoreRepository(UID);
    await persistSettingsAndPool(repo, renamedSettings(), cascadedPool());

    const mask = setDocCalls[0].options?.mergeFields ?? [];
    expect(mask).toContain('laborRates');
    expect(mask).toContain('teamPool');
  });

  it('writes exactly its six mergeFields, in resolved order', async () => {
    const repo = createFirestoreRepository(UID);
    await persistSettingsAndPool(repo, renamedSettings(), cascadedPool());

    expect(setDocCalls[0].options?.mergeFields).toEqual(EXPECTED_SETTINGS_POOL_MASK);
  });

  it('[REGRESSION] every mask entry is present in the payload', async () => {
    // ⚠️ [REGRESSION], NOT [FAILS-TODAY], and the label is load-bearing: this
    // one PASSED against unfixed HEAD, because `saveSettings`' mask already
    // matched its own payload. The three tests above failed there. A reader
    // counting "four green tests" would otherwise read this as a fourth piece
    // of evidence that the feature works, and it is not.
    //
    // ⚠️ It is also NOT redundant with the containment test above, which is the
    // reason to keep it. From the SDK's `parseSetData`, the two directions have
    // opposite consequences and only one is silent: a DATA FIELD ABSENT FROM
    // THE MASK is dropped without error (what containment catches), while a
    // MASK ENTRY ABSENT FROM THE DATA throws INVALID_ARGUMENT and writes
    // nothing. Containment structurally cannot see the second — it only ever
    // looks for entries it expects to be there. This bounds the mask from that
    // other side. Do not delete it as duplication.
    const repo = createFirestoreRepository(UID);
    await persistSettingsAndPool(repo, renamedSettings(), cascadedPool());

    const { data, options } = setDocCalls[0];
    for (const field of options?.mergeFields ?? []) {
      expect(Object.keys(data)).toContain(field);
    }
  });
});

describe('_teamSnapshot — the shared-project team-name fallback (v0.38.2)', () => {
  /**
   * These pin the WRITE half. The read half is in firestoreUtils.test.ts and the
   * end-to-end wiring is in useTeam.test.ts; all three are required, because a
   * correct snapshot that nothing hydrates is exactly the defect this release
   * fixes, and it was green here for three releases.
   */

  /** Two reforecasts with DIFFERENT rosters. rf1 is active; Bob is only on rf2. */
  function twoRosterProject(over: Partial<Project> = {}): Project {
    const base = makeProject();
    const rf1 = base.reforecasts[0];
    return {
      ...base,
      reforecasts: [
        rf1,
        { ...rf1, id: 'rf2', name: 'August', assignments: [{ id: 'a2', poolMemberId: 'pm2' }] },
      ],
      activeReforecastId: 'rf1',
      ...over,
    };
  }

  function seedPool(pool: PoolMember[]) {
    existingDocs.set(UID, { teamPool: pool });
  }

  it('covers EVERY reforecast roster, not just the active one', async () => {
    // [FAILS-TODAY] At HEAD all three write sites pass
    // getActiveReforecast(project)?.assignments, so pm2 — assigned only on the
    // non-active rf2 — is absent. A collaborator switching the reforecast
    // dropdown to "August" then saw "(Unknown)" for the whole roster.
    seedPool([
      { id: 'pm1', name: 'Alice', role: 'BA' },
      { id: 'pm2', name: 'Bob', role: 'IT-SoftEng' },
    ]);
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(twoRosterProject());

    expect(setDocCalls[0].data._teamSnapshot).toEqual({
      pm1: { name: 'Alice', role: 'BA' },
      pm2: { name: 'Bob', role: 'IT-SoftEng' },
    });
  });

  it('carries forward entries the WRITER\'s own pool cannot resolve', async () => {
    // [FAILS-TODAY] The load-bearing case for a shared project. An editor who
    // is not the owner has none of the owner's pool members, so rebuilding the
    // map from their pool alone DELETES every name — for every other
    // collaborator, not just themselves. Their own additions still land.
    seedPool([{ id: 'pm-editor', name: 'Editor Eve', role: 'PM' }]);
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(twoRosterProject({
      _teamSnapshot: {
        pm1: { name: 'Alice', role: 'BA' },
        pm2: { name: 'Bob', role: 'IT-SoftEng' },
      },
      reforecasts: [
        { ...makeProject().reforecasts[0], assignments: [
          { id: 'a1', poolMemberId: 'pm1' },
          { id: 'a2', poolMemberId: 'pm2' },
          { id: 'a3', poolMemberId: 'pm-editor' },
        ] },
      ],
    }));

    expect(setDocCalls[0].data._teamSnapshot).toEqual({
      pm1: { name: 'Alice', role: 'BA' },
      pm2: { name: 'Bob', role: 'IT-SoftEng' },
      'pm-editor': { name: 'Editor Eve', role: 'PM' },
    });
  });

  it('lets a freshly resolved entry WIN over a stale carried-forward one', async () => {
    // The writer's own pool is authoritative for members they actually have,
    // so a rename propagates rather than being pinned by the old snapshot.
    seedPool([{ id: 'pm1', name: 'Alice Renamed', role: 'Business Analyst' }]);
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(makeProject({
      _teamSnapshot: { pm1: { name: 'Alice', role: 'BA' } },
    }));

    expect(setDocCalls[0].data._teamSnapshot).toEqual({
      pm1: { name: 'Alice Renamed', role: 'Business Analyst' },
    });
  });

  it('prunes carried-forward entries for members no longer assigned anywhere', async () => {
    // Without the prune, the map only ever grows — every member ever assigned
    // to the project stays in the document forever.
    seedPool([{ id: 'pm1', name: 'Alice', role: 'BA' }]);
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(makeProject({
      _teamSnapshot: {
        pm1: { name: 'Alice', role: 'BA' },
        'pm-departed': { name: 'Gone', role: 'QA' },
      },
    }));

    expect(setDocCalls[0].data._teamSnapshot).toEqual({ pm1: { name: 'Alice', role: 'BA' } });
  });
});

describe('_costSnapshot — the field, its two inert write sites, and the owner-only writer (v0.39.0 / v0.40.0)', () => {
  /**
   * ⚠️⚠️ THE PAYLOAD-KEY ASSERTION. This is the ONLY thing that pins what this
   * release buys, and it must assert on the setDoc PAYLOAD KEY SET rather than
   * on the hydrated Project — `docToProject` deliberately does NOT hydrate a
   * null, so a round-trip assertion sees nothing and passes whether or not the
   * key was ever written.
   *
   * Why it matters: the field is REQUIRED on FirestoreProjectDoc so that `tsc`
   * forces both write sites to decide, both answer null, and an explicit null
   * is a PRESENT key. That present key is what exercises the cross-repo rules
   * change (spert-landing v2.5.38). Make the doc field optional and drop the
   * nulls and the typecheck stays clean, the suite stays green, and the rules
   * change is never exercised — these two tests are what refuse that.
   *
   * ⚠️ Neither write site uses a mask: both are full setDoc calls, so there is
   * no mergeFields step to apply here. Do not go looking for one.
   */
  function projectPayload() {
    const call = setDocCalls.find((c) => c.ref.col === 'myscrumbudget_projects');
    expect(call, 'a myscrumbudget_projects document was written').toBeDefined();
    return call!;
  }

  it('createProject writes a payload whose KEYS include _costSnapshot, value null', async () => {
    const repo = createFirestoreRepository(UID);
    await repo.createProject(makeProject());
    const call = projectPayload();
    expect(Object.keys(call.data), 'the key is present in the create payload')
      .toContain('_costSnapshot');
    expect(call.data._costSnapshot, 'and it is an explicit null, not undefined')
      .toBeNull();
    expect(call.options?.mergeFields, 'createProject uses no mask').toBeUndefined();
  });

  it('importAll writes a payload whose KEYS include _costSnapshot, value null', async () => {
    const repo = createFirestoreRepository(UID);
    await repo.importAll({
      version: '0.16.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
        holidays: [],
        trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
      },
      teamPool: [{ id: 'pm1', name: 'Alice', role: 'BA' }],
      projects: [makeProject()],
    } as unknown as Parameters<ReturnType<typeof createFirestoreRepository>['importAll']>[0]);
    const call = projectPayload();
    expect(Object.keys(call.data), 'the key is present in the import payload')
      .toContain('_costSnapshot');
    expect(call.data._costSnapshot, 'and it is an explicit null, not undefined')
      .toBeNull();
    expect(call.options?.mergeFields, 'importAll uses no mask').toBeUndefined();
  });

  it('a NON-owner saveProject still writes nothing — the mask stays at nine fields', async () => {
    // ⚠️ SPLIT 2026-09-13 (v0.40.0). This was
    // `saveProject does NOT write it — the mask stays at nine fields`, inside a
    // container named `the machinery ships with no writer`. v0.40.0 ships the
    // writer, so BOTH the container name and the test name went false while
    // staying green — the test kept passing because `makeProject()` carries no
    // ownership flag, i.e. it silently narrowed from "saveProject never writes
    // it" to "a non-owner save never writes it" with nothing saying so.
    // Renamed to what it actually asserts; the owner half is below.
    //
    // ⚠️ THE FIXTURE SEEDS A USABLE SETTINGS DOCUMENT ON PURPOSE. Without one
    // the card resolves to `undefined` for everybody and this test passes even
    // against a build that computes and attaches the payload unconditionally —
    // which is precisely the wrong build it exists to refuse.
    existingDocs.set(UID, { laborRates: [{ role: 'BA', hourlyRate: 75 }], teamPool: [] });
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(makeProject());
    const call = projectPayload();
    expect(Object.keys(call.data), 'a non-owner save writes no cost snapshot')
      .not.toContain('_costSnapshot');
    expect(call.options?.mergeFields, 'and its mask is unchanged at nine')
      .toHaveLength(9);
    expect(call.options?.mergeFields, 'and it is the module constant ITSELF, not an equal array')
      .toBe(SAVE_PROJECT_MERGE_FIELDS);
  });
});

/**
 * v0.40.0 — THE OWNER-ONLY COST-CARD WRITER.
 *
 * When the OWNER saves a project, `saveProject` republishes `_costSnapshot`
 * from their CURRENT settings. When anyone else saves, it does not touch it.
 *
 * ⚠️ WHY A PROJECT SAVE AND NOT A SETTINGS FAN-OUT: `saveProject` already
 * rebuilds `_teamSnapshot` on every save, so both mirrors of the settings
 * document refresh at the SAME trigger. A settings fan-out cannot offer that,
 * and would have to enumerate every project the owner has.
 *
 * ⚠️ WHAT IT DOES NOT REACH, stated rather than implied: a project the owner
 * never saves again keeps whatever card it has — which today is none. Owners
 * seed their projects through ordinary use, one save at a time.
 *
 * ⚠️⚠️ EVERY TEST BELOW THAT SEEDS AN OWNER BUILDS THE PROJECT BY HAND
 * (`ownedProject()`), so none of them can see a regression in `getProject`'s
 * attach. The read path is covered by exactly two tests, both far above:
 * `hydrates every domain field…` and `hydrates the same document for a
 * NON-owner…`. Deleting either removes a duty nothing here replaces.
 */
describe('saveProject — the owner-only cost-card writer (v0.40.0)', () => {
  /** A project as `getProject` returns it for an OWNER: the flag is attached. */
  function ownedProject(over: Partial<Project> = {}): Project {
    const p = makeProject(over) as ProjectWithOwnership;
    p._isOwner = true;
    return p;
  }

  /** A settings document holding a real, saved rate card. */
  const SAVED_CARD = {
    laborRates: [{ role: 'BA', hourlyRate: 175 }],
    holidays: [{ id: 'h1', name: 'Independence Day', startDate: '2026-07-03', endDate: '2026-07-03' }],
    discountRateAnnual: 0.07,
    teamPool: [{ id: 'pm1', name: 'Alice', role: 'BA' }],
  };

  const projectWrite = () => {
    const call = setDocCalls.find((c) => c.ref.col === 'myscrumbudget_projects');
    expect(call, 'a myscrumbudget_projects document was written').toBeDefined();
    return call!;
  };

  // ── The three states of DEC-W4 ────────────────────────────────────────────

  it('[ROW 2] an OWNER with a saved rate card publishes it — ten mergeFields', async () => {
    existingDocs.set(UID, SAVED_CARD);
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(ownedProject());
    const call = projectWrite();

    expect(call.options?.mergeFields, 'nine plus the one owner-only field')
      .toEqual([...SAVE_PROJECT_MERGE_FIELDS, '_costSnapshot']);
    expect(call.data._costSnapshot, 'and the payload carries the OWNER’s own values, verbatim')
      .toEqual({
        laborRates: [{ role: 'BA', hourlyRate: 175 }],
        holidays: [{ id: 'h1', name: 'Independence Day', startDate: '2026-07-03', endDate: '2026-07-03' }],
        discountRateAnnual: 0.07,
      });
    expect(call.data._costSnapshot, 'trafficLightThresholds is NOT a cost input and must not ride along')
      .not.toHaveProperty('trafficLightThresholds');
  });

  it('[ROW 3a] REFUSES when the owner has no settings document at all', async () => {
    // ⚠️ THE `getSettings()` TRAP. `getSettings` returns DEFAULT_SETTINGS for an
    // absent document — six stock rates the owner never saved. Publishing those
    // stamps a rate card onto a project whose supposed author has never seen it,
    // and every collaborator then prices from it. Three of thirteen owners were
    // in exactly this state when this was written.
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(ownedProject());
    const call = projectWrite();

    expect(Object.keys(call.data), 'nothing is published').not.toContain('_costSnapshot');
    expect(call.options?.mergeFields, 'and the mask is the nine-field constant itself')
      .toBe(SAVE_PROJECT_MERGE_FIELDS);
  });

  it('[ROW 3b] REFUSES when the document exists but has no laborRates KEY', async () => {
    // The other half of the fabrication: `data.laborRates ?? DEFAULT` fabricates
    // even when the document is present. The rule discriminates on KEY PRESENCE
    // — "never SAVED", not "never authored" — which is why a present key holding
    // a byte-identical copy of the stock card DOES publish.
    existingDocs.set(UID, { teamPool: [{ id: 'pm1', name: 'Alice', role: 'BA' }] });
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(ownedProject());
    const call = projectWrite();

    expect(Object.keys(call.data), 'nothing is published').not.toContain('_costSnapshot');
    expect(call.options?.mergeFields).toBe(SAVE_PROJECT_MERGE_FIELDS);
  });

  it('[ROW 3c] REFUSES an explicitly EMPTY laborRates array', async () => {
    // ⚠️ Refuses a build keyed on ABSENCE alone. The key is present here, so
    // "is the key missing?" says publish. Publishing an empty card would price
    // every role at $0 for every collaborator — loud, but wrong; refusing
    // leaves each reader on their own rates, which is the status quo.
    existingDocs.set(UID, { laborRates: [], teamPool: [] });
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(ownedProject());
    const call = projectWrite();

    expect(Object.keys(call.data), 'an empty card is not a card').not.toContain('_costSnapshot');
    expect(call.options?.mergeFields).toBe(SAVE_PROJECT_MERGE_FIELDS);
  });

  it('[ROW 3d] PUBLISHES when only holidays and discountRateAnnual are missing', async () => {
    // ⚠️ Refuses "refuse if ANY field is missing". `laborRates` is required on
    // CostSnapshot, so a card without it is not expressible and must refuse; the
    // other two have meaningful empty values. Withholding a real rate card
    // because the owner never added a holiday would be the wrong trade.
    //
    // ⚠️ THE VALUES ARE STATED, NOT DESCRIBED AS "defaulted" — a test that
    // asserts "it equals the default" passes against any default, including one
    // someone changes later without meaning to change this.
    existingDocs.set(UID, { laborRates: [{ role: 'BA', hourlyRate: 175 }], teamPool: [] });
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(ownedProject());
    const call = projectWrite();

    expect(call.options?.mergeFields, 'ten — this state publishes').toHaveLength(10);
    expect(call.data._costSnapshot).toEqual({
      laborRates: [{ role: 'BA', hourlyRate: 175 }],
      holidays: [],
      discountRateAnnual: 0.03,
    });
  });

  // ── Plumbing ──────────────────────────────────────────────────────────────

  it('[ROW 1] a save with NO ownership flag publishes nothing, over a usable card', async () => {
    // ⚠️ THE SETTINGS DOCUMENT IS SEEDED AND USABLE, DELIBERATELY. This row
    // refuses "the payload is computed unconditionally"; with no card to
    // resolve, that wrong build produces the identical nine-key payload and the
    // row passes while refusing nothing. The fixture has to be able to PRODUCE
    // the divergence, not merely name it.
    existingDocs.set(UID, SAVED_CARD);
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(makeProject());  // no _isOwner — an editor's save
    const call = projectWrite();

    expect(Object.keys(call.data), 'an editor must never republish the card')
      .not.toContain('_costSnapshot');
    expect(call.options?.mergeFields).toBe(SAVE_PROJECT_MERGE_FIELDS);
  });

  it('[ROW 7] the import "replace" path never seeds, even for the owner', async () => {
    // ⚠️ `importUtils.ts` calls `saveProject({ ...project, id: existingId })`
    // where `project` is the loop variable over the IMPORT FILE's projects — it
    // never passed through `getProject`, so it carries no flag. That is correct
    // and is pinned here rather than fixed: seeding would publish the IMPORTER's
    // rate card onto a project they may not own.
    //
    // ⚠️⚠️ THE SECOND CLAUSE — "a pre-existing stored card SURVIVES" — IS NOT
    // ASSERTED, ON PURPOSE. This harness's `setDoc` records and never writes,
    // so a read-back would return the SEED and pass whether or not the import
    // path had written. Survival follows by SDK CONTRACT from what IS asserted:
    // the field is absent from both the payload and the nine-field mask, and a
    // field outside `mergeFields` is not touched. That is an inference from the
    // same documented precondition §5.3 relies on for INVALID_ARGUMENT — stated
    // as an inference rather than dressed up as a measurement, because giving
    // one test bespoke merge semantics would make this mock the authority on an
    // SDK nothing here has run.
    existingDocs.set(UID, SAVED_CARD);
    const repo = createFirestoreRepository(UID);
    const fromImportFile = makeProject({ name: 'Imported' });
    await repo.saveProject(fromImportFile);
    const call = projectWrite();

    expect(Object.keys(call.data), 'an import must not publish a rate card')
      .not.toContain('_costSnapshot');
    expect(call.options?.mergeFields).toBe(SAVE_PROJECT_MERGE_FIELDS);
  });

  it('[ROW 8] the mask is the STATIC set plus a guarded extra, never derived from the payload', async () => {
    // ⚠️⚠️ REFERENCE IDENTITY (`toBe`), NOT VALUE EQUALITY. The one-line wrong
    // build is `mergeFields: Object.keys(stripUndefined(payload))`. It produces
    // the same nine strings in the same order, so `toEqual` on the array passes
    // — three separate reviewer probes got through an earlier version of this
    // row that way. Only identity with the module constant refuses it.
    //
    // Deriving the mask from the payload also deletes the completeness guard:
    // the two `satisfies`-checked sets go unreferenced.
    //
    // ⚠️⚠️ AND NOTHING ELSE CATCHES IT — MEASURED 2026-09-13. The lint ratchet
    // stays at 13/0 under the dynamic mask both with the constants retained and
    // with them deleted, because they are EXPORTED and ESLint does not report an
    // exported constant as unused. `tsc` only fires in the second case, and only
    // because this file imports them. These assertions are the whole guard.
    existingDocs.set(UID, SAVED_CARD);
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(ownedProject());
    expect(projectWrite().options?.mergeFields,
      'the OWNER branch is the module constant itself').toBe(SAVE_PROJECT_OWNER_MERGE_FIELDS);

    setDocCalls.length = 0;
    await repo.saveProject(makeProject());
    expect(projectWrite().options?.mergeFields,
      'and so is the non-owner branch').toBe(SAVE_PROJECT_MERGE_FIELDS);
  });

  it('[ROW 8] SAVE_PROJECT_OWNER_EXTRA holds exactly the one owner-only field', () => {
    // ⚠️ THIS IMPORT IS THE POINT, not the assertion. A `satisfies`-guarded set
    // that nothing imports is what a tidy-up deletes; importing it is what makes
    // the guard survive. The `satisfies` clause is what turns a typo
    // (`_costSnapshott`) into TS2561 naming the field instead of a clean
    // typecheck and a runtime surprise.
    expect(Object.keys(SAVE_PROJECT_OWNER_EXTRA)).toEqual(['_costSnapshot']);
    expect(SAVE_PROJECT_OWNER_MERGE_FIELDS,
      'and the owner mask extends the nine rather than restating them')
      .toEqual([...SAVE_PROJECT_MERGE_FIELDS, '_costSnapshot']);
  });

  it('[ROW 9] a rate edited between two saves reaches the stored card', async () => {
    // The whole point of refreshing on every owner save: the card must not go
    // stale. Two saves either side of a settings change.
    existingDocs.set(UID, { laborRates: [{ role: 'BA', hourlyRate: 175 }], teamPool: [] });
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(ownedProject());
    expect((projectWrite().data._costSnapshot as { laborRates: unknown[] }).laborRates,
      'the rate as it stood at the first save').toEqual([{ role: 'BA', hourlyRate: 175 }]);

    setDocCalls.length = 0;
    existingDocs.set(UID, { laborRates: [{ role: 'BA', hourlyRate: 200 }], teamPool: [] });
    await repo.saveProject(ownedProject());
    expect((projectWrite().data._costSnapshot as { laborRates: unknown[] }).laborRates,
      'and the NEW rate after the owner edited it').toEqual([{ role: 'BA', hourlyRate: 200 }]);
  });

  it('[ROW 10] an owner save makes exactly ONE round-trip to the settings document', async () => {
    // ⚠️ The writer needs two things from that document — the team pool and the
    // rate card — and they live in the same doc, so one raw read serves both.
    // Reaching for `impl.getTeamPool()` AND a separate read would double the
    // read cost of every save in the app.
    existingDocs.set(UID, SAVED_CARD);
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(ownedProject());

    expect(getDocIds.filter((id) => id === UID),
      'one read of the settings doc, not two').toHaveLength(1);
  });

  it('[ROW 11] one write, to the project document, and nothing else', async () => {
    // ⚠️ Kept only for what it proves: a fan-out over the owner's other projects
    // is NOT reachable from here. It cannot substitute for the per-branch
    // payload assertions above — a build that wrote the wrong card to the right
    // document passes this test.
    existingDocs.set(UID, SAVED_CARD);
    queryDocs.set('other', { name: 'Another owned project', members: { [UID]: 'owner' } });
    const repo = createFirestoreRepository(UID);
    await repo.saveProject(ownedProject());

    expect(setDocCalls, 'exactly one document written').toHaveLength(1);
    expect(setDocCalls[0].ref, 'and it is this project').toEqual({
      col: 'myscrumbudget_projects', id: 'p1',
    });
  });

  it('[F5] the pool taken from the raw read equals getTeamPool(), absent document included', async () => {
    // ⚠️⚠️ THE EQUIVALENCE PIN. `saveProject` stopped calling `impl.getTeamPool()`
    // and now derives the pool from its own raw `getDoc`, so it no longer
    // follows a future change to that method. That coupling loss is deliberate
    // — it is what makes the writer cost zero extra reads — but "they are
    // behaviourally identical today" is exactly the claim that decays silently,
    // so it is pinned here instead of asserted in a comment.
    const repo = createFirestoreRepository(UID);

    // (a) absent document — getTeamPool returns [], and so must the raw read.
    await repo.saveProject(ownedProject());
    expect(projectWrite().data._teamSnapshot,
      'absent doc: no pool, so no names resolve').toEqual({});
    expect(await repo.getTeamPool(), 'and getTeamPool agrees').toEqual([]);

    // (b) document present with a pool — both see the same members.
    setDocCalls.length = 0;
    existingDocs.set(UID, SAVED_CARD);
    await repo.saveProject(ownedProject());
    expect(projectWrite().data._teamSnapshot,
      'present doc: the pool resolves the assignment').toEqual({ pm1: { name: 'Alice', role: 'BA' } });
    expect(await repo.getTeamPool(), 'and getTeamPool returns that same pool')
      .toEqual(SAVED_CARD.teamPool);

    // (c) document present WITHOUT a teamPool key — the `?? []` branch.
    setDocCalls.length = 0;
    existingDocs.set(UID, { laborRates: [{ role: 'BA', hourlyRate: 175 }] });
    await repo.saveProject(ownedProject());
    expect(projectWrite().data._teamSnapshot, 'keyless doc: still an empty pool').toEqual({});
    expect(await repo.getTeamPool(), 'and getTeamPool agrees there too').toEqual([]);
  });

  it('[ROW 13] a seeded project’s cloud export CARRIES the card, with content', async () => {
    // ⚠️⚠️ THE EMIT HALF HAS NEVER BEEN EXERCISED ANYWHERE. Production has only
    // ever seen `_costSnapshot: null`, so until this release no export could
    // carry one and no test could have caught a read-path drop. That is the
    // `_teamSnapshot` defect shape: a field written by every save, never
    // hydrated, invisible in the UI and green in every local-mode test.
    //
    // ⚠️ The document is seeded DIRECTLY rather than written by `saveProject`,
    // because this harness's `setDoc` never writes back — reading through a
    // save would assert the seed.
    //
    // ⚠️ THE STRIP HALF IS NOT DUPLICATED HERE. It is already pinned, with
    // content, by `sanitizeImport.test.ts` → "STRIPS _costSnapshot and
    // _teamSnapshot from an imported project". Restating it would make this
    // table say less, not more.
    const card = {
      laborRates: [{ role: 'BA', hourlyRate: 175 }],
      holidays: [],
      discountRateAnnual: 0.07,
    };
    queryDocs.set('p1', fullDoc({ _costSnapshot: card }));
    const repo = createFirestoreRepository(UID);
    const state = await repo.exportAll();

    expect(state.projects[0]._costSnapshot,
      'a cloud export now emits a content-bearing cost card').toEqual(card);
  });

  // ── The two read paths must price one document the same ───────────────────

  it('[ROW 6-ALT] getProject and getProjects price the SAME document identically, at the CARD’s number', async () => {
    // ⚠️⚠️ THREE ASSERTIONS, TWO DIFFERENT INSTRUMENT CLASSES. Collapsing them
    // hides one, so they are labelled separately below.
    //
    // Fixture: the card says $100/h, the READER's own settings say $50/h. One
    // month, one member, 100% allocated.
    const card = {
      laborRates: [{ role: 'BA', hourlyRate: 100 }],
      holidays: [],
      discountRateAnnual: 0.03,
    };
    const doc = fullDoc({
      color: null, archived: null,
      startDate: '2026-01-01', endDate: '2026-01-31',
      reforecasts: [{
        id: 'rf1', name: 'Baseline', createdAt: '2026-01-01T00:00:00Z',
        reforecastDate: '2026-01-01', startDate: '2026-01-01', endDate: '2026-01-31',
        assignments: [{ id: 'a1', poolMemberId: 'pm1' }],
        allocations: [{ memberId: 'a1', month: '2026-01', allocation: 1 }],
        productivityWindows: [], actualCost: 0, baselineBudget: 100000,
      }],
      _costSnapshot: card,
    });
    existingDocs.set('p1', doc);
    queryDocs.set('p1', doc);

    const readerSettings: Settings = {
      discountRateAnnual: 0.03,
      laborRates: [{ role: 'BA', hourlyRate: 50 }],
      holidays: [],
      trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
    };
    const team: TeamMember[] = [{ id: 'a1', name: 'Alice', role: 'BA' }];

    const repo = createFirestoreRepository(UID);
    const viaGetProject = (await repo.getProject('p1'))!;
    const viaGetProjects = (await repo.getProjects())[0];

    const detailEac = calculateProjectMetrics(viaGetProject, readerSettings, team).eac;
    const dashboardEac = calculateProjectMetrics(viaGetProjects, readerSettings, team).eac;

    // ── DUTY 1 — [FALSIFY-AFTER]. NOTHING IN v0.40.0's DIFF CAN BREAK THIS.
    // `effectiveSettings` has no ownership input, so the two paths agree no
    // matter what `_isOwner` holds. It guards a FUTURE change: if an owner is
    // ever made to read their LIVE settings instead of the published card
    // (`DEC-W6` option B) while `getProjects` still has no flag, the detail page
    // and the dashboard tile will disagree about one project's EAC. Verified by
    // building that hazard against the finished artifact, not by any mutation of
    // this release: measured 2026-09-13, detail 8800 vs dashboard 17600 — the
    // same harm with the sign mirrored, because this fixture's reader rate is
    // BELOW the card's rather than above it.
    expect(detailEac, 'the detail page and the dashboard tile must agree').toBe(dashboardEac);

    // ── DUTY 2 — a LIVE regression guard on the v0.39.0 read path.
    // ⚠️⚠️ WITHOUT THIS, DUTY 1 IS VACUOUS: measured, two projects carrying no
    // card at all also agree — at 8800 — so deleting `docToProject`'s
    // `_costSnapshot` hydration leaves duty 1 green with the whole feature dead.
    // An assertion relating an output only to ITSELF is not evidence. These two
    // lines are what fail when the hydration line goes.
    expect(detailEac, 'and they agree on the CARD’s number, $100/h').toBe(17600);
    expect(detailEac, 'NOT on the reader’s own $50/h — which is what a dead read path gives')
      .not.toBe(8800);
  });
});
