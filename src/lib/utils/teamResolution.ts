import type { ProjectAssignment, PoolMember, TeamMember } from '@/types/domain';

/**
 * Resolve project assignments against the team pool to produce
 * a TeamMember[] suitable for the calculation engine and UI.
 *
 * Uses assignment.id as the resolved TeamMember.id so that
 * MonthlyAllocation.memberId references continue to match.
 */
export function resolveAssignments(
  assignments: ProjectAssignment[],
  pool: PoolMember[],
): TeamMember[] {
  const poolMap = new Map(pool.map((pm) => [pm.id, pm]));

  return (assignments ?? []).map((assignment) => {
    const pm = poolMap.get(assignment.poolMemberId);
    if (!pm) {
      return {
        id: assignment.id,
        name: '(Unknown)',
        role: '',
      };
    }
    return {
      id: assignment.id,
      name: pm.name,
      role: pm.role,
    };
  });
}
