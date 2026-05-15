// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import type { Project, PoolMember, ProjectAssignment, Reforecast } from '@/types/domain';
import { resolveAssignments, getActiveReforecast } from '@/lib/utils/teamResolution';

const repo = createLocalStorageRepository();

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
    const project = projectWithTwoReforecasts();
    // Simulate useTeam.removeAssignment scoped to the active rf
    const updated: Project = {
      ...project,
      reforecasts: project.reforecasts.map((rf) =>
        rf.id !== project.activeReforecastId
          ? rf
          : {
              ...rf,
              assignments: rf.assignments.filter((a) => a.id !== 'a2'),
              allocations: rf.allocations.filter((a) => a.memberId !== 'a2'),
            },
      ),
    };
    await repo.saveProject(updated);

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
