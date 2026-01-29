import { describe, it, expect } from 'vitest';
import { resolveAssignments } from '../teamResolution';
import type { ProjectAssignment, PoolMember } from '@/types/domain';

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
