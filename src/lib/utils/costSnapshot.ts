// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Project, Settings, LaborRate } from '@/types/domain';

/**
 * A `Project` as returned by `getProject`, which may carry the ownership flag.
 *
 * ⚠️ DEFINED HERE RATHER THAN IN `firestoreRepo.ts`, AND THE REASON IS THE
 * MODULE GRAPH, NOT TIDINESS (v0.41.0). `firestoreRepo.ts` imports
 * `firebase/firestore` and `@/lib/firebase/config` AT RUNTIME. Its first
 * consumer outside the repository layer is a React component, and a plain
 * (non-`type`) import of this alias from there would pull both into the
 * component's graph — measured to pass `tsc` 0 AND lint 13/0, because
 * `isolatedModules` is on and `verbatimModuleSyntax` is not. So the type lives
 * in this firebase-free module and `firestoreRepo.ts` re-exports it; every
 * existing importer is unchanged.
 *
 * ⚠️ `_isOwner` is DELIBERATELY NOT A `Project` FIELD and NOT a
 * `FirestoreProjectDoc` field. It follows the `_memberCount` precedent: an
 * ad-hoc intersection attached by the repository for a consumer that needs it,
 * never part of the domain type. Putting it on `Project` would fire TS2741 in
 * `sanitizeImport.ts`'s `PROJECT_FIELD_SET` and demand an entry in
 * `FirestoreProjectDoc` for a field that is never written to a document — the
 * flag describes the READER's relationship to the document, not the document.
 *
 * ⚠️ PRESENT and `true`, or ABSENT. Never `false`.
 */
export type ProjectWithOwnership = Project & { _isOwner?: true };

/**
 * Resolve the cost inputs to price a project with (v0.39.0).
 *
 * A project carrying a `_costSnapshot` is priced from the OWNER's inputs, so
 * every collaborator sees the same figures. Without one, the reader's own
 * `Settings` are used — which is the behaviour before this release.
 *
 * ⚠️⚠️ CONSTRUCTED FIELD BY FIELD, NEVER SPREAD, AND THAT IS LOAD-BEARING.
 * A spread cannot state which field deliberately does NOT come from the
 * snapshot. `trafficLightThresholds` stays the READER's: it is a per-user
 * display preference, not a cost input — how red you want "over budget" to look
 * is yours, while what the project costs is the owner's. Written as a spread,
 * that decision is implied by key order and is silently reversed by anyone who
 * reorders it.
 *
 * ⚠️ It also means a fourth key on the stored object cannot reach a reader even
 * if the sanitizer let one through — the consumer picks rather than the
 * producer supplying. The sanitizer rebuilds anyway; this is defence in depth.
 *
 * ⚠️ An earlier design had three call sites spelling this merge out by hand and
 * they PROVABLY DIVERGED — under a malformed snapshot one crashed the page and
 * another silently returned the reader's rates. Two things close that: the
 * sanitizer removes the malformed input entirely, and this helper is the single
 * spelling. Do not inline it back.
 */
export function effectiveSettings(project: Project, settings: Settings): Settings {
  const snapshot = project._costSnapshot;
  if (!snapshot) return settings;
  return {
    laborRates: snapshot.laborRates,
    holidays: snapshot.holidays,
    discountRateAnnual: snapshot.discountRateAnnual,
    // Deliberately the READER's. See the note above before "simplifying".
    trafficLightThresholds: settings.trafficLightThresholds,
  };
}

/**
 * The labor rates to price a project's roles with — the snapshot's if it has
 * one, otherwise the reader's.
 *
 * ⚠️ `settings` is nullable and the `undefined` return is MEANINGFUL, not
 * defensive. The project detail page discards `useSettings`' `loading`, so
 * `settings` really is null on the first render; `AllocationGridRow` reads
 * `laborRates !== undefined` to decide whether to flag a role as rate-less.
 * Returning `[]` there would flag EVERY member mid-fetch. `undefined` means
 * "not loaded yet" and flags nobody. Do not add `?? []`.
 *
 * ⚠️ Separate from `effectiveSettings` because the grid's prop is
 * `laborRates?: LaborRate[]`, not `Settings` — and because `effectiveSettings`
 * cannot take a null `settings` (it must return a complete `Settings`), while
 * this can.
 */
export function effectiveLaborRates(
  project: Project,
  settings: Settings | null,
): LaborRate[] | undefined {
  return project._costSnapshot?.laborRates ?? settings?.laborRates;
}

/**
 * Does this role have no labor rate in the given card? (v0.41.0)
 *
 * ⚠️⚠️ `laborRates === undefined` MUST RETURN `false`, AND THAT IS THE WHOLE
 * REASON THIS FUNCTION EXISTS AS ONE SPELLING. `undefined` means "the rates
 * have not loaded yet" and must flag NOBODY; `[]` means "loaded, and there are
 * genuinely no rates" and must flag EVERYBODY. `?? []` collapses the two and
 * flags every member mid-fetch — that is the v0.37.6 defect, and it had to be
 * fixed twice because the rule lived in three separate hand-written copies.
 * DO NOT ADD `?? []`.
 *
 * ⚠️ Matching is EXACT and case-sensitive, deliberately, because
 * `getHourlyRate` (`costs.ts:12`) looks a role up the same way. The two must
 * agree: a role this returns `true` for is exactly a role the calc engine
 * prices at $0. A case-insensitive match here would claim a rate exists for a
 * role the engine will not find.
 *
 * ⚠️ THE THIRD CALL SITE IS NOT THIS PREDICATE ALONE. `RoleSelect.tsx` carries
 * an extra `value !== ''` clause AT ITS CALL SITE and must keep it — an empty
 * select is the normal unset state, not an orphaned role. Deriving that site
 * from this function alone re-introduces the v0.37.6 defect. See the note
 * there.
 */
export function roleHasNoRate(role: string, laborRates: LaborRate[] | undefined): boolean {
  return laborRates !== undefined && !laborRates.some((r) => r.role === role);
}
