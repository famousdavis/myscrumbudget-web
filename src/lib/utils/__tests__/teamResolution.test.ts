import { describe, it, expect } from 'vitest';
import { resolveAssignments, getActiveReforecast, getMostRecentReforecast } from '../teamResolution';
import type { ProjectAssignment, PoolMember, Project, Reforecast } from '@/types/domain';

const pool: PoolMember[] = [
  { id: 'pm-1', name: 'Alice', role: 'BA' },
  { id: 'pm-2', name: 'Bob', role: 'IT-SoftEng' },
];

describe('resolveAssignments', () => {
  it('resolves assignments to TeamMember[] using assignment.id', () => {
    const assignments: ProjectAssignment[] = [
      { id: 'a-1', poolMemberId: 'pm-1' },
      { id: 'a-2', poolMemberId: 'pm-2' },
    ];
    const result = resolveAssignments(assignments, pool);
    expect(result).toEqual([
      { id: 'a-1', name: 'Alice', role: 'BA' },
      { id: 'a-2', name: 'Bob', role: 'IT-SoftEng' },
    ]);
  });

  it('allows same pool member multiple times with different assignment ids', () => {
    const assignments: ProjectAssignment[] = [
      { id: 'a-1', poolMemberId: 'pm-2' },
      { id: 'a-2', poolMemberId: 'pm-2' },
    ];
    const result = resolveAssignments(assignments, pool);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a-1');
    expect(result[1].id).toBe('a-2');
    expect(result[0].name).toBe('Bob');
    expect(result[1].name).toBe('Bob');
  });

  it('returns fallback for missing pool member', () => {
    const assignments: ProjectAssignment[] = [
      { id: 'a-1', poolMemberId: 'pm-deleted' },
    ];
    const result = resolveAssignments(assignments, pool);
    expect(result).toEqual([
      { id: 'a-1', name: '(Unknown)', role: '' },
    ]);
  });

  it('returns empty array for no assignments', () => {
    expect(resolveAssignments([], pool)).toEqual([]);
  });

  it('returns empty array for no pool (all unknown)', () => {
    const assignments: ProjectAssignment[] = [
      { id: 'a-1', poolMemberId: 'pm-1' },
    ];
    const result = resolveAssignments(assignments, []);
    expect(result[0].name).toBe('(Unknown)');
  });
});

function makeReforecast(overrides: Partial<Reforecast> = {}): Reforecast {
  return {
    id: 'rf-1',
    name: 'Baseline',
    createdAt: '2026-06-01T00:00:00Z',
    startDate: '2026-06',
    reforecastDate: '2026-06-01',
    allocations: [],
    productivityWindows: [],
    actualCost: 0,
    baselineBudget: 0,
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p-1',
    name: 'Test Project',
    startDate: '2026-06-15',
    endDate: '2027-07-15',
    assignments: [],
    reforecasts: [],
    activeReforecastId: null,
    ...overrides,
  };
}

describe('getActiveReforecast', () => {
  it('returns reforecast matching activeReforecastId', () => {
    const rf1 = makeReforecast({ id: 'rf-1' });
    const rf2 = makeReforecast({ id: 'rf-2', name: 'Q3' });
    const project = makeProject({
      reforecasts: [rf1, rf2],
      activeReforecastId: 'rf-2',
    });
    expect(getActiveReforecast(project)?.id).toBe('rf-2');
  });

  it('falls back to first reforecast when activeReforecastId is null', () => {
    const rf1 = makeReforecast({ id: 'rf-1' });
    const rf2 = makeReforecast({ id: 'rf-2', name: 'Q3' });
    const project = makeProject({
      reforecasts: [rf1, rf2],
      activeReforecastId: null,
    });
    expect(getActiveReforecast(project)?.id).toBe('rf-1');
  });

  it('returns undefined when activeReforecastId does not match any reforecast', () => {
    const rf = makeReforecast({ id: 'rf-1' });
    const project = makeProject({
      reforecasts: [rf],
      activeReforecastId: 'nonexistent',
    });
    expect(getActiveReforecast(project)).toBeUndefined();
  });

  it('returns undefined for project with no reforecasts', () => {
    const project = makeProject({ reforecasts: [] });
    expect(getActiveReforecast(project)).toBeUndefined();
  });
});

describe('getMostRecentReforecast', () => {
  it('returns undefined for project with no reforecasts', () => {
    const project = makeProject({ reforecasts: [] });
    expect(getMostRecentReforecast(project)).toBeUndefined();
  });

  it('returns the only reforecast when there is one', () => {
    const rf = makeReforecast({ id: 'rf-only' });
    const project = makeProject({ reforecasts: [rf] });
    expect(getMostRecentReforecast(project)).toEqual(rf);
  });

  it('returns the reforecast with the latest reforecastDate', () => {
    const rf1 = makeReforecast({
      id: 'rf-1',
      name: 'Baseline',
      reforecastDate: '2026-06-01',
      createdAt: '2026-06-01T00:00:00Z',
    });
    const rf2 = makeReforecast({
      id: 'rf-2',
      name: 'Q3',
      reforecastDate: '2026-09-15',
      createdAt: '2026-09-15T00:00:00Z',
    });
    const rf3 = makeReforecast({
      id: 'rf-3',
      name: 'Q4',
      reforecastDate: '2026-12-01',
      createdAt: '2026-12-01T00:00:00Z',
    });
    const project = makeProject({ reforecasts: [rf1, rf3, rf2] });
    expect(getMostRecentReforecast(project)?.id).toBe('rf-3');
  });

  it('breaks ties by createdAt descending', () => {
    const rf1 = makeReforecast({
      id: 'rf-1',
      name: 'First',
      reforecastDate: '2026-09-15',
      createdAt: '2026-09-15T08:00:00Z',
    });
    const rf2 = makeReforecast({
      id: 'rf-2',
      name: 'Second',
      reforecastDate: '2026-09-15',
      createdAt: '2026-09-15T14:00:00Z',
    });
    const project = makeProject({ reforecasts: [rf1, rf2] });
    // Same reforecastDate, rf2 has later createdAt
    expect(getMostRecentReforecast(project)?.id).toBe('rf-2');
  });

  it('does not mutate the original reforecasts array', () => {
    const rf1 = makeReforecast({
      id: 'rf-1',
      reforecastDate: '2026-06-01',
    });
    const rf2 = makeReforecast({
      id: 'rf-2',
      reforecastDate: '2026-12-01',
    });
    const reforecasts = [rf1, rf2];
    const project = makeProject({ reforecasts });

    getMostRecentReforecast(project);

    // Original array should be unchanged
    expect(project.reforecasts[0].id).toBe('rf-1');
    expect(project.reforecasts[1].id).toBe('rf-2');
  });
});
