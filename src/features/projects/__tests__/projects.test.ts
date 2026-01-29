import { describe, it, expect, beforeEach } from 'vitest';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import type { Project } from '@/types/domain';

const repo = createLocalStorageRepository();

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'test-project-1',
    name: 'Test Project',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    baselineBudget: 500000,
    actualCost: 100000,
    assignments: [],
    reforecasts: [],
    activeReforecastId: null,
    ...overrides,
  };
}

describe('Project CRUD', () => {
  beforeEach(async () => {
    await repo.clear();
  });

  it('returns empty array when no projects exist', async () => {
    const projects = await repo.getProjects();
    expect(projects).toEqual([]);
  });

  it('creates and retrieves a project', async () => {
    const project = makeProject();
    await repo.saveProject(project);

    const retrieved = await repo.getProject('test-project-1');
    expect(retrieved).toEqual(project);
  });

  it('lists all projects', async () => {
    await repo.saveProject(makeProject({ id: 'p1', name: 'Project 1' }));
    await repo.saveProject(makeProject({ id: 'p2', name: 'Project 2' }));

    const projects = await repo.getProjects();
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.name)).toEqual(['Project 1', 'Project 2']);
  });

  it('updates an existing project', async () => {
    const project = makeProject();
    await repo.saveProject(project);

    const updated = { ...project, name: 'Updated Name', actualCost: 200000 };
    await repo.saveProject(updated);

    const retrieved = await repo.getProject('test-project-1');
    expect(retrieved?.name).toBe('Updated Name');
    expect(retrieved?.actualCost).toBe(200000);
  });

  it('deletes a project', async () => {
    await repo.saveProject(makeProject({ id: 'p1' }));
    await repo.saveProject(makeProject({ id: 'p2' }));

    await repo.deleteProject('p1');

    const projects = await repo.getProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe('p2');
  });

  it('returns null for non-existent project', async () => {
    const project = await repo.getProject('does-not-exist');
    expect(project).toBeNull();
  });

  it('preserves project fields through save/load cycle', async () => {
    const project = makeProject({
      assignments: [
        { id: 'a1', poolMemberId: 'pm1' },
      ],
      reforecasts: [
        {
          id: 'rf1',
          name: 'Reforecast 1',
          createdAt: '2025-06-01',
          startDate: '2025-07-01',
          allocations: [],
          productivityWindows: [],
        },
      ],
      activeReforecastId: 'rf1',
    });
    await repo.saveProject(project);

    const retrieved = await repo.getProject(project.id);
    expect(retrieved?.assignments).toHaveLength(1);
    expect(retrieved?.assignments[0].poolMemberId).toBe('pm1');
    expect(retrieved?.reforecasts).toHaveLength(1);
    expect(retrieved?.activeReforecastId).toBe('rf1');
  });
});
