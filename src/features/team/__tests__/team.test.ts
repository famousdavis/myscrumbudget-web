import { describe, it, expect, beforeEach } from 'vitest';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import type { Project, TeamMember } from '@/types/domain';

const repo = createLocalStorageRepository();

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'test-project',
    name: 'Test Project',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    baselineBudget: 500000,
    actualCost: 0,
    teamMembers: [],
    reforecasts: [],
    activeReforecastId: null,
    ...overrides,
  };
}

describe('Team Member CRUD', () => {
  beforeEach(async () => {
    await repo.clear();
  });

  it('adds a team member to a project', async () => {
    const project = makeProject();
    const member: TeamMember = {
      id: 'tm1',
      name: 'Alice',
      role: 'BA',
      type: 'Core',
    };
    project.teamMembers.push(member);
    await repo.saveProject(project);

    const retrieved = await repo.getProject('test-project');
    expect(retrieved?.teamMembers).toHaveLength(1);
    expect(retrieved?.teamMembers[0].name).toBe('Alice');
    expect(retrieved?.teamMembers[0].role).toBe('BA');
    expect(retrieved?.teamMembers[0].type).toBe('Core');
  });

  it('adds multiple team members', async () => {
    const project = makeProject({
      teamMembers: [
        { id: 'tm1', name: 'Alice', role: 'BA', type: 'Core' },
        { id: 'tm2', name: 'Bob', role: 'IT-SoftEng', type: 'Core' },
        { id: 'tm3', name: 'Charlie', role: 'PMO', type: 'Extended' },
      ],
    });
    await repo.saveProject(project);

    const retrieved = await repo.getProject('test-project');
    expect(retrieved?.teamMembers).toHaveLength(3);
  });

  it('updates a team member', async () => {
    const project = makeProject({
      teamMembers: [
        { id: 'tm1', name: 'Alice', role: 'BA', type: 'Core' },
      ],
    });
    await repo.saveProject(project);

    project.teamMembers[0] = {
      ...project.teamMembers[0],
      role: 'PMO',
      type: 'Extended',
    };
    await repo.saveProject(project);

    const retrieved = await repo.getProject('test-project');
    expect(retrieved?.teamMembers[0].role).toBe('PMO');
    expect(retrieved?.teamMembers[0].type).toBe('Extended');
  });

  it('deletes a team member', async () => {
    const project = makeProject({
      teamMembers: [
        { id: 'tm1', name: 'Alice', role: 'BA', type: 'Core' },
        { id: 'tm2', name: 'Bob', role: 'IT-SoftEng', type: 'Core' },
      ],
    });
    await repo.saveProject(project);

    project.teamMembers = project.teamMembers.filter((m) => m.id !== 'tm1');
    await repo.saveProject(project);

    const retrieved = await repo.getProject('test-project');
    expect(retrieved?.teamMembers).toHaveLength(1);
    expect(retrieved?.teamMembers[0].id).toBe('tm2');
  });

  it('preserves team members across project updates', async () => {
    const project = makeProject({
      teamMembers: [
        { id: 'tm1', name: 'Alice', role: 'BA', type: 'Core' },
      ],
    });
    await repo.saveProject(project);

    // Update project name, team should be preserved
    project.name = 'Renamed Project';
    await repo.saveProject(project);

    const retrieved = await repo.getProject('test-project');
    expect(retrieved?.name).toBe('Renamed Project');
    expect(retrieved?.teamMembers).toHaveLength(1);
    expect(retrieved?.teamMembers[0].name).toBe('Alice');
  });
});
