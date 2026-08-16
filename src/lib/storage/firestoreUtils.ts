// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Project, ProjectAssignment, PoolMember } from '@/types/domain';
import { isProjectColor } from '@/features/projects/lib/projectColors';

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
export function stripUndefined<T extends object>(obj: T): T {
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
/**
 * Compile-time completeness guard for the READ path.
 *
 * Every write site can be correct and a field still never reach the app, because
 * `docToProject` builds a `Project` by hand: a field written to Firestore by all
 * three write literals but never hydrated here is present in the document,
 * invisible in the UI, and GREEN IN EVERY LOCAL-MODE TEST — nothing on the write
 * side can detect it. `color` shipped that way in v0.33.0 for 7 releases.
 *
 * Each key maps to how `docToProject` populates it: 'required' for a field set
 * in the base literal, 'conditional' for one hydrated behind a type check (only
 * a valid value materialises; null/false/missing stay absent). Adding a field to
 * `Project` makes this a TS2741 naming the field, which is the prompt to decide
 * which of the two it is — and `id` is included because it comes from the doc
 * ID rather than the payload, which is exactly the kind of thing a reader needs
 * told.
 */
const _docToProjectCoverage: { [K in keyof Project]-?: 'required' | 'conditional' } = {
  id: 'required',
  name: 'required',
  startDate: 'required',
  endDate: 'required',
  reforecasts: 'required',
  activeReforecastId: 'required',
  color: 'conditional',
  archived: 'conditional',
};
void _docToProjectCoverage;

export function docToProject(id: string, data: Record<string, unknown>): Project {
  const rawReforecasts = (data.reforecasts as Record<string, unknown>[]) ?? [];
  const legacyAssignments = (data.assignments as ProjectAssignment[]) ?? null;
  const reforecasts = rawReforecasts.map((rf) => ({
    ...rf,
    assignments: Array.isArray(rf.assignments)
      ? (rf.assignments as ProjectAssignment[])
      : (legacyAssignments ?? []).map((a) => ({ ...a })),
  })) as unknown as Project['reforecasts'];
  const project: Project = {
    id,
    name: (data.name as string) ?? '',
    startDate: (data.startDate as string) ?? '',
    endDate: (data.endDate as string) ?? '',
    reforecasts,
    activeReforecastId: (data.activeReforecastId as string | null) ?? null,
  };
  // Optional Dashboard tile tint (v0.33.0). Stored as null when cleared; only
  // a known key hydrates onto the domain object.
  if (isProjectColor(data.color)) project.color = data.color;
  // Optional archiving flag (v0.34.0). Stored as null when cleared; only `true`
  // hydrates — null/false/missing all collapse back to "absent" (active) on read.
  if (data.archived === true) project.archived = true;
  return project;
}
