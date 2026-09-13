// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type {
  Project, ProjectAssignment, PoolMember, LaborRate, Holiday, CostSnapshot,
} from '@/types/domain';
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
 * Build the snapshot a project's Firestore doc should carry, covering EVERY
 * reforecast's roster.
 *
 * ⚠️ ALL REFORECASTS, NOT THE ACTIVE ONE (v0.38.2). All three write sites
 * previously passed `getActiveReforecast(project)?.assignments`. Since v0.24.0
 * each reforecast owns its own roster, so that snapshotted ONE roster out of N:
 * a collaborator who switched the dropdown to any other reforecast got
 * "(Unknown)" for every row. The dashboard tile had the same hole from the
 * other side — `ProjectCard` resolves against `getMostRecentReforecast`, which
 * is not necessarily the active one. The map is keyed by `poolMemberId`, not by
 * reforecast, so widening it is a pure superset: no doc-shape change, no
 * migration, and no Firestore rules change (`_teamSnapshot` is already in
 * `myScrumBudgetProjectFields()`).
 *
 * ⚠️ PRIOR ENTRIES ARE CARRIED FORWARD, and this clause is load-bearing — do
 * not "simplify" it to a bare `buildTeamSnapshot` call. The snapshot is rebuilt
 * from the WRITER's pool, and an editor on a shared project has none of the
 * owner's pool members. Without the carry-forward, that editor saving the
 * project would rebuild the map from their own pool alone and silently DELETE
 * every entry they cannot resolve — destroying the names for all other
 * collaborators. Freshly resolved entries still win (the writer's pool is
 * authoritative for members they actually have), and entries for members no
 * longer assigned anywhere are pruned rather than accumulating.
 */
export function buildProjectTeamSnapshot(
  project: Project,
  pool: PoolMember[],
): Record<string, { name: string; role: string }> {
  const assignments = project.reforecasts.flatMap((rf) => rf.assignments ?? []);
  const fresh = buildTeamSnapshot(assignments, pool);
  const prior = project._teamSnapshot;
  if (!prior) return fresh;

  const merged: Record<string, { name: string; role: string }> = {};
  new Set(assignments.map((a) => a.poolMemberId)).forEach((id) => {
    const entry = fresh[id] ?? prior[id];
    if (entry) merged[id] = entry;
  });
  return merged;
}

/**
 * Validate a `_teamSnapshot` value read back from Firestore.
 *
 * Returns `undefined` for a missing, malformed, or empty map so that "no
 * snapshot" and "an empty snapshot" collapse to the same absent state — which
 * is what makes the field `conditional` in `_docToProjectCoverage` and keeps
 * `resolveAssignments` falling through to its "(Unknown)" branch rather than
 * consulting an object that can tell it nothing. Individual malformed entries
 * are dropped rather than poisoning the whole map.
 */
function sanitizeTeamSnapshot(
  value: unknown,
): Record<string, { name: string; role: string }> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const out: Record<string, { name: string; role: string }> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    if (typeof entry !== 'object' || entry === null) return;
    const { name, role } = entry as { name?: unknown; role?: unknown };
    if (typeof name === 'string' && typeof role === 'string') out[key] = { name, role };
  });
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Is this a usable `LaborRate`? Both fields checked, and the rate by
 * `Number.isFinite` rather than truthiness.
 *
 * ⚠️ `hourlyRate: 0` IS VALID and must stay valid — a $0 role is the deliberate
 * v0.37.4 feature for infrastructure that carries no cost (`RateTable` and
 * `validation.ts` both accept `>= 0`). The truthy spelling `!hourlyRate` would
 * drop such a rate, and under drop semantics that silently unprices the role.
 */
function isLaborRate(value: unknown): value is LaborRate {
  if (typeof value !== 'object' || value === null) return false;
  const { role, hourlyRate } = value as { role?: unknown; hourlyRate?: unknown };
  return typeof role === 'string' && Number.isFinite(hourlyRate);
}

/**
 * Is this a usable `Holiday`? ALL FOUR fields, not just the two dates.
 *
 * The snapshot's own consumer (`countHolidayWorkdays`) reads only
 * `startDate`/`endDate`, but the rebuilt object is typed `Holiday`, and letting
 * a `{id: 42}` through would put a value on a typed array that does not satisfy
 * it. Four is also exactly what the app's own `validateHoliday` requires, so
 * this rejects nothing the app calls legitimate.
 */
function isHoliday(value: unknown): value is Holiday {
  if (typeof value !== 'object' || value === null) return false;
  const { id, name, startDate, endDate } = value as {
    id?: unknown; name?: unknown; startDate?: unknown; endDate?: unknown;
  };
  return typeof id === 'string' && typeof name === 'string'
    && typeof startDate === 'string' && typeof endDate === 'string';
}

/**
 * Validate a stored `_costSnapshot` (v0.39.0) and rebuild it from exactly the
 * three keys `CostSnapshot` declares, so a fourth key on the stored object
 * cannot reach a reader.
 *
 * ⚠️⚠️ THE DISPOSITION, AND IT IS ONE RULE:
 *   an ELEMENT-level defect DROPS the element;
 *   a structurally UNUSABLE FIELD rejects the whole snapshot.
 * The three fields are validated INDEPENDENTLY — a mistyped holiday must not
 * discard the owner's rate card.
 *
 * ⚠️ WHY DROP AND NOT REJECT-WHOLE, because an earlier draft had it backwards
 * and the reason is measurable. Dropping a `LaborRate` removes that role from
 * the array, so `AllocationGridRow`'s v0.37.5 red "Role not in labor rates"
 * marker FIRES — the reader sees $0 AND sees why. Rejecting the whole snapshot
 * falls back to the READER's own card, which reprices roles the bad element
 * never touched, silently: measured on the real population, 32 of 67 owner
 * roles (48%) across 14 owner/reader pairs are names the reader also has, three
 * pairs at 100%. Reject-whole is the silent one.
 *
 * ⚠️ THE COST OF WHOLE-REJECTION IS NOT ZERO, and rejecting on a bad
 * `discountRateAnnual` pays it: it discards `laborRates` and `holidays` too, so
 * that same silent repricing applies. It is ACCEPTED, not absent — a scalar has
 * no element to drop and a sanitizer must never invent a number. Revisit in
 * v0.40.0, where a writer exists and a surface could report it.
 *
 * ⚠️ Deliberately NOT copying `sanitizeTeamSnapshot`'s "empty ⇒ undefined" rule:
 * `holidays: []` is a legitimate owner value. Note the boundary this creates —
 * if EVERY `LaborRate` is malformed, dropping leaves `laborRates: []`, so every
 * role is unpriced and every row is red. That is loud, which is why it is
 * acceptable, and it is pinned by a test.
 */
export function sanitizeCostSnapshot(value: unknown): CostSnapshot | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const { laborRates, holidays, discountRateAnnual } = value as {
    laborRates?: unknown; holidays?: unknown; discountRateAnnual?: unknown;
  };
  // A FIELD that is structurally unusable rejects the whole snapshot: there is
  // nothing to construct, and `Number.isFinite` is what makes `0` a valid rate
  // while NaN and Infinity are not.
  if (!Array.isArray(laborRates) || !Array.isArray(holidays)) return undefined;
  if (!Number.isFinite(discountRateAnnual)) return undefined;
  // An ELEMENT that is defective is dropped; its siblings survive.
  return {
    laborRates: laborRates.filter(isLaborRate),
    holidays: holidays.filter(isHoliday),
    discountRateAnnual: discountRateAnnual as number,
  };
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
  _teamSnapshot: 'conditional',
  _costSnapshot: 'conditional',
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
  // Shared-project team names (v0.38.2). This field was written to every
  // project doc from v0.16.0 and hydrated by NOTHING until v0.38.2: the map
  // reached the browser inside the document and was discarded here, so
  // `resolveAssignments`' snapshot fallback — which exists, and is unit-tested
  // — could never receive it, and every collaborator saw "(Unknown)" for the
  // owner's whole team. Do not remove this line without also removing the
  // third argument at the four `resolveAssignments` call sites; a silent
  // read-path drop is invisible to every write-side test and to local mode.
  const snapshot = sanitizeTeamSnapshot(data._teamSnapshot);
  if (snapshot) project._teamSnapshot = snapshot;
  // Cost inputs the project was costed with (v0.39.0). Only a snapshot that
  // validates hydrates, so null/missing/malformed all collapse to absent and a
  // domain Project carries a usable snapshot or none.
  //
  // ⚠️ NOTHING WRITES ONE AT v0.39.0 — the writer is v0.40.0 — so this line is
  // unreachable today. Do NOT delete it as dead: a field written correctly by
  // every save and never hydrated here is invisible in the UI and green in
  // every local-mode test. `_teamSnapshot` above was exactly that for
  // twenty-two minors, which is why this one is wired up before a writer
  // exists rather than after.
  const cost = sanitizeCostSnapshot(data._costSnapshot);
  if (cost) project._costSnapshot = cost;
  return project;
}
