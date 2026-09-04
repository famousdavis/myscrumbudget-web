// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createLocalStorageRepository,
  DEFAULT_SETTINGS,
} from '../localStorage';
import { STORAGE_KEYS } from '@/types/storage';
import type { PoolMember, Project, Settings, AppState } from '@/types/domain';
import {
  WORKSPACE_ID_KEY,
  setExportAttribution,
  getChangeLog,
} from '../fingerprint';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj_001',
    name: 'Test Project',
    startDate: '2026-06-15',
    endDate: '2027-07-15',
    reforecasts: [
      {
        id: 'rf-baseline',
        name: 'Baseline',
        createdAt: '2026-06-01T00:00:00Z',
        startDate: '2026-06-15',
        endDate: '2027-07-15',
        reforecastDate: '2026-06-01',
        assignments: [],
        allocations: [],
        productivityWindows: [],
        actualCost: 200000,
        baselineBudget: 1000000,
      },
    ],
    activeReforecastId: 'rf-baseline',
    ...overrides,
  };
}

describe('LocalStorage Repository', () => {
  let repo: ReturnType<typeof createLocalStorageRepository>;

  beforeEach(() => {
    localStorage.clear();
    repo = createLocalStorageRepository();
  });

  describe('Settings', () => {
    it('returns default settings when none are stored', async () => {
      const settings = await repo.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('saves and retrieves settings', async () => {
      const custom: Settings = {
        discountRateAnnual: 0.05,
        laborRates: [{ role: 'Dev', hourlyRate: 120 }],
        holidays: [],
        trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
      };
      await repo.saveSettings(custom);
      const result = await repo.getSettings();
      expect(result).toEqual(custom);
    });
  });

  describe('Projects', () => {
    it('returns empty array when no projects stored', async () => {
      const projects = await repo.getProjects();
      expect(projects).toEqual([]);
    });

    it('saves and retrieves a project', async () => {
      const project = makeProject();
      await repo.saveProject(project);
      const result = await repo.getProject('proj_001');
      expect(result).toEqual(project);
    });

    it('updates an existing project', async () => {
      const project = makeProject();
      await repo.saveProject(project);
      const updated = { ...project, name: 'Updated Name' };
      await repo.saveProject(updated);
      const result = await repo.getProject('proj_001');
      expect(result?.name).toBe('Updated Name');
      const all = await repo.getProjects();
      expect(all).toHaveLength(1);
    });

    it('deletes a project', async () => {
      await repo.saveProject(makeProject({ id: 'p1' }));
      await repo.saveProject(makeProject({ id: 'p2' }));
      await repo.deleteProject('p1');
      const all = await repo.getProjects();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('p2');
    });

    it('returns null for non-existent project', async () => {
      const result = await repo.getProject('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('Team Pool', () => {
    it('returns empty array when no pool stored', async () => {
      const pool = await repo.getTeamPool();
      expect(pool).toEqual([]);
    });

    it('saves and retrieves pool members', async () => {
      const pool = [
        { id: 'pm1', name: 'Alice', role: 'Dev' },
        { id: 'pm2', name: 'Bob', role: 'QA' },
      ];
      await repo.saveTeamPool(pool);
      const result = await repo.getTeamPool();
      expect(result).toEqual(pool);
    });
  });

  describe('reorderProjects', () => {
    // ⚠️ REWRITTEN IN PLACE at v0.37.12, NOT deleted. Up to v0.37.11 this
    // describe pinned the OPPOSITE behaviour — it asserted that an id omitted
    // from `orderedIds` was permanently removed from storage, and its comment
    // presented that as the documented reason the Dashboard must hand
    // `useDragReorder` the FULL project list. The drop was real and it was a
    // data-loss defect, not a contract: two tabs, create a project in tab A,
    // drag in tab B, and tab A's project is destroyed with no error and nothing
    // on screen. The behaviour is now end-placement (see the contract on
    // `Repository.reorderProjects`).
    //
    // ⚠️ THE CALLER-SIDE RULE SURVIVES, for a changed reason — the Dashboard
    // still passes the FULL list, now to keep the ORDER of hidden archived
    // projects rather than to keep them in existence at all. That half is
    // asserted in `src/app/__tests__/page.test.tsx`, not here.
    it('keeps a stored project whose id is omitted from orderedIds, placing it after the handled ones', async () => {
      await repo.saveProject(makeProject({ id: 'a' }));
      await repo.saveProject(makeProject({ id: 'b' }));
      await repo.saveProject(makeProject({ id: 'c' }));

      // Omit 'b', as a stale caller would.
      await repo.reorderProjects(['c', 'a']);

      const remaining = (await repo.getProjects()).map((p) => p.id);
      expect(remaining).toEqual(['c', 'a', 'b']);
    });

    it('keeps unhandled projects in their existing relative storage order', async () => {
      // The contract's SECOND clause. Without this, reversing the appended run
      // would fail nothing: with a single unhandled project there is no relative
      // order to observe, so one omitted id cannot distinguish the two.
      await repo.saveProject(makeProject({ id: 'a' }));
      await repo.saveProject(makeProject({ id: 'b' }));
      await repo.saveProject(makeProject({ id: 'c' }));
      await repo.saveProject(makeProject({ id: 'd' }));

      await repo.reorderProjects(['d', 'b']);

      // 'a' before 'c' — their order in storage, not the order they were omitted.
      expect((await repo.getProjects()).map((p) => p.id)).toEqual(['d', 'b', 'a', 'c']);
    });

    it('writes exactly the handed order when orderedIds covers every stored project', async () => {
      // The non-stale path: nothing is appended and behaviour is unchanged from
      // pre-v0.37.12. This is what keeps the rest of the suite green.
      await repo.saveProject(makeProject({ id: 'a' }));
      await repo.saveProject(makeProject({ id: 'b' }));
      await repo.saveProject(makeProject({ id: 'c' }));

      await repo.reorderProjects(['c', 'b', 'a']);

      expect((await repo.getProjects()).map((p) => p.id)).toEqual(['c', 'b', 'a']);
    });
  });

  describe('Export / Import', () => {
    it('exports all data', async () => {
      const project = makeProject();
      await repo.saveProject(project);
      const exported = await repo.exportAll();
      expect(exported.version).toBe('0.16.0');
      expect(exported.settings).toEqual(DEFAULT_SETTINGS);
      expect(exported.teamPool).toEqual([]);
      expect(exported.projects).toEqual([project]);
    });

    it('imports data and overwrites existing', async () => {
      await repo.saveProject(makeProject({ id: 'old' }));
      const importData = {
        version: '0.3.0',
        settings: {
          discountRateAnnual: 0.05,
          laborRates: [],
          holidays: [],
          trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
        },
        teamPool: [],
        projects: [makeProject({ id: 'new' })],
      };
      await repo.importAll(importData);
      const projects = await repo.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe('new');
      const settings = await repo.getSettings();
      expect(settings.discountRateAnnual).toBe(0.05);
    });
  });

  describe('Import / Export Round-Trip', () => {
    it('exported data can be re-imported without loss', async () => {
      const project = makeProject({ id: 'rt1', name: 'RoundTrip' });
      await repo.saveProject(project);
      await repo.saveTeamPool([
        { id: 'pm1', name: 'Alice', role: 'Dev' },
      ]);

      const exported = await repo.exportAll();
      await repo.clear();

      // Verify cleared
      expect(await repo.getProjects()).toEqual([]);

      await repo.importAll(exported);
      const projects = await repo.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('RoundTrip');

      const pool = await repo.getTeamPool();
      expect(pool).toHaveLength(1);
      expect(pool[0].name).toBe('Alice');
    });

    it('imported older data is migrated correctly through runMigrations', async () => {
      const { runMigrations } = await import('../../storage/migrations');

      const v1Data = {
        version: '1.0.0',
        settings: {
          hoursPerMonth: 160,
          discountRateAnnual: 0.03,
          laborRates: [],
        },
        teamPool: [],
        projects: [{
          id: 'p1',
          name: 'Legacy',
          startDate: '2026-06',
          endDate: '2027-06',
          baselineBudget: 100000,
          actualCost: 0,
          teamMembers: [
            { id: 'tm1', name: 'Bob', role: 'Dev', type: 'Core' },
          ],
          reforecasts: [],
          activeReforecastId: null,
        }],
      };

      // Simulate import flow: run migrations then import. The cast is
      // `unknown` (then narrowed at the call site) because v1Data is a
      // legacy shape that predates the current AppState type; runMigrations
      // accepts arbitrary input by contract.
      const migrated = runMigrations(v1Data as unknown as Parameters<typeof runMigrations>[0], '1.0.0');
      await repo.importAll(migrated);

      const projects = await repo.getProjects();
      expect(projects).toHaveLength(1);
      // v0.11.0 migration: assignments moved from project to baseline reforecast
      expect((projects[0] as unknown as Record<string, unknown>).assignments).toBeUndefined();
      expect(projects[0].reforecasts[0].assignments).toHaveLength(1);
      expect((projects[0] as unknown as Record<string, unknown>).teamMembers).toBeUndefined();

      const pool = await repo.getTeamPool();
      expect(pool).toHaveLength(1);
      expect(pool[0].name).toBe('Bob');

      // v0.4.0 migration: actualCost moved into Baseline reforecast
      expect((projects[0] as unknown as Record<string, unknown>).actualCost).toBeUndefined();
      expect(projects[0].reforecasts).toHaveLength(1);
      expect(projects[0].reforecasts[0].name).toBe('Baseline');
      expect(projects[0].reforecasts[0].actualCost).toBe(0);
      expect(projects[0].activeReforecastId).toBe(projects[0].reforecasts[0].id);

      // v0.5.0 migration: baselineBudget moved into reforecast, reforecastDate added
      expect((projects[0] as unknown as Record<string, unknown>).baselineBudget).toBeUndefined();
      expect(projects[0].reforecasts[0].baselineBudget).toBe(100000);
      expect(projects[0].reforecasts[0].reforecastDate).toBeTruthy();

      // hoursPerMonth should be stripped
      const settings = await repo.getSettings();
      expect((settings as unknown as Record<string, unknown>).hoursPerMonth).toBeUndefined();
    });
  });

  describe('Clear', () => {
    it('removes all stored data', async () => {
      await repo.saveProject(makeProject());
      await repo.clear();
      const projects = await repo.getProjects();
      expect(projects).toEqual([]);
      // Settings should return defaults after clear
      const settings = await repo.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('Version', () => {
    it('returns current version when none stored', async () => {
      const version = await repo.getVersion();
      expect(version).toBe('0.16.0');
    });
  });

  describe('Export with fingerprinting', () => {
    it('includes _originRef, _storageRef, and _changeLog in exported data', async () => {
      await repo.saveProject(makeProject());
      const exported = await repo.exportAll();
      expect(exported._originRef).toBeTruthy();
      expect(exported._storageRef).toBeTruthy();
      expect(exported._originRef).toBe(exported._storageRef); // same browser
      expect(Array.isArray(exported._changeLog)).toBe(true);
    });

    it('includes _exportedBy and _exportedById when attribution is set', async () => {
      setExportAttribution({ name: 'Jane', id: 'j123' });
      const exported = await repo.exportAll();
      expect(exported._exportedBy).toBe('Jane');
      expect(exported._exportedById).toBe('j123');
    });

    it('omits _exportedBy and _exportedById when attribution is empty', async () => {
      setExportAttribution({ name: '', id: '' });
      const exported = await repo.exportAll();
      expect(exported._exportedBy).toBeUndefined();
      expect(exported._exportedById).toBeUndefined();
    });
  });

  describe('Import with fingerprinting', () => {
    it('preserves _originRef from imported data', async () => {
      const importData: AppState = {
        version: '0.7.0',
        settings: DEFAULT_SETTINGS,
        teamPool: [],
        projects: [],
        _originRef: 'foreign-browser-id',
        _changeLog: [],
      };
      await repo.importAll(importData);
      expect(localStorage.getItem(STORAGE_KEYS.originRef)).toBe('foreign-browser-id');
    });

    it('backfills _originRef with workspace ID when missing from imported data', async () => {
      const importData: AppState = {
        version: '0.7.0',
        settings: DEFAULT_SETTINGS,
        teamPool: [],
        projects: [],
      };
      await repo.importAll(importData);
      const storedRef = localStorage.getItem(STORAGE_KEYS.originRef);
      expect(storedRef).toBeTruthy();
      // Should be the local workspace ID
      expect(storedRef).toBe(localStorage.getItem(WORKSPACE_ID_KEY));
    });

    it('appends import event to _changeLog', async () => {
      const importData: AppState = {
        version: '0.7.0',
        settings: DEFAULT_SETTINGS,
        teamPool: [],
        projects: [],
        _changeLog: [{ t: 1000, op: 'add', entity: 'project', id: 'p1' }],
      };
      await repo.importAll(importData);
      const log = getChangeLog();
      expect(log).toHaveLength(2);
      expect(log[0].op).toBe('add');
      expect(log[1].op).toBe('import');
      expect(log[1].entity).toBe('dataset');
      expect(log[1].source).toBe('file');
    });

    it('creates import event even with empty imported changelog', async () => {
      const importData: AppState = {
        version: '0.7.0',
        settings: DEFAULT_SETTINGS,
        teamPool: [],
        projects: [],
      };
      await repo.importAll(importData);
      const log = getChangeLog();
      expect(log).toHaveLength(1);
      expect(log[0].op).toBe('import');
    });
  });
});

describe('saveSettingsAndTeamPool — one operation, pool written first (PR C1)', () => {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    laborRates: [{ role: 'Business Analyst', hourlyRate: 75 }],
  };
  const pool: PoolMember[] = [
    { id: 'pm1', name: 'Alice', role: 'Business Analyst' },
    { id: 'pm2', name: 'Cara', role: 'Business Analyst', archived: true },
  ];

  afterEach(() => { vi.restoreAllMocks(); });

  it('writes the POOL BEFORE the rates', () => {
    /**
     * ⚠️ This was the ONE criterion that could not be run against unfixed HEAD,
     * and the reason is worth keeping: before this method existed there was no
     * single operation whose write order could be observed. A test would have
     * had to issue the two calls itself and would then have been asserting
     * about its own sequence rather than about the code. It is verified here,
     * after the fact, by observing `setItem` order — which is only meaningful
     * because ONE call now produces both writes.
     *
     * The order is load-bearing: see the comment at the implementation. Both
     * orders leave identical markers on screen, so only recoverability and
     * quota separate them, and both favour pool-first.
     */
    const keys: string[] = [];
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage, k: string, v: string,
    ) {
      keys.push(k);
      original.call(this, k, v);
    });

    const repo = createLocalStorageRepository();
    return repo.saveSettingsAndTeamPool(settings, pool).then(() => {
      // Both keys, in this order. Asserting membership alone would pass under
      // either order and would not be this criterion.
      expect(keys).toEqual([STORAGE_KEYS.teamPool, STORAGE_KEYS.settings]);
    });
  });

  it('[REGRESSION] both halves land, and the archived member is carried', async () => {
    // ⚠️ [REGRESSION], NOT [FAILS-TODAY]. This is a behaviour test of the new
    // method, not a criterion that discriminates fixed from unfixed code —
    // against HEAD it could only have thrown "not a function", which is the
    // same output as a typo or a bad import and proves nothing.
    //
    // What it DOES bound: the pool half must carry archived members.
    // `resolveAssignments` applies no archived filter, so an archived member in
    // a saved reforecast is still costed — an un-cascaded one is orphaned just
    // as loudly as an active one, and silently in the numbers.
    const repo = createLocalStorageRepository();
    await repo.saveSettingsAndTeamPool(settings, pool);

    expect(await repo.getSettings()).toEqual(settings);
    expect(await repo.getTeamPool()).toEqual(pool);
    expect((await repo.getTeamPool()).find((m) => m.archived === true)?.role)
      .toBe('Business Analyst');
  });
});
