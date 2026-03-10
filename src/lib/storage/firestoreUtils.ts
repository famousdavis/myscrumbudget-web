import type { Project, ProjectAssignment, PoolMember } from '@/types/domain';

/**
 * Build a team snapshot mapping poolMemberIds to their name/role.
 * Embedded in Firestore project docs so shared viewers can see team info.
 */
export function buildTeamSnapshot(
  assignments: ProjectAssignment[],
  pool: PoolMember[],
): Record<string, { name: string; role: string }> {
  const snapshot: Record<string, { name: string; role: string }> = {};
  const poolMap = new Map(pool.map((m) => [m.id, m]));
  assignments.forEach((a) => {
    const pm = poolMap.get(a.poolMemberId);
    if (pm) snapshot[a.poolMemberId] = { name: pm.name, role: pm.role };
  });
  return snapshot;
}

/**
 * Strip undefined values from an object for Firestore compatibility.
 * Firestore rejects explicit undefined — omit those fields entirely.
 */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as Record<string, unknown>;
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) {
      result[key] = value;
    }
  });
  return result as T;
}

/**
 * Convert a Firestore document to a Project domain object.
 */
export function docToProject(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    name: (data.name as string) ?? '',
    startDate: (data.startDate as string) ?? '',
    endDate: (data.endDate as string) ?? '',
    assignments: (data.assignments as ProjectAssignment[]) ?? [],
    reforecasts: (data.reforecasts as Project['reforecasts']) ?? [],
    activeReforecastId: (data.activeReforecastId as string | null) ?? null,
  };
}
