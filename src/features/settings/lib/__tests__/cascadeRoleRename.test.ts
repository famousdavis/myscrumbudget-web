// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import type { PoolMember } from '@/types/domain';
import { cascadeRoleRename } from '../cascadeRoleRename';

const POOL: PoolMember[] = [
  { id: 'pm1', name: 'Alice', role: 'BA' },
  { id: 'pm2', name: 'Bob', role: 'BA' },
  { id: 'pm3', name: 'Cara', role: 'BA', archived: true },
  { id: 'pm4', name: 'Dan', role: 'IT-Security' },
  { id: 'pm5', name: 'Eve', role: 'ba' },
];

describe('cascadeRoleRename', () => {
  it('moves every holder of the old role, archived included', () => {
    const { pool, renamed, archivedRenamed } = cascadeRoleRename(POOL, 'BA', 'Business Analyst');
    expect(pool.filter((m) => m.role === 'Business Analyst').map((m) => m.id))
      .toEqual(['pm1', 'pm2', 'pm3']);
    expect(renamed).toBe(3);
    expect(archivedRenamed).toBe(1);
  });

  it('N is the TOTAL renamed and archivedRenamed is a SECOND number, never a substitute', () => {
    // ⚠️ These are two different figures and an earlier plan revision conflated them.
    // A caller that showed `archivedRenamed` as N would tell the user 1 when 3 members
    // moved.
    const { renamed, archivedRenamed } = cascadeRoleRename(POOL, 'BA', 'X');
    expect(renamed).toBe(3);
    expect(archivedRenamed).toBe(1);
    expect(renamed).not.toBe(archivedRenamed);
  });

  it('matches EXACTLY — a "ba" holder is left alone when "BA" is renamed', () => {
    // ⚠️ The load-bearing case. `findCollidingRole` is deliberately case-INSENSITIVE,
    // and borrowing that here would silently re-home Eve onto a rate she was never
    // given — her cost would change without anyone touching her.
    const { pool, renamed } = cascadeRoleRename(POOL, 'BA', 'Business Analyst');
    expect(pool.find((m) => m.id === 'pm5')!.role).toBe('ba');
    expect(renamed).toBe(3);
  });

  it('a CASE-ONLY rename still cascades', () => {
    // Every rate lookup is exact, so "BA" -> "ba" orphans holders exactly as a full
    // rename would. Nothing here may short-circuit on case-insensitive equality.
    const { pool, renamed } = cascadeRoleRename(POOL, 'BA', 'ba');
    expect(renamed).toBe(3);
    expect(pool.filter((m) => m.role === 'ba')).toHaveLength(4); // 3 moved + Eve already
  });

  it('preserves every other field, and the archived flag survives the move', () => {
    const { pool } = cascadeRoleRename(POOL, 'BA', 'Business Analyst');
    expect(pool.find((m) => m.id === 'pm3')).toEqual({
      id: 'pm3', name: 'Cara', role: 'Business Analyst', archived: true,
    });
  });

  it('renames nothing when no member holds the role, and reports zero', () => {
    const { pool, renamed, archivedRenamed } = cascadeRoleRename(POOL, 'Nobody', 'X');
    expect(pool).toEqual(POOL);
    expect(renamed).toBe(0);
    expect(archivedRenamed).toBe(0);
  });

  it('does not mutate the input array or its members', () => {
    const before = JSON.parse(JSON.stringify(POOL));
    cascadeRoleRename(POOL, 'BA', 'Business Analyst');
    expect(POOL).toEqual(before);
  });

  it('leaves untouched members REFERENTIALLY identical', () => {
    // Not cosmetic: the pool is persisted whole, and needlessly rebuilt objects make a
    // diff of what actually changed impossible to read.
    const { pool } = cascadeRoleRename(POOL, 'BA', 'Business Analyst');
    expect(pool[3]).toBe(POOL[3]);
    expect(pool[0]).not.toBe(POOL[0]);
  });

  it('an empty pool is a no-op, not a throw', () => {
    expect(cascadeRoleRename([], 'BA', 'X')).toEqual({ pool: [], renamed: 0, archivedRenamed: 0 });
  });
});
