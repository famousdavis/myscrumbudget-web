import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import type { Project, ProjectAssignment, PoolMember } from '@/types/domain';
import { resolveAssignments } from '@/lib/utils/teamResolution';

const repo = createLocalStorageRepository();

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'test-project',
    name: 'Test Project',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    assignments: [],
    reforecasts: [
      {
        id: 'rf-baseline',
        name: 'Baseline',
        createdAt: '2025-01-01T00:00:00Z',
        startDate: '2025-01',
        reforecastDate: '2025-01-01',
        allocations: [],
        productivityWindows: [],
        actualCost: 0,
        baselineBudget: 500000,
      },
    ],
    activeReforecastId: 'rf-baseline',
    ...overrides,
  };
}

const pool: PoolMember[] = [
  { id: 'pm1', name: 'Alice', role: 'BA' },
  { id: 'pm2', name: 'Bob', role: 'IT-SoftEng' },
  { id: 'pm3', name: 'Charlie', role: 'PMO' },
];

describe('Team Assignment CRUD', () => {
  beforeEach(async () => {
    await repo.clear();
  });

  it('adds an assignment to a project', async () => {
    const project = makeProject({
      assignments: [{ id: 'a1', poolMemberId: 'pm1' }],
    });
    await repo.saveProject(project);

    const retrieved = await repo.getProject('test-project');
    expect(retrieved?.assignments).toHaveLength(1);
    expect(retrieved?.assignments[0].poolMemberId).toBe('pm1');

    const members = resolveAssignments(retrieved!.assignments, pool);
    expect(members[0].name).toBe('Alice');
    expect(members[0].role).toBe('BA');
  });

  it('adds multiple assignments', async () => {
    const project = makeProject({
      assignments: [
        { id: 'a1', poolMemberId: 'pm1' },
        { id: 'a2', poolMemberId: 'pm2' },
        { id: 'a3', poolMemberId: 'pm3' },
      ],
    });
    await repo.saveProject(project);

    const retrieved = await repo.getProject('test-project');
    expect(retrieved?.assignments).toHaveLength(3);

    const members = resolveAssignments(retrieved!.assignments, pool);
    expect(members).toHaveLength(3);
  });

  it('removes an assignment', async () => {
    const project = makeProject({
      assignments: [
        { id: 'a1', poolMemberId: 'pm1' },
        { id: 'a2', poolMemberId: 'pm2' },
      ],
    });
    await repo.saveProject(project);

    project.assignments = project.assignments.filter((a) => a.id !== 'a1');
    await repo.saveProject(project);

    const retrieved = await repo.getProject('test-project');
    expect(retrieved?.assignments).toHaveLength(1);
    expect(retrieved?.assignments[0].id).toBe('a2');
  });

  it('preserves assignments across project updates', async () => {
    const project = makeProject({
      assignments: [{ id: 'a1', poolMemberId: 'pm1' }],
    });
    await repo.saveProject(project);

    project.name = 'Renamed Project';
    await repo.saveProject(project);

    const retrieved = await repo.getProject('test-project');
    expect(retrieved?.name).toBe('Renamed Project');
    expect(retrieved?.assignments).toHaveLength(1);
    expect(retrieved?.assignments[0].poolMemberId).toBe('pm1');
  });

  it('supports same pool member added multiple times', async () => {
    const project = makeProject({
      assignments: [
        { id: 'a1', poolMemberId: 'pm1' },
        { id: 'a2', poolMemberId: 'pm1' },
      ],
    });
    await repo.saveProject(project);

    const retrieved = await repo.getProject('test-project');
    expect(retrieved?.assignments).toHaveLength(2);

    const members = resolveAssignments(retrieved!.assignments, pool);
    expect(members).toHaveLength(2);
    expect(members[0].name).toBe('Alice');
    expect(members[1].name).toBe('Alice');
    // But they have different ids (assignment ids)
    expect(members[0].id).toBe('a1');
    expect(members[1].id).toBe('a2');
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
