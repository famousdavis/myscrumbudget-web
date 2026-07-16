// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizeProjectName,
  detectConflicts,
  buildMergePreview,
  mergeTeamPool,
  buildBannerText,
  applyImportMerge,
  type MergePreview,
  type ImportDecision,
} from '../importUtils';
import { repo, switchRepoImpl } from '@/lib/storage/repo';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import { cloudSyncBus } from '@/lib/firebase/cloudSyncBus';
import { appendToChangeLog } from '@/lib/storage/fingerprint';
import type { AppState, Project, PoolMember, Settings } from '@/types/domain';
import type { Repository } from '@/lib/storage/repository';

// ── Test fixtures ──────────────────────────────────────────────────────

function makeSettings(): Settings {
  return {
    discountRateAnnual: 0.05,
    laborRates: [{ role: 'Dev', hourlyRate: 100 }],
    holidays: [],
    trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Project One',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    activeReforecastId: 'rf1',
    reforecasts: [
      {
        id: 'rf1',
        name: 'Baseline',
        createdAt: '2026-01-01T00:00:00.000Z',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        reforecastDate: '2026-01-01',
        allocations: [],
        assignments: [],
        productivityWindows: [],
        actualCost: 0,
        baselineBudget: 100000,
      },
    ],
    ...overrides,
  };
}

function makeAppState(projects: Project[], teamPool: PoolMember[] = []): AppState {
  return {
    version: '0.30.0',
    msbExportKind: 'dataset',
    settings: makeSettings(),
    teamPool,
    projects,
  };
}

vi.mock('@/lib/storage/fingerprint', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage/fingerprint')>();
  return {
    ...actual,
    appendToChangeLog: vi.fn(),
  };
});

// ── normalizeProjectName ───────────────────────────────────────────────

describe('normalizeProjectName', () => {
  it('trims leading/trailing whitespace', () => {
    expect(normalizeProjectName('  Foo  ')).toBe('foo');
  });
  it('lowercases', () => {
    expect(normalizeProjectName('Foo Bar')).toBe('foo bar');
  });
  it('NFC-normalizes (composed vs decomposed give same result)', () => {
    const composed = 'café';        // é as single code point
    const decomposed = 'café';     // e + combining acute
    expect(normalizeProjectName(composed)).toBe(normalizeProjectName(decomposed));
  });
});

// ── detectConflicts ────────────────────────────────────────────────────

describe('detectConflicts', () => {
  it('ID conflict → decision is skip, conflict.type is id', () => {
    const incoming = [makeProject({ id: 'p1', name: 'Different Name' })];
    const existing = [makeProject({ id: 'p1', name: 'Existing One' })];
    const { decisions, conflicts } = detectConflicts(incoming, existing);
    expect(decisions['p1']).toBe('skip');
    expect(conflicts['p1'].type).toBe('id');
    expect(conflicts['p1'].existingName).toBe('Existing One');
  });

  it('name conflict (case-insensitive) → decision is skip, conflict.type is name', () => {
    const incoming = [makeProject({ id: 'p_new', name: 'foo bar' })];
    const existing = [makeProject({ id: 'p_old', name: 'FOO BAR' })];
    const { decisions, conflicts } = detectConflicts(incoming, existing);
    expect(decisions['p_new']).toBe('skip');
    expect(conflicts['p_new'].type).toBe('name');
    expect(conflicts['p_new'].existingId).toBe('p_old');
  });

  it('uses identical normalization as normalizeProjectName', () => {
    const incoming = [makeProject({ id: 'p_new', name: '  CAFÉ  ' })];
    const existing = [makeProject({ id: 'p_old', name: 'café' })];
    const { conflicts } = detectConflicts(incoming, existing);
    expect(conflicts['p_new']?.type).toBe('name');
  });

  it('empty project name is not matched by name-based detection', () => {
    const incoming = [makeProject({ id: 'p_new', name: '' })];
    const existing = [makeProject({ id: 'p_old', name: '' })];
    const { decisions, conflicts } = detectConflicts(incoming, existing);
    expect(decisions['p_new']).toBe('add');
    expect(conflicts['p_new']).toBeUndefined();
  });

  it('no conflict → decision is add', () => {
    const incoming = [makeProject({ id: 'p_new', name: 'Brand New' })];
    const existing = [makeProject({ id: 'p_old', name: 'Old One' })];
    const { decisions, conflicts } = detectConflicts(incoming, existing);
    expect(decisions['p_new']).toBe('add');
    expect(conflicts['p_new']).toBeUndefined();
  });

  it('mixed: some conflict, some not — correct per-project defaults', () => {
    const incoming = [
      makeProject({ id: 'a', name: 'Alpha' }),                    // no conflict → add
      makeProject({ id: 'b', name: 'Beta' }),                     // ID conflict
      makeProject({ id: 'c_new', name: 'Gamma' }),                // name conflict
    ];
    const existing = [
      makeProject({ id: 'b', name: 'Beta Original' }),
      makeProject({ id: 'c_old', name: 'gamma' }),
    ];
    const { decisions } = detectConflicts(incoming, existing);
    expect(decisions['a']).toBe('add');
    expect(decisions['b']).toBe('skip');
    expect(decisions['c_new']).toBe('skip');
  });

  it('carries existingArchived when the conflicting existing project is archived', () => {
    const incoming = [makeProject({ id: 'p_new', name: 'Shared Name' })];
    const existing = [makeProject({ id: 'p_old', name: 'Shared Name', archived: true })];
    const { conflicts } = detectConflicts(incoming, existing);
    expect(conflicts['p_new'].type).toBe('name');
    expect(conflicts['p_new'].existingArchived).toBe(true);
  });

  it('leaves existingArchived undefined for an active conflicting project', () => {
    const incoming = [makeProject({ id: 'p1', name: 'X' })];
    const existing = [makeProject({ id: 'p1', name: 'X' })];
    const { conflicts } = detectConflicts(incoming, existing);
    expect(conflicts['p1'].existingArchived).toBeUndefined();
  });
});

// ── buildMergePreview ──────────────────────────────────────────────────

describe('buildMergePreview', () => {
  it('drops duplicate IDs and tracks the count', () => {
    const projects = Array.from({ length: 10 }, (_, i) =>
      makeProject({ id: `p${i}`, name: `Project ${i}` }),
    );
    // Indices 5 and 8 duplicate IDs from 0 and 2
    projects[5] = makeProject({ id: 'p0', name: 'dupe of p0' });
    projects[8] = makeProject({ id: 'p2', name: 'dupe of p2' });

    const state = makeAppState(projects);
    const preview = buildMergePreview(state, [], 'local');

    expect(preview.incomingState.projects).toHaveLength(8);
    expect(preview.duplicatesDropped).toBe(2);
    expect(Object.keys(preview.decisions)).toHaveLength(8);
  });

  it('settings default is keep', () => {
    const preview = buildMergePreview(makeAppState([]), [], 'local');
    expect(preview.settingsDecision).toBe('keep');
  });

  it('teamPool default is merge', () => {
    const preview = buildMergePreview(makeAppState([]), [], 'local');
    expect(preview.teamPoolDecision).toBe('merge');
  });
});

// ── mergeTeamPool ──────────────────────────────────────────────────────

describe('mergeTeamPool', () => {
  it('appends new members not in existing by ID', () => {
    const existing: PoolMember[] = [{ id: 'm1', name: 'Alice', role: 'Dev' }];
    const incoming: PoolMember[] = [{ id: 'm2', name: 'Bob', role: 'PM' }];
    const merged = mergeTeamPool(existing, incoming);
    expect(merged).toEqual([
      { id: 'm1', name: 'Alice', role: 'Dev' },
      { id: 'm2', name: 'Bob', role: 'PM' },
    ]);
  });

  it('does NOT overwrite existing members with same ID', () => {
    const existing: PoolMember[] = [{ id: 'm1', name: 'Alice (local)', role: 'Dev' }];
    const incoming: PoolMember[] = [{ id: 'm1', name: 'Alice (import)', role: 'PM' }];
    const merged = mergeTeamPool(existing, incoming);
    expect(merged).toEqual([{ id: 'm1', name: 'Alice (local)', role: 'Dev' }]);
  });
});

// ── buildBannerText ────────────────────────────────────────────────────

describe('buildBannerText', () => {
  it('all zero → nothing applied', () => {
    expect(
      buildBannerText({
        addedCount: 0, replacedCount: 0, skippedCount: 0,
        errorCount: 0, errorMessages: [],
      }),
    ).toBe('Import complete: nothing applied.');
  });

  it('skip-only includes N skipped', () => {
    expect(
      buildBannerText({
        addedCount: 0, replacedCount: 0, skippedCount: 3,
        errorCount: 0, errorMessages: [],
      }),
    ).toBe('Import complete: 3 skipped.');
  });

  it('mixed → comma-separated non-zero counts', () => {
    expect(
      buildBannerText({
        addedCount: 2, replacedCount: 1, skippedCount: 3,
        errorCount: 0, errorMessages: [],
      }),
    ).toBe('Import complete: 2 added, 1 replaced, 3 skipped.');
  });

  it('error count does not appear in banner text', () => {
    const text = buildBannerText({
      addedCount: 1, replacedCount: 0, skippedCount: 0,
      errorCount: 2, errorMessages: ['err1', 'err2'],
    });
    expect(text).toBe('Import complete: 1 added.');
    expect(text).not.toMatch(/error/i);
  });
});

// ── applyImportMerge ────────────────────────────────────────────────────

function makePreview(
  decisions: Record<string, ImportDecision>,
  projects: Project[],
  opts: Partial<MergePreview> = {},
): MergePreview {
  return {
    incomingState: makeAppState(projects, opts.incomingState?.teamPool ?? []),
    existingProjects: opts.existingProjects ?? [],
    decisions,
    conflicts: opts.conflicts ?? {},
    settingsDecision: opts.settingsDecision ?? 'keep',
    teamPoolDecision: opts.teamPoolDecision ?? 'keep',
    mode: opts.mode ?? 'local',
    duplicatesDropped: 0,
  };
}

describe('applyImportMerge', () => {
  beforeEach(async () => {
    localStorage.clear();
    switchRepoImpl(createLocalStorageRepository());
    vi.mocked(appendToChangeLog).mockClear();
  });

  it('addedCount increments on add decision', async () => {
    const project = makeProject({ id: 'new1', name: 'Brand New' });
    const result = await applyImportMerge(
      makePreview({ new1: 'add' }, [project]),
    );
    expect(result.addedCount).toBe(1);
    expect(result.replacedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.errorCount).toBe(0);

    const stored = await repo.getProjects();
    expect(stored.find((p) => p.id === 'new1')).toBeDefined();
  });

  it('replacedCount increments on replace decision', async () => {
    const existing = makeProject({ id: 'p1', name: 'Original' });
    await repo.saveProject(existing);

    const incoming = makeProject({ id: 'p1', name: 'Updated' });
    const result = await applyImportMerge(
      makePreview(
        { p1: 'replace' },
        [incoming],
        {
          existingProjects: [existing],
          conflicts: { p1: { type: 'id', existingId: 'p1', existingName: 'Original' } },
        },
      ),
    );
    expect(result.replacedCount).toBe(1);

    const stored = await repo.getProjects();
    expect(stored.find((p) => p.id === 'p1')?.name).toBe('Updated');
  });

  it('skippedCount increments on skip decision', async () => {
    const project = makeProject({ id: 'p1', name: 'X' });
    const result = await applyImportMerge(
      makePreview({ p1: 'skip' }, [project]),
    );
    expect(result.skippedCount).toBe(1);
  });

  it('errorCount + errorMessages populated on thrown write', async () => {
    // Mock a repo that throws on createProject
    const throwing: Repository = {
      ...createLocalStorageRepository(),
      createProject: async () => { throw new Error('boom'); },
    };
    switchRepoImpl(throwing);

    const result = await applyImportMerge(
      makePreview({ p1: 'add' }, [makeProject({ id: 'p1' })]),
    );
    expect(result.errorCount).toBe(1);
    expect(result.errorMessages[0]).toContain('boom');
  });

  it('teamPool-only changelog: all projects skip, teamPool merge succeeds → appendToChangeLog IS called', async () => {
    const preview = makePreview(
      { p1: 'skip' },
      [makeProject({ id: 'p1' })],
      { teamPoolDecision: 'merge' },
    );
    preview.incomingState.teamPool = [{ id: 'm1', name: 'A', role: 'Dev' }];

    await applyImportMerge(preview);
    expect(vi.mocked(appendToChangeLog)).toHaveBeenCalledTimes(1);
  });

  it('settings-only changelog: all projects skip, settings replace succeeds → appendToChangeLog IS called', async () => {
    const preview = makePreview(
      { p1: 'skip' },
      [makeProject({ id: 'p1' })],
      { settingsDecision: 'replace' },
    );
    await applyImportMerge(preview);
    expect(vi.mocked(appendToChangeLog)).toHaveBeenCalledTimes(1);
  });

  it('all-writes-fail changelog: all writes throw → appendToChangeLog NOT called', async () => {
    const allThrow: Repository = {
      ...createLocalStorageRepository(),
      createProject: async () => { throw new Error('p'); },
      saveSettings: async () => { throw new Error('s'); },
      saveTeamPool: async () => { throw new Error('t'); },
    };
    switchRepoImpl(allThrow);

    const preview = makePreview(
      { p1: 'add' },
      [makeProject({ id: 'p1' })],
      { settingsDecision: 'replace', teamPoolDecision: 'replace' },
    );
    await applyImportMerge(preview);
    expect(vi.mocked(appendToChangeLog)).not.toHaveBeenCalled();
  });

  it('cloudSyncBus: emits projects always; settings only on replace success; teamPool only on merge/replace success', async () => {
    const emitSpy = vi.spyOn(cloudSyncBus, 'emit');
    emitSpy.mockClear();

    await applyImportMerge(
      makePreview(
        { p1: 'skip' },
        [makeProject({ id: 'p1' })],
        { settingsDecision: 'replace', teamPoolDecision: 'merge' },
      ),
    );

    const events = emitSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain('projects');
    expect(events).toContain('settings');
    expect(events).toContain('teamPool');
  });

  it('cloudSyncBus: keep/keep emits projects only', async () => {
    const emitSpy = vi.spyOn(cloudSyncBus, 'emit');
    emitSpy.mockClear();

    await applyImportMerge(
      makePreview({ p1: 'skip' }, [makeProject({ id: 'p1' })]),
    );

    const events = emitSpy.mock.calls.map((c) => c[0]);
    expect(events).toEqual(['projects']);
  });

  it('write-order: teamPool replace + project adds → saveTeamPool fires BEFORE any createProject (C2 guard)', async () => {
    const callOrder: string[] = [];
    const tracker: Repository = {
      ...createLocalStorageRepository(),
      saveTeamPool: async (pool) => {
        callOrder.push('saveTeamPool');
        await createLocalStorageRepository().saveTeamPool(pool);
      },
      createProject: async (p) => {
        callOrder.push('createProject');
        await createLocalStorageRepository().createProject(p);
      },
    };
    switchRepoImpl(tracker);

    const preview = makePreview(
      { p1: 'add', p2: 'add' },
      [makeProject({ id: 'p1', name: 'A' }), makeProject({ id: 'p2', name: 'B' })],
      { teamPoolDecision: 'replace' },
    );
    preview.incomingState.teamPool = [{ id: 'm1', name: 'A', role: 'Dev' }];

    await applyImportMerge(preview);

    expect(callOrder[0]).toBe('saveTeamPool');
    expect(callOrder.indexOf('saveTeamPool')).toBeLessThan(callOrder.indexOf('createProject'));
  });

  it('name-conflict target-changed: freshByName returns a different ID than conflict.existingId → falls back to add (C3 guard)', async () => {
    // Layer 1 conflict says: incoming "Foo" conflicts with existing project (id=old-id) named "Foo"
    // Layer 2 reality: a DIFFERENT project (id=new-id) now holds the name "Foo"
    // Expected: silent replace would clobber the new project; we must fall back to add.
    const layer2Project = makeProject({ id: 'new-id', name: 'Foo' });
    await repo.saveProject(layer2Project);

    const incoming = makeProject({ id: 'incoming-id', name: 'Foo' });
    const preview = makePreview(
      { 'incoming-id': 'replace' },
      [incoming],
      {
        conflicts: {
          'incoming-id': { type: 'name', existingId: 'old-id', existingName: 'Foo' },
        },
      },
    );

    const result = await applyImportMerge(preview);
    expect(result.addedCount).toBe(1);
    expect(result.replacedCount).toBe(0);

    const stored = await repo.getProjects();
    // new-id should still have its original name
    expect(stored.find((p) => p.id === 'new-id')?.name).toBe('Foo');
    // a separate added project should also exist
    expect(stored.some((p) => p.id === 'incoming-id')).toBe(true);
  });

  it('Layer 2 guard: target deleted between Layer 1 and Layer 2 → falls back to add', async () => {
    const incoming = makeProject({ id: 'gone', name: 'Ghost' });
    // No saveProject — gone never existed; conflict reports otherwise.
    const preview = makePreview(
      { gone: 'replace' },
      [incoming],
      {
        conflicts: {
          gone: { type: 'id', existingId: 'gone', existingName: 'Old Ghost' },
        },
      },
    );

    const result = await applyImportMerge(preview);
    expect(result.addedCount).toBe(1);
    expect(result.replacedCount).toBe(0);

    const stored = await repo.getProjects();
    expect(stored.find((p) => p.id === 'gone')).toBeDefined();
  });
});
