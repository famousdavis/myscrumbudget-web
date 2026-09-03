// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { PoolMember } from '@/types/domain';

export interface RoleRenameCascade {
  /** The pool with every holder of `from` moved to `to`. */
  pool: PoolMember[];
  /** TOTAL members renamed — archived included. This is the N users are told. */
  renamed: number;
  /** How many of `renamed` were archived. A SECOND number, never a substitute for N. */
  archivedRenamed: number;
}

/**
 * Move every pool member holding role `from` onto role `to`.
 *
 * ⚠️ RETURNING THE COUNTS ALONGSIDE THE POOL IS THE POINT OF THIS SIGNATURE, not a
 * convenience. The number a user is shown and the rows actually changed are now ONE
 * computation, so "the message and the write must use the same predicate" stops being
 * an instruction someone has to remember and becomes something the type enforces.
 *
 * ⚠️ MATCHING IS EXACT (`===`), and the wrong choice sits nearby: `findCollidingRole`
 * in `RateTable.tsx` is deliberately case-INSENSITIVE, because "BA" and "ba" are one
 * role to a human and permitting both is the defect it exists to close. That is a rule
 * about what may be TYPED. This is a rule about what is STORED, and every rate lookup
 * in the app is exact (`calc/costs.ts`, `excelImport.ts`, `importDiff.ts`). Matching
 * case-insensitively here would silently re-home a `"ba"` holder onto a real rate
 * during an unrelated rename of `"BA"` — a member's cost would change without anyone
 * touching them.
 *
 * ⚠️ ARCHIVED MEMBERS CASCADE, and skipping them would be a data defect rather than a
 * tidy-up. `resolveAssignments` applies no `archived` filter, so an archived member
 * still resolves inside a saved reforecast and is still costed. Leaving them behind
 * orphans historical scenarios while the active roster looks correct.
 *
 * ⚠️ A CASE-ONLY RENAME MUST CASCADE. `RateTable` permits re-casing a row in place, and
 * because every lookup is exact that orphans every holder today. An implementation that
 * short-circuits on `from.toLowerCase() === to.toLowerCase()` — the natural instinct
 * once collision-checking is case-insensitive — leaves that defect standing. The only
 * short-circuit that is correct is exact equality, and the caller applies it.
 */
export function cascadeRoleRename(
  pool: PoolMember[],
  from: string,
  to: string,
): RoleRenameCascade {
  let renamed = 0;
  let archivedRenamed = 0;

  const next = pool.map((member) => {
    if (member.role !== from) return member;
    renamed += 1;
    if (member.archived === true) archivedRenamed += 1;
    return { ...member, role: to };
  });

  return { pool: next, renamed, archivedRenamed };
}
