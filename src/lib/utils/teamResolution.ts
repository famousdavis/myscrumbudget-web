import type { Project, ProjectAssignment, PoolMember, Reforecast, TeamMember } from '@/types/domain';

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
      console.warn(
        `[resolveAssignments] Pool member not found for assignment "${assignment.id}" (poolMemberId: "${assignment.poolMemberId}"). Rendering as "(Unknown)".`,
      );
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

/**
 * Resolve a project's active reforecast.
 * Falls back to the first reforecast if activeReforecastId is unset.
 */
export function getActiveReforecast(project: Project): Reforecast | undefined {
  return project.activeReforecastId
    ? project.reforecasts.find((r) => r.id === project.activeReforecastId)
    : project.reforecasts[0];
}

/**
 * Get the most recent reforecast by reforecastDate.
 * Used by the dashboard to show metrics from the newest forecast.
 * Tie-breaker: createdAt descending (most recently created wins).
 */
export function getMostRecentReforecast(project: Project): Reforecast | undefined {
  if (project.reforecasts.length === 0) return undefined;
  if (project.reforecasts.length === 1) return project.reforecasts[0];

  return [...project.reforecasts].sort((a, b) => {
    const dateCmp = b.reforecastDate.localeCompare(a.reforecastDate);
    if (dateCmp !== 0) return dateCmp;
    return b.createdAt.localeCompare(a.createdAt);
  })[0];
}
