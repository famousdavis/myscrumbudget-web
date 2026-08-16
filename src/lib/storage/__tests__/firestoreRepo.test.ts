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
  getDocs: async () => ({ docs: [] }),
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

    // A stored 0 and stored empty arrays are the USER'S values, not absences.
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
