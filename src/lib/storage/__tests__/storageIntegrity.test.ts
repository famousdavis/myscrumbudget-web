// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * WI-20 (v0.38.0) — one unreadable stored entry must not destroy the rest.
 *
 * ⚠️ WHAT THIS FILE CAN AND CANNOT PROVE. It drives the REAL localStorage
 * repository against REAL `localStorage`, so it proves what reaches storage. It
 * does NOT prove anything about which component calls what; the hook- and
 * page-level consequences are covered by their own suites, and the browser pass
 * covers the parts jsdom cannot reach.
 *
 * ⚠️ Every fixture here is "3 valid + 1 unreadable" rather than "1 valid +
 * 1 unreadable", because criteria 1-3 are about the projects the user did NOT
 * touch. A single-project fixture passes under implementations that lose them.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createLocalStorageRepository,
  DEFAULT_SETTINGS,
  StorageIntegrityError,
  describeStorageError,
  describeExportOmission,
  readStorageResidueCount,
} from '../localStorage';
import { STORAGE_KEYS } from '@/types/storage';
import type { Project } from '@/types/domain';

const P = STORAGE_KEYS.projects;
const T = STORAGE_KEYS.teamPool;
const S = STORAGE_KEYS.settings;

function mkProject(id: string, name: string): Project {
  return {
    id,
    name,
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    reforecasts: [],
    activeReforecastId: 'rf1',
  } as unknown as Project;
}

/**
 * ⚠️ Carries a nested object and an array on purpose. Criterion 8 says
 * "value-identical", and a flat `{name}` stub would pass under an
 * implementation that re-created the element from a couple of fields.
 */
const MALFORMED = {
  name: 'Malformed — has no id',
  startDate: '2025-01-01',
  nested: { a: 1, b: [2, 3] },
} as const;

/** Seed order puts the unreadable entry in the MIDDLE, not last. */
function seedMixed(): void {
  localStorage.setItem(
    P,
    JSON.stringify([mkProject('a', 'Apollo'), mkProject('b', 'Borealis'), MALFORMED, mkProject('c', 'Carina')]),
  );
}

function storedProjects(): Array<Record<string, unknown>> {
  return JSON.parse(localStorage.getItem(P) ?? 'null');
}
function storedIds(): Array<string | undefined> {
  return storedProjects().map((p) => p?.id as string | undefined);
}
/** The unreadable element as it now sits in storage, or null if it is gone. */
function survivingResidue(): unknown {
  return storedProjects().find((p) => p?.id === undefined) ?? null;
}

describe('WI-20 — an unreadable stored entry does not destroy the readable ones', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  // ── Criteria 1-3 and 8: the mutations ──────────────────────────────────────

  it('[CRITERION 1] saveProject on one project leaves the other two in storage', async () => {
    const repo = createLocalStorageRepository();
    seedMixed();

    await repo.saveProject(mkProject('a', 'Apollo EDITED'));

    expect(storedIds(), 'saveProject must not drop the projects it was not given').toEqual(
      expect.arrayContaining(['a', 'b', 'c']),
    );
    expect(
      storedProjects().find((p) => p.id === 'a')?.name,
      'the edit itself must still land',
    ).toBe('Apollo EDITED');
  });

  it('[CRITERION 2] deleteProject removes only its target', async () => {
    const repo = createLocalStorageRepository();
    seedMixed();

    await repo.deleteProject('a');

    expect(storedIds(), 'deleting one project must not delete the untouched ones').toEqual(
      expect.arrayContaining(['b', 'c']),
    );
    expect(storedIds(), 'the requested project must actually be gone').not.toContain('a');
  });

  it('[CRITERION 3] reorderProjects drops nothing and applies the order', async () => {
    const repo = createLocalStorageRepository();
    seedMixed();

    await repo.reorderProjects(['c', 'b', 'a']);

    const ids = storedIds();
    expect(ids.filter(Boolean), 'no readable project may be dropped by a reorder').toEqual([
      'c',
      'b',
      'a',
    ]);
  });

  it('[CRITERION 3] createProject on damaged storage keeps the existing projects', async () => {
    const repo = createLocalStorageRepository();
    seedMixed();

    await repo.createProject(mkProject('d', 'Delta'));

    expect(storedIds(), 'creating a project must not destroy the others').toEqual(
      expect.arrayContaining(['a', 'b', 'c', 'd']),
    );
  });

  /**
   * ⚠️⚠️ THE CRITERION THAT SEPARATES THIS RELEASE FROM A ONE-LINE `.filter()`.
   * Criteria 1-3 above pass under a filter-only implementation too — measured
   * 2026-09-06, all three green while the unreadable element was silently gone
   * after every mutation. Only this one refuses that shape.
   */
  it.each([
    ['saveProject', async (r: ReturnType<typeof createLocalStorageRepository>) =>
      r.saveProject(mkProject('a', 'Apollo EDITED'))],
    ['deleteProject', async (r: ReturnType<typeof createLocalStorageRepository>) =>
      r.deleteProject('a')],
    ['reorderProjects', async (r: ReturnType<typeof createLocalStorageRepository>) =>
      r.reorderProjects(['c', 'b', 'a'])],
    ['createProject', async (r: ReturnType<typeof createLocalStorageRepository>) =>
      r.createProject(mkProject('d', 'Delta'))],
  ])('[CRITERION 8] %s leaves the unreadable entry in storage, value-identical', async (label, run) => {
    const repo = createLocalStorageRepository();
    seedMixed();

    await run(repo);

    expect(
      survivingResidue(),
      `${label} must carry the unreadable entry through, not commit its loss`,
    ).toEqual(MALFORMED);
  });

  // ── Criterion 4: empty storage is NOT damaged storage ──────────────────────

  /**
   * ⚠️ TWO fixtures, and they are different facts. An ABSENT key never reaches
   * the parse; a key holding `"[]"` parses and passes the shape check, because
   * `[].every(...)` is vacuously true. Neither is a failure, and a shape that
   * inferred failure from `length === 0` would break first run on both.
   */
  it.each([
    ['key absent', null],
    ['key holds "[]"', '[]'],
  ])('[CRITERION 4] %s reads as empty and still permits the first createProject', async (_label, raw) => {
    const repo = createLocalStorageRepository();
    if (raw !== null) localStorage.setItem(P, raw);

    expect(await repo.getProjects(), 'empty storage must read as an empty list').toEqual([]);

    await repo.createProject(mkProject('first', 'First Project'));

    expect(storedIds(), 'the first project of a fresh install must be writable').toEqual(['first']);
  });

  it('[CRITERION 4] an absent settings key is first run, not damage', async () => {
    const repo = createLocalStorageRepository();
    await expect(repo.getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  // ── Criterion 5: the two states are distinguishable ────────────────────────

  /**
   * [FALSIFY-AFTER] — cannot fail at HEAD, because before v0.38.0 both states
   * produced the identical `[]` and there was no channel to tell them apart.
   * Earned by breaking the finished build instead (see the PR body).
   */
  it('[CRITERION 5] damaged storage is distinguishable from empty storage', async () => {
    const repo = createLocalStorageRepository();

    localStorage.setItem(P, JSON.stringify([]));
    await expect(repo.getProjects(), 'empty storage must NOT signal failure').resolves.toEqual([]);

    localStorage.setItem(P, '{{{ not json');
    await expect(
      repo.getProjects(),
      'unreadable storage must signal failure rather than returning empty',
    ).rejects.toBeInstanceOf(StorageIntegrityError);
  });

  it.each([
    ['unparseable text', '{{{ not json'],
    ['a non-array value', JSON.stringify({ a: 1 })],
  ])('[CRITERION 5] %s throws rather than reading as empty', async (_label, raw) => {
    const repo = createLocalStorageRepository();
    localStorage.setItem(P, raw);
    await expect(repo.getProjects()).rejects.toBeInstanceOf(StorageIntegrityError);
  });

  it('[CRITERION 5] a write is refused rather than overwriting unreadable storage', async () => {
    const repo = createLocalStorageRepository();
    localStorage.setItem(P, '{{{ not json');

    await expect(repo.saveProject(mkProject('a', 'Apollo'))).rejects.toBeInstanceOf(
      StorageIntegrityError,
    );
    expect(
      localStorage.getItem(P),
      'the unreadable value must be left exactly as it was found',
    ).toBe('{{{ not json');
  });

  // ── Criterion 7: settings and team pool are covered, not bounded out ───────

  /**
   * ⚠️ The v0.37.4 fear, made concrete. Until v0.38.0 this read returned
   * DEFAULT_SETTINGS and one ordinary edit wrote the six seeded rates over the
   * user's real ones. There is no salvageable subset of an object, so the read
   * refuses instead.
   */
  it('[CRITERION 7] damaged settings refuse to read rather than posing as the defaults', async () => {
    const repo = createLocalStorageRepository();
    const real = {
      discountRateAnnual: 0.09,
      laborRates: 'CORRUPT',
      holidays: [{ id: 'h1', name: 'Independence Day', startDate: '2026-07-04', endDate: '2026-07-04' }],
      trafficLightThresholds: { amberPercent: 1, redPercent: 2, violetPercent: 3 },
    };
    localStorage.setItem(S, JSON.stringify(real));

    await expect(
      repo.getSettings(),
      'unreadable settings must not be reported as DEFAULT_SETTINGS',
    ).rejects.toBeInstanceOf(StorageIntegrityError);

    expect(
      JSON.parse(localStorage.getItem(S)!),
      "the user's stored settings must be left untouched by a failed read",
    ).toEqual(real);
  });

  it('[CRITERION 7] saveTeamPool carries unreadable members through', async () => {
    const repo = createLocalStorageRepository();
    const badMember = { name: 'No id here', role: 'BA' };
    localStorage.setItem(
      T,
      JSON.stringify([{ id: 'p1', name: 'Alice', role: 'BA' }, badMember, { id: 'p2', name: 'Bob', role: 'PMO' }]),
    );

    // What the hook would do: read, then persist its own state.
    const pool = await repo.getTeamPool();
    expect(pool.map((m) => m.id), 'the readable members are what the hook sees').toEqual(['p1', 'p2']);
    await repo.saveTeamPool([...pool, { id: 'p3', name: 'Carol', role: 'PMO' }]);

    const stored = JSON.parse(localStorage.getItem(T)!) as Array<Record<string, unknown>>;
    expect(stored.map((m) => m.name), 'no readable member may be lost by a pool write').toEqual(
      expect.arrayContaining(['Alice', 'Bob', 'Carol']),
    );
    expect(
      stored.find((m) => m.id === undefined),
      'the unreadable member must survive the write, value-identical',
    ).toEqual(badMember);
  });

  // ── migrateIfNeeded — the boot-time site ───────────────────────────────────

  function seedForMigration(): void {
    localStorage.setItem(STORAGE_KEYS.version, JSON.stringify('0.15.0'));
    localStorage.setItem(S, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(T, JSON.stringify([]));
  }

  it('[CRITERION 8] a version-bump migration carries the unreadable entry through', async () => {
    const repo = createLocalStorageRepository();
    seedMixed();
    seedForMigration();

    await repo.migrateIfNeeded();

    expect(storedIds(), 'migration must not destroy the readable projects').toEqual(
      expect.arrayContaining(['a', 'b', 'c']),
    );
    expect(
      survivingResidue(),
      'migration must carry the unreadable entry rather than dropping it',
    ).toEqual(MALFORMED);
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.version)!),
      'and it must still advance the version — refusing would leave the user unmigrated',
    ).not.toBe('0.15.0');
  });

  /**
   * ⚠️ `MigrationGuard.tsx:29` is `.then(() => setReady(true))` with no
   * `.catch`. A rejection here renders a permanently blank page, so this asserts
   * the ABSENCE of a throw as a first-class requirement rather than as a
   * side effect of the happy path.
   */
  it('migrateIfNeeded does not reject on unreadable storage, and writes nothing', async () => {
    const repo = createLocalStorageRepository();
    localStorage.setItem(P, '{{{ not json');
    seedForMigration();
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      repo.migrateIfNeeded(),
      'a rejection here is a blank page for the user — it must be swallowed',
    ).resolves.toBeUndefined();

    expect(localStorage.getItem(P), 'nothing may be written over unreadable storage').toBe(
      '{{{ not json',
    );
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.version)!),
      'and the version must NOT advance past data that was never migrated',
    ).toBe('0.15.0');
  });

  /**
   * ⚠️ Renamed after writing: this first read "migrateIfNeeded still propagates a
   * genuine migration failure", which is the OPPOSITE of what it asserts. The
   * assertion was right and the name was wrong — the propagation case is the
   * next test. A test whose name disagrees with its assertion is worse than no
   * test, because the name is what a future reader trusts.
   */
  it('an unreadable TEAM POOL is swallowed at boot too, not just projects', async () => {
    const repo = createLocalStorageRepository();
    localStorage.setItem(P, JSON.stringify([mkProject('a', 'Apollo')]));
    localStorage.setItem(STORAGE_KEYS.version, JSON.stringify('0.15.0'));
    localStorage.setItem(S, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(T, JSON.stringify('not an array'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(repo.migrateIfNeeded()).resolves.toBeUndefined();

    expect(
      localStorage.getItem(T),
      'the unreadable pool must be left exactly as found',
    ).toBe('"not an array"');
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.version)!),
      'and the migration must not have run',
    ).toBe('0.15.0');
  });

  it('the migrate catch is scoped to StorageIntegrityError and rethrows anything else', async () => {
    const repo = createLocalStorageRepository();
    seedForMigration();
    localStorage.setItem(P, JSON.stringify([mkProject('a', 'Apollo')]));
    const boom = new Error('a genuine migration bug');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw boom;
    });

    await expect(
      repo.migrateIfNeeded(),
      'swallowing every Error here would hide real migration bugs',
    ).rejects.toBe(boom);
  });

  // ── Criterion 6: where the signal goes ────────────────────────────────────

  it('[CRITERION 6] describeStorageError rewords ONLY the integrity case', () => {
    const fallback = 'Failed to save project. Please check your connection.';
    expect(
      describeStorageError(new Error('network down'), fallback),
      'an ordinary failure must keep its own wording',
    ).toBe(fallback);

    const message = describeStorageError(new StorageIntegrityError(P, 'not valid JSON'), fallback);
    expect(message, 'an integrity failure must not blame the connection').not.toBe(fallback);
    expect(message, 'and must say the data is intact').toMatch(/intact/i);
    expect(message, 'and must not put a raw storage key in front of a user').not.toContain(P);
  });

  it('[CRITERION 6] an export whose file is short says so', () => {
    seedMixed();
    expect(readStorageResidueCount(), 'the residue must be countable per key').toEqual({
      projects: 1,
      teamPool: 0,
    });

    const notice = describeExportOmission(false);
    expect(notice, 'a short export must be reported').not.toBeNull();
    expect(notice!, 'and must say how many entries were left out').toContain('1 unreadable');
    // ⚠️ Number agreement across BOTH sentences. The original assertion stopped at
    // '1 unreadable' and so passed against "1 unreadable entry was left out because
    // THEY could not be read" — a disagreement only visible in the rendered toast.
    expect(notice!, 'singular copy must agree in both sentences').toBe(
      '1 unreadable entry was left out because it could not be read. It is still in your browser storage.',
    );
  });

  it('[CRITERION 6] the plural form agrees too', () => {
    localStorage.setItem(P, JSON.stringify([mkProject('a', 'Apollo'), { x: 1 }, { y: 2 }]));
    expect(describeExportOmission(false)).toBe(
      '2 unreadable entries were left out because they could not be read. They are still in your browser storage.',
    );
  });

  it('[CRITERION 6] a complete export says nothing, and cloud mode never claims residue', () => {
    localStorage.setItem(P, JSON.stringify([mkProject('a', 'Apollo')]));
    expect(
      describeExportOmission(false),
      'a complete export must not warn — the notice would stop meaning anything',
    ).toBeNull();

    seedMixed();
    expect(
      describeExportOmission(true),
      'residue is a localStorage fact and must not be reported for a cloud export',
    ).toBeNull();
  });

  it('exportAll returns the readable projects rather than nothing', async () => {
    const repo = createLocalStorageRepository();
    seedMixed();
    localStorage.setItem(S, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(T, JSON.stringify([]));

    const data = await repo.exportAll();

    expect(
      data.projects.map((p) => p.id),
      'a backup taken from damaged storage must still carry what could be read',
    ).toEqual(['a', 'b', 'c']);
  });

  // ── importAll is the way out ──────────────────────────────────────────────

  it('importAll replaces damaged storage wholesale — it is the recovery path', async () => {
    const repo = createLocalStorageRepository();
    seedMixed();

    await repo.importAll({
      version: '0.16.0',
      msbExportKind: 'dataset',
      settings: DEFAULT_SETTINGS,
      teamPool: [],
      projects: [mkProject('x', 'Restored')],
    });

    expect(
      survivingResidue(),
      'an import must be able to clear the residue, or the user can never recover',
    ).toBeNull();
    expect(storedIds()).toEqual(['x']);
  });
});
