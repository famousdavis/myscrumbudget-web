// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Settings, PoolMember, Project, AppState, ProjectPrefPatch } from '@/types/domain';

export interface Repository {
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;

  getTeamPool(): Promise<PoolMember[]>;
  saveTeamPool(pool: PoolMember[]): Promise<void>;

  /**
   * Persist settings and the team pool as ONE operation.
   *
   * ⚠️ THIS EXISTS BECAUSE TWO DEBOUNCED WRITES ARE SILENT DATA LOSS ON THE
   * HAPPY PATH. A labor-rate role rename has to change `Settings.laborRates`
   * and every `PoolMember.role` holding the old name together; done as two
   * writes, a user who leaves the Settings page inside the 500 ms debounce
   * window gets a fresh `useTeamPool` reading pre-cascade storage, and the
   * next pool mutation persists that stale array over the cascade. The rename
   * is gone, with no error and no toast. In local mode that is certain —
   * `localStorage.ts` has zero `cloudSyncBus` references, so nothing tells the
   * stale hook to re-read.
   *
   * ⚠️ NO CALLER UNTIL PR C2 (2026-09-03), DELIBERATELY. This primitive and its
   * compile-time field guard land first so the guard exists before anything
   * depends on it. An unused public method sits at high test coverage and low
   * complexity, so NEITHER installed instrument reports it as dead — the
   * v0.36.13 "invisible to both instruments" finding, inverted. If C2 does not
   * land, this method and `SETTINGS_AND_POOL_MERGE_SET` in `firestoreRepo.ts`
   * should be removed rather than left standing.
   */
  saveSettingsAndTeamPool(settings: Settings, pool: PoolMember[]): Promise<void>;

  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  createProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
  /**
   * Ids in `orderedIds` take that order; ids present in storage but ABSENT from
   * `orderedIds` follow, in their existing relative order.
   *
   * ⚠️ Stated here as of v0.37.12 because this interface had NO contract and the
   * two implementations disagreed. Firestore had already implemented end-placement
   * all along, undocumented (`createProject` sets `order: projects.length` and
   * `getProjects` sorts on it, so an unseen project keeps the highest `order`);
   * localStorage instead rebuilt storage from exactly the ids it was handed and
   * PERMANENTLY DESTROYED the rest. The method is named *reorder*, not *replace*.
   *
   * ⚠️ THE EXTRA-ID DIVERGENCE IS GONE (v0.42.0), and the reason is worth
   * keeping because the old one was load-bearing for four releases. Cloud used
   * to reorder with a `writeBatch` of `{order: index}` per project, and
   * `WriteBatch.update` carries `Precondition.exists(true)`, so an `orderedIds`
   * naming a project deleted in another tab rejected the batch WHOLE. Cloud now
   * writes ONE ARRAY into the reader's own settings document; an array has no
   * existence precondition, so an id for a project that no longer exists is
   * simply carried along and ignored on read — which is what localStorage has
   * always done with an extra id.
   *
   * ⚠️ AND THE ORDER IS PER-READER IN CLOUD MODE. Reordering writes nothing to
   * any project document, so one member's drag no longer moves anybody else's
   * tiles — and a VIEWER can reorder their own dashboard, which the rules
   * refused outright while `order` lived on the shared document.
   *
   * ⚠️ DELIBERATE NON-CHOICE (2026-09-03), recorded so the surviving caller-side
   * invariant reads as CHOSEN rather than overlooked. The better shape is move
   * semantics — `moveProject(sourceId, targetId)`, each implementation replaying
   * one move against its own fresh read; `useDragReorder` already holds both ids
   * (`handleDrop:59-61`) and throws them away at :64-71. It was measured correct
   * on all three cases where end-placement is correct on one (two-tab add /
   * filtered drag / concurrent reorder). It was declined for v0.37.12 because it
   * closes the DELETION no better than end-placement, its extra value lies in one
   * case the caller invariant already guards and one that is out of scope, and its
   * blast radius — this interface, both implementations, a Firestore read path
   * that has none today with no emulator to verify it, the generic drag hook and
   * three tests — is a different size class from a data-loss fix. If the caller
   * invariant is ever to be RETIRED rather than reworded, this is the only shape
   * that does it.
   */
  reorderProjects(orderedIds: string[]): Promise<void>;

  /**
   * Change THIS reader's colour / archive preferences for one or more projects
   * (v0.42.0). `null` clears a preference; an absent key leaves it alone.
   *
   * ⚠️ CLOUD: one transaction on the reader's own settings document, per-field
   * paths only, and it SEEDS the reader first if they have never been seeded —
   * so a reader's first colour change cannot leave them marked as seeded with a
   * one-entry map, which would silently drop every other project's colour and
   * archive state they could see a moment earlier.
   *
   * ⚠️ LOCAL: the fields live on the stored project objects, exactly as they did
   * before this release, and a patch for an id that is not stored writes
   * nothing. Local mode has one reader, so there is nothing to make per-user.
   */
  writeProjectPrefs(patches: ProjectPrefPatch[]): Promise<void>;

  /**
   * Copy what this reader currently sees into their own preferences, once
   * (v0.42.0).
   *
   * Idempotent: a marker inside the same transaction decides, so a remount, a
   * second tab and a concurrent writer all converge on one seed. A failure is
   * not fatal — the reader keeps seeing the documents' values and the next load
   * tries again.
   *
   * ⚠️ NEVER CALL THIS FROM A READ. `getProjects` runs inside sign-out cleanup
   * before credentials are revoked, inside `exportAll`, inside the import's
   * stale-data guard and inside the team-pool delete guard; a read that writes
   * turns every one of those into a writer.
   *
   * LOCAL: a no-op.
   */
  ensureProjectPrefsSeeded(): Promise<void>;

  exportAll(): Promise<AppState>;
  importAll(state: AppState): Promise<void>;

  clear(): Promise<void>;
  getVersion(): Promise<string>;
  migrateIfNeeded(): Promise<void>;
}
