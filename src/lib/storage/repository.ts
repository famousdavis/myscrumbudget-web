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
  reorderProjects(orderedIds: string[]): Promise<void>;

  exportAll(): Promise<AppState>;
  importAll(state: AppState): Promise<void>;

  clear(): Promise<void>;
  getVersion(): Promise<string>;
  migrateIfNeeded(): Promise<void>;
}
