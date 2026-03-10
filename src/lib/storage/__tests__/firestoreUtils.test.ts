// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { buildTeamSnapshot, stripUndefined, docToProject } from '../firestoreUtils';
import type { ProjectAssignment, PoolMember } from '@/types/domain';

describe('buildTeamSnapshot', () => {
  const pool: PoolMember[] = [
    { id: 'pm-1', name: 'Alice', role: 'BA' },
    { id: 'pm-2', name: 'Bob', role: 'IT-SoftEng' },
    { id: 'pm-3', name: 'Carol', role: 'Manager' },
  ];

  it('maps assigned pool members to name/role snapshot', () => {
    const assignments: ProjectAssignment[] = [
      { id: 'a-1', poolMemberId: 'pm-1' },
      { id: 'a-2', poolMemberId: 'pm-2' },
    ];
    expect(buildTeamSnapshot(assignments, pool)).toEqual({
      'pm-1': { name: 'Alice', role: 'BA' },
      'pm-2': { name: 'Bob', role: 'IT-SoftEng' },
    });
  });

  it('skips assignments with missing pool members', () => {
    const assignments: ProjectAssignment[] = [
      { id: 'a-1', poolMemberId: 'pm-1' },
      { id: 'a-2', poolMemberId: 'pm-deleted' },
    ];
    expect(buildTeamSnapshot(assignments, pool)).toEqual({
      'pm-1': { name: 'Alice', role: 'BA' },
    });
  });

  it('deduplicates when same pool member appears twice', () => {
    const assignments: ProjectAssignment[] = [
      { id: 'a-1', poolMemberId: 'pm-1' },
      { id: 'a-2', poolMemberId: 'pm-1' },
    ];
    const snapshot = buildTeamSnapshot(assignments, pool);
    expect(Object.keys(snapshot)).toHaveLength(1);
    expect(snapshot['pm-1']).toEqual({ name: 'Alice', role: 'BA' });
  });

  it('returns empty object for no assignments', () => {
    expect(buildTeamSnapshot([], pool)).toEqual({});
  });

  it('returns empty object for empty pool', () => {
    const assignments: ProjectAssignment[] = [
      { id: 'a-1', poolMemberId: 'pm-1' },
    ];
    expect(buildTeamSnapshot(assignments, [])).toEqual({});
  });
});

describe('stripUndefined', () => {
  it('removes undefined values', () => {
    const obj = { a: 1, b: undefined, c: 'hello' };
    expect(stripUndefined(obj)).toEqual({ a: 1, c: 'hello' });
  });

  it('preserves null values (Firestore accepts null)', () => {
    const obj = { a: null, b: 'test' };
    expect(stripUndefined(obj)).toEqual({ a: null, b: 'test' });
  });

  it('preserves false and 0', () => {
    const obj = { a: false, b: 0, c: '' };
    expect(stripUndefined(obj)).toEqual({ a: false, b: 0, c: '' });
  });

  it('returns empty object when all values are undefined', () => {
    const obj = { a: undefined, b: undefined };
    expect(stripUndefined(obj)).toEqual({});
  });

  it('returns same object when no undefined values', () => {
    const obj = { a: 1, b: 'test' };
    expect(stripUndefined(obj)).toEqual({ a: 1, b: 'test' });
  });
});

describe('docToProject', () => {
  it('converts Firestore doc data to Project', () => {
    const data = {
      name: 'Test Project',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      assignments: [{ id: 'a-1', poolMemberId: 'pm-1' }],
      reforecasts: [{ id: 'rf-1', name: 'Baseline' }],
      activeReforecastId: 'rf-1',
      // Cloud-only fields should be ignored
      owner: 'uid-123',
      members: { 'uid-123': 'owner' },
      order: 0,
    };
    const project = docToProject('proj-1', data);
    expect(project).toEqual({
      id: 'proj-1',
      name: 'Test Project',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      assignments: [{ id: 'a-1', poolMemberId: 'pm-1' }],
      reforecasts: [{ id: 'rf-1', name: 'Baseline' }],
      activeReforecastId: 'rf-1',
    });
  });

  it('provides defaults for missing fields', () => {
    const project = docToProject('proj-1', {});
    expect(project).toEqual({
      id: 'proj-1',
      name: '',
      startDate: '',
      endDate: '',
      assignments: [],
      reforecasts: [],
      activeReforecastId: null,
    });
  });

  it('uses provided id, not data.id', () => {
    const project = docToProject('my-id', { id: 'wrong-id', name: 'Test' });
    expect(project.id).toBe('my-id');
  });
});
