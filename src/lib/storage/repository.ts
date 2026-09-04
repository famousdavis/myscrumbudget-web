// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Settings, PoolMember, Project, AppState } from '@/types/domain';

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
   * ⚠️ The two implementations converge on the MISSING-id axis only. They still
   * diverge on the EXTRA-id axis: `WriteBatch.update` carries
   * `Precondition.exists(true)`, so a cloud batch naming a project deleted
   * elsewhere is rejected WHOLE — nothing reordered, the optimistic update
   * already applied, and the rejection unhandled. localStorage tolerates an
   * extra id (it is filtered out). Do not describe these as equivalent.
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

  exportAll(): Promise<AppState>;
  importAll(state: AppState): Promise<void>;

  clear(): Promise<void>;
  getVersion(): Promise<string>;
  migrateIfNeeded(): Promise<void>;
}
