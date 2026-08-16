// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import type { Project, PoolMember, ProjectAssignment, Reforecast } from '@/types/domain';
import { resolveAssignments, getActiveReforecast } from '@/lib/utils/teamResolution';
import { useTeam } from '../hooks/useTeam';

const repo = createLocalStorageRepository();

/**
 * Renders the REAL useTeam with an updateProject that actually applies the
 * updater, so the hook's own reducers run rather than a copy of them.
 *
 * This file previously hand-wrote useTeam's withActiveReforecast map inline and
 * asserted against that copy — so the v0.24.0 per-reforecast invariant it named
 * was pinned to the test's own arithmetic, not to the hook. useTeam.ts measured
 * 0/38 statements while a test bearing its name passed.
 */
function teamHarness(initial: Project, members: PoolMember[] = pool) {
  const box = { current: initial };
  const view = renderHook(
    ({ p }) =>
      useTeam({
        project: p,
        updateProject: (u) => {
          box.current = u(box.current);
        },
        pool: members,
      }),
    { initialProps: { p: box.current } },
  );
  const run = (fn: (api: ReturnType<typeof useTeam>) => void) => {
    act(() => {
      fn(view.result.current);
    });
    view.rerender({ p: box.current });
  };
  return { box, view, run };
}

function makeBaselineReforecast(overrides: Partial<Reforecast> = {}): Reforecast {
  return {
    id: 'rf-baseline',
    name: 'Baseline',
    createdAt: '2025-01-01T00:00:00Z',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    reforecastDate: '2025-01-01',
    assignments: [],
    allocations: [],
    productivityWindows: [],
    actualCost: 0,
    baselineBudget: 500000,
    ...overrides,
  };
}

function makeProject(
  overrides: Partial<Project> = {},
  assignments: ProjectAssignment[] = [],
): Project {
  return {
    id: 'test-project',
    name: 'Test Project',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    reforecasts: [makeBaselineReforecast({ assignments })],
    activeReforecastId: 'rf-baseline',
    ...overrides,
  };
}

const pool: PoolMember[] = [
  { id: 'pm1', name: 'Alice', role: 'BA' },
  { id: 'pm2', name: 'Bob', role: 'IT-SoftEng' },
  { id: 'pm3', name: 'Charlie', role: 'PMO' },
];

describe('Team Assignment CRUD (per-reforecast)', () => {
  beforeEach(async () => {
    await repo.clear();
  });

  it('adds an assignment to the active reforecast', async () => {
    const project = makeProject({}, [{ id: 'a1', poolMemberId: 'pm1' }]);
    await repo.saveProject(project);

    const retrieved = await repo.getProject('test-project');
    const activeRf = getActiveReforecast(retrieved!);
    expect(activeRf?.assignments).toHaveLength(1);
    expect(activeRf?.assignments[0].poolMemberId).toBe('pm1');

    const members = resolveAssignments(activeRf!.assignments, pool);
    expect(members[0].name).toBe('Alice');
    expect(members[0].role).toBe('BA');
  });

  it('adds multiple assignments', async () => {
    const project = makeProject({}, [
      { id: 'a1', poolMemberId: 'pm1' },
      { id: 'a2', poolMemberId: 'pm2' },
      { id: 'a3', poolMemberId: 'pm3' },
    ]);
    await repo.saveProject(project);

    const retrieved = await repo.getProject('test-project');
    const activeRf = getActiveReforecast(retrieved!);
    expect(activeRf?.assignments).toHaveLength(3);

    const members = resolveAssignments(activeRf!.assignments, pool);
    expect(members).toHaveLength(3);
  });

  it('removes an assignment', async () => {
    const project = makeProject({}, [
      { id: 'a1', poolMemberId: 'pm1' },
      { id: 'a2', poolMemberId: 'pm2' },
    ]);
    await repo.saveProject(project);

    const updated: Project = {
      ...project,
      reforecasts: project.reforecasts.map((rf) => ({
        ...rf,
        assignments: rf.assignments.filter((a) => a.id !== 'a1'),
      })),
    };
    await repo.saveProject(updated);

    const retrieved = await repo.getProject('test-project');
    const activeRf = getActiveReforecast(retrieved!);
    expect(activeRf?.assignments).toHaveLength(1);
    expect(activeRf?.assignments[0].id).toBe('a2');
  });

  it('preserves assignments across project updates', async () => {
    const project = makeProject({}, [{ id: 'a1', poolMemberId: 'pm1' }]);
    await repo.saveProject(project);

    project.name = 'Renamed Project';
    await repo.saveProject(project);

    const retrieved = await repo.getProject('test-project');
    expect(retrieved?.name).toBe('Renamed Project');
    const activeRf = getActiveReforecast(retrieved!);
    expect(activeRf?.assignments).toHaveLength(1);
    expect(activeRf?.assignments[0].poolMemberId).toBe('pm1');
  });

  it('supports same pool member added multiple times', async () => {
    const project = makeProject({}, [
      { id: 'a1', poolMemberId: 'pm1' },
      { id: 'a2', poolMemberId: 'pm1' },
    ]);
    await repo.saveProject(project);

    const retrieved = await repo.getProject('test-project');
    const activeRf = getActiveReforecast(retrieved!);
    expect(activeRf?.assignments).toHaveLength(2);

    const members = resolveAssignments(activeRf!.assignments, pool);
    expect(members).toHaveLength(2);
    expect(members[0].name).toBe('Alice');
    expect(members[1].name).toBe('Alice');
    // But they have different ids (assignment ids)
    expect(members[0].id).toBe('a1');
    expect(members[1].id).toBe('a2');
  });
});

describe('Per-reforecast roster independence', () => {
  beforeEach(async () => {
    await repo.clear();
  });

  function projectWithTwoReforecasts(): Project {
    return {
      id: 'multi-rf',
      name: 'Multi RF Project',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      reforecasts: [
        makeBaselineReforecast({
          id: 'rf-old',
          name: 'Baseline',
          createdAt: '2025-01-01T00:00:00Z',
          reforecastDate: '2025-01-01',
          assignments: [
            { id: 'a1', poolMemberId: 'pm1' },
            { id: 'a2', poolMemberId: 'pm2' },
          ],
          allocations: [
            { memberId: 'a1', month: '2025-01', allocation: 0.5 },
            { memberId: 'a2', month: '2025-01', allocation: 0.75 },
          ],
        }),
        makeBaselineReforecast({
          id: 'rf-new',
          name: 'July Reforecast',
          createdAt: '2025-07-01T00:00:00Z',
          reforecastDate: '2025-07-01',
          assignments: [
            { id: 'a1', poolMemberId: 'pm1' },
            { id: 'a2', poolMemberId: 'pm2' },
          ],
          allocations: [
            { memberId: 'a1', month: '2025-07', allocation: 0.6 },
            { memberId: 'a2', month: '2025-07', allocation: 0.8 },
          ],
        }),
      ],
      activeReforecastId: 'rf-new',
    };
  }

  it('removes a member from the active reforecast only — sibling reforecast retains them', async () => {
    const team = teamHarness(projectWithTwoReforecasts());
    team.run((t) => t.removeAssignment('a2'));
    await repo.saveProject(team.box.current);

    const retrieved = (await repo.getProject('multi-rf'))!;
    const oldRf = retrieved.reforecasts.find((r) => r.id === 'rf-old')!;
    const newRf = retrieved.reforecasts.find((r) => r.id === 'rf-new')!;

    expect(oldRf.assignments).toHaveLength(2);
    expect(oldRf.allocations).toHaveLength(2);
    expect(newRf.assignments).toHaveLength(1);
    expect(newRf.assignments[0].id).toBe('a1');
    expect(newRf.allocations).toHaveLength(1);
    expect(newRf.allocations[0].memberId).toBe('a1');
  });

  it('switching activeReforecastId surfaces a different roster', async () => {
    const project = projectWithTwoReforecasts();
    // Diverge: remove pm2 from new rf only.
    const diverged: Project = {
      ...project,
      reforecasts: project.reforecasts.map((rf) =>
        rf.id !== 'rf-new'
          ? rf
          : { ...rf, assignments: rf.assignments.filter((a) => a.id !== 'a2') },
      ),
    };

    const newView = resolveAssignments(
      getActiveReforecast(diverged)?.assignments ?? [],
      pool,
    );
    expect(newView.map((m) => m.name)).toEqual(['Alice']);

    const oldView = resolveAssignments(
      getActiveReforecast({ ...diverged, activeReforecastId: 'rf-old' })?.assignments ?? [],
      pool,
    );
    expect(oldView.map((m) => m.name)).toEqual(['Alice', 'Bob']);
  });

  it('adding a member to the active reforecast does not affect siblings', () => {
    const project = projectWithTwoReforecasts();
    const updated: Project = {
      ...project,
      reforecasts: project.reforecasts.map((rf) =>
        rf.id !== project.activeReforecastId
          ? rf
          : {
              ...rf,
              assignments: [...rf.assignments, { id: 'a3', poolMemberId: 'pm3' }],
            },
      ),
    };
    expect(updated.reforecasts.find((r) => r.id === 'rf-old')!.assignments).toHaveLength(2);
    expect(updated.reforecasts.find((r) => r.id === 'rf-new')!.assignments).toHaveLength(3);
  });
});

describe('Archived pool members in saved reforecasts', () => {
  it('still resolves with full name and role across multiple reforecasts', () => {
    const archivedPool: PoolMember[] = [
      { id: 'pm-archived', name: 'Alice', role: 'BA', archived: true },
    ];
    const projectWithArchivedRefs: Project = {
      id: 'proj-1',
      name: 'Project',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      activeReforecastId: 'rf-1',
      reforecasts: [
        makeBaselineReforecast({
          id: 'rf-1',
          name: 'Baseline',
          assignments: [{ id: 'a-1', poolMemberId: 'pm-archived' }],
        }),
        makeBaselineReforecast({
          id: 'rf-2',
          name: 'July',
          assignments: [{ id: 'a-2', poolMemberId: 'pm-archived' }],
        }),
      ],
    };

    const rf1 = projectWithArchivedRefs.reforecasts[0];
    const rf2 = projectWithArchivedRefs.reforecasts[1];

    const view1 = resolveAssignments(rf1.assignments, archivedPool);
    const view2 = resolveAssignments(rf2.assignments, archivedPool);

    expect(view1).toEqual([{ id: 'a-1', name: 'Alice', role: 'BA' }]);
    expect(view2).toEqual([{ id: 'a-2', name: 'Alice', role: 'BA' }]);
    // archived must NOT be present on the resolved TeamMember
    expect('archived' in view1[0]).toBe(false);
    expect('archived' in view2[0]).toBe(false);
  });
});

describe('resolveAssignments edge cases', () => {
  it('returns (Unknown) with empty role for missing pool member', () => {
    const assignments = [{ id: 'a1', poolMemberId: 'nonexistent' }];
    const members = resolveAssignments(assignments, pool);
    expect(members).toHaveLength(1);
    expect(members[0].name).toBe('(Unknown)');
    expect(members[0].role).toBe('');
    expect(members[0].id).toBe('a1');
  });

  it('logs a warning for missing pool members', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const assignments = [{ id: 'a1', poolMemberId: 'nonexistent' }];
    resolveAssignments(assignments, pool);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Pool member not found'),
    );
    warnSpy.mockRestore();
  });

  it('does not warn for valid pool members', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const assignments = [{ id: 'a1', poolMemberId: 'pm1' }];
    resolveAssignments(assignments, pool);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('handles empty assignments array', () => {
    const members = resolveAssignments([], pool);
    expect(members).toEqual([]);
  });

  it('handles empty pool', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const assignments = [{ id: 'a1', poolMemberId: 'pm1' }];
    const members = resolveAssignments(assignments, []);
    expect(members).toHaveLength(1);
    expect(members[0].name).toBe('(Unknown)');
    warnSpy.mockRestore();
  });
});

/**
 * Characterisation of the remaining useTeam surface, driven through the real
 * hook. The file's only previous useTeam test simulated the hook's reducer, so
 * every operation below was at zero — addAssignment, reorderAssignments and
 * sortAssignments had never executed once.
 *
 * Expected values are literals or built independently of the hook's own
 * expression shape: an expectation computed the way the reducer computes it
 * would pass against any reducer, including a broken one.
 */
describe('useTeam — the real hook', () => {
  /** Two reforecasts, both holding a1+a2; 'rf-new' is active. */
  function twoRfProject(): Project {
    return {
      id: 'multi-rf',
      name: 'Multi RF Project',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      reforecasts: [
        makeBaselineReforecast({
          id: 'rf-old',
          assignments: [
            { id: 'a1', poolMemberId: 'pm1' },
            { id: 'a2', poolMemberId: 'pm2' },
          ],
        }),
        makeBaselineReforecast({
          id: 'rf-new',
          assignments: [
            { id: 'a1', poolMemberId: 'pm1' },
            { id: 'a2', poolMemberId: 'pm2' },
          ],
        }),
      ],
      activeReforecastId: 'rf-new',
    };
  }

  it('members resolves the ACTIVE reforecast roster against the pool', () => {
    const team = teamHarness(makeProject({}, [{ id: 'a1', poolMemberId: 'pm2' }]));
    expect(team.view.result.current.members).toEqual([
      { id: 'a1', name: 'Bob', role: 'IT-SoftEng' },
    ]);
  });

  it('members and assignments are empty for a null project', () => {
    const view = renderHook(() =>
      useTeam({ project: null, updateProject: () => {}, pool }),
    );
    expect(view.result.current.members).toEqual([]);
    expect(view.result.current.assignments).toEqual([]);
  });

  it('addAssignment appends to the active reforecast only, and returns the new id', () => {
    const team = teamHarness(twoRfProject());
    let returned = '';
    act(() => {
      returned = team.view.result.current.addAssignment('pm3');
    });
    team.view.rerender({ p: team.box.current });

    const active = team.box.current.reforecasts.find((r) => r.id === 'rf-new')!;
    const sibling = team.box.current.reforecasts.find((r) => r.id === 'rf-old')!;
    expect(active.assignments).toHaveLength(3);
    expect(active.assignments[2].poolMemberId).toBe('pm3');
    // The id the caller gets back is the id actually stored — the grid keys
    // allocations on it, so a mismatch would silently orphan every new row.
    expect(returned).toBe(active.assignments[2].id);
    expect(returned).not.toBe('');
    expect(sibling.assignments).toHaveLength(2);
  });

  it('removeAssignment cascades to allocations in the active reforecast only', () => {
    const team = teamHarness({
      ...twoRfProject(),
      reforecasts: twoRfProject().reforecasts.map((rf) => ({
        ...rf,
        allocations: [
          { memberId: 'a1', month: '2025-01', allocation: 0.5 },
          { memberId: 'a2', month: '2025-01', allocation: 0.75 },
        ],
      })),
    });
    team.run((t) => t.removeAssignment('a2'));

    const active = team.box.current.reforecasts.find((r) => r.id === 'rf-new')!;
    const sibling = team.box.current.reforecasts.find((r) => r.id === 'rf-old')!;
    expect(active.assignments.map((a) => a.id)).toEqual(['a1']);
    expect(active.allocations.map((a) => a.memberId)).toEqual(['a1']);
    expect(sibling.assignments.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(sibling.allocations.map((a) => a.memberId)).toEqual(['a1', 'a2']);
  });

  it('reorderAssignments applies the given order and drops unknown ids', () => {
    const team = teamHarness(twoRfProject());
    team.run((t) => t.reorderAssignments(['a2', 'ghost', 'a1']));
    const active = team.box.current.reforecasts.find((r) => r.id === 'rf-new')!;
    expect(active.assignments.map((a) => a.id)).toEqual(['a2', 'a1']);
  });

  it('sortAssignments distinguishes name from role-name ordering', () => {
    // Deliberately a pool where the two modes DISAGREE. With the default pool
    // (Alice/BA, Bob/IT-SoftEng, Charlie/PMO) both orders are identical, so the
    // test would pass with the mode argument ignored entirely.
    const skewed: PoolMember[] = [
      { id: 'pm1', name: 'Zoe', role: 'BA' },
      { id: 'pm2', name: 'Alice', role: 'PMO' },
    ];
    const byName = teamHarness(twoRfProject(), skewed);
    byName.run((t) => t.sortAssignments('name'));
    expect(
      byName.box.current.reforecasts.find((r) => r.id === 'rf-new')!.assignments.map((a) => a.id),
    ).toEqual(['a2', 'a1']); // Alice, Zoe

    const byRole = teamHarness(twoRfProject(), skewed);
    byRole.run((t) => t.sortAssignments('role-name'));
    expect(
      byRole.box.current.reforecasts.find((r) => r.id === 'rf-new')!.assignments.map((a) => a.id),
    ).toEqual(['a1', 'a2']); // BA before PMO
  });
});
