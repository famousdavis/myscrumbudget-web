// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Project, Settings, LaborRate } from '@/types/domain';

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
