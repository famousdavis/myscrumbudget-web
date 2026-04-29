// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

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
 *
 * Backward compatibility: legacy docs (schemaVersion 1) stored
 * `assignments` at the document root. Newer docs (schemaVersion 2)
 * store `assignments` per-reforecast. On read, hydrate any reforecast
 * that lacks its own `assignments` array using the legacy top-level
 * value (deep-cloned). When reforecasts already carry their own
 * assignments, those win — the legacy field is ignored.
 */
export function docToProject(id: string, data: Record<string, unknown>): Project {
  const rawReforecasts = (data.reforecasts as Record<string, unknown>[]) ?? [];
  const legacyAssignments = (data.assignments as ProjectAssignment[]) ?? null;
  const reforecasts = rawReforecasts.map((rf) => ({
    ...rf,
    assignments: Array.isArray(rf.assignments)
      ? (rf.assignments as ProjectAssignment[])
      : (legacyAssignments ?? []).map((a) => ({ ...a })),
  })) as unknown as Project['reforecasts'];
  return {
    id,
    name: (data.name as string) ?? '',
    startDate: (data.startDate as string) ?? '',
    endDate: (data.endDate as string) ?? '',
    reforecasts,
    activeReforecastId: (data.activeReforecastId as string | null) ?? null,
  };
}
