import { describe, it, expect, beforeEach } from 'vitest';
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
    baselineBudget: 500000,
    actualCost: 0,
    assignments: [],
    reforecasts: [],
    activeReforecastId: null,
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
