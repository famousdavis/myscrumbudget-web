// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Repository } from './repository';
import type { Settings, PoolMember, Project, AppState } from '@/types/domain';
import { STORAGE_KEYS } from '@/types/storage';
import { runMigrations, DATA_VERSION } from './migrations';
import { isValidSettings, isValidProjectArray, isValidPoolMemberArray } from '@/lib/utils/validation';
import {
  ensureOriginRef, getWorkspaceId, getChangeLog, getExportAttribution,
  setOriginRef, setChangeLog, type ChangeLogEntry,
} from './fingerprint';

export const DEFAULT_SETTINGS: Settings = {
  discountRateAnnual: 0.03,
  laborRates: [
    { role: 'BA', hourlyRate: 75 },
    { role: 'IT-SoftEng', hourlyRate: 100 },
    { role: 'IT-Security', hourlyRate: 90 },
    { role: 'IT-DevOps', hourlyRate: 80 },
    { role: 'Manager', hourlyRate: 150 },
    { role: 'PMO', hourlyRate: 120 },
  ],
  holidays: [],
  trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
};

/**
 * Custom error class for storage quota exceeded
 */
export class StorageQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

/**
 * Read from localStorage with optional type validation
 * Returns fallback if key not found, parse fails, or validation fails
 */
function get<T>(key: string, fallback: T, validator?: (val: unknown) => val is T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const data = localStorage.getItem(key);
    if (!data) return fallback;

    const parsed = JSON.parse(data);

    // If validator provided, check type at runtime
    if (validator && !validator(parsed)) {
      console.warn(`[storage] Type validation failed for "${key}", using fallback`);
      return fallback;
    }

    return parsed as T;
  } catch (e) {
    console.warn(`[storage] Failed to read "${key}":`, e);
    return fallback;
  }
}

/**
 * Write to localStorage with quota error detection
 * Throws StorageQuotaError if quota is exceeded
 */
function set(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    const json = JSON.stringify(value);
    localStorage.setItem(key, json);
  } catch (e) {
    // Detect quota exceeded error (DOMException code 22 or name QuotaExceededError)
    if (e instanceof DOMException && (e.code === 22 || e.name === 'QuotaExceededError')) {
      console.error(`[storage] Quota exceeded for "${key}"`);
      throw new StorageQuotaError('Storage quota exceeded. Cannot save changes. Try exporting your data and clearing old projects.');
    }
    console.error(`[storage] Failed to write "${key}":`, e);
  }
}

export function createLocalStorageRepository(): Repository {
  const repo: Repository = {
    async getSettings() {
      return get<Settings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS, isValidSettings);
    },

    async saveSettings(settings) {
      set(STORAGE_KEYS.settings, settings);
    },

    async getTeamPool() {
      return get<PoolMember[]>(STORAGE_KEYS.teamPool, [], isValidPoolMemberArray);
    },

    async saveTeamPool(pool) {
      set(STORAGE_KEYS.teamPool, pool);
    },

    async saveSettingsAndTeamPool(settings, pool) {
      // ⚠️ POOL FIRST, AND THE ORDER IS THE WHOLE DESIGN OF THIS METHOD IN LOCAL
      // MODE. localStorage has no multi-key transaction, so this is two
      // `setItem`s — far narrower than two debounced writes (no debounce, no
      // navigation, no second reader) but not atomic. `set` throws
      // StorageQuotaError on quota and swallows every other write error with a
      // bare console.error, so a partial write IS reachable.
      //
      // Pool first, for two independent reasons:
      //   1. RECOVERABILITY. Both orders leave identical red markers on screen,
      //      so visibility does not separate them. Pool-first is repaired by
      //      repeating the same rename — the cascade finds 0 holders and the
      //      rates land, one step. Rates-first strands every holder on a role
      //      whose rate row no longer exists, with no X row left to rename.
      //   2. A rename's byte delta is N×Δ on the pool against 1×Δ on the rates,
      //      so if either write crosses quota it is the pool's. Writing it
      //      first means the likelier failure happens before anything was
      //      written at all.
      //
      // ⚠️ `importUtils.ts:319` is also pool-first, for a DIFFERENT reason
      // (project writes downstream need the updated pool to build
      // `_teamSnapshot`). Do not copy its reasoning onto this site.
      set(STORAGE_KEYS.teamPool, pool);
      set(STORAGE_KEYS.settings, settings);
    },

    async getProjects() {
      return get<Project[]>(STORAGE_KEYS.projects, [], isValidProjectArray);
    },

    async getProject(id) {
      const projects = await repo.getProjects();
      return projects.find((p) => p.id === id) ?? null;
    },

    async saveProject(project) {
      const projects = await repo.getProjects();
      const index = projects.findIndex((p) => p.id === project.id);
      if (index >= 0) {
        projects[index] = project;
      } else {
        projects.push(project);
      }
      set(STORAGE_KEYS.projects, projects);
    },

    async createProject(project) {
      // localStorage has no ownership concept — delegate to saveProject
      await repo.saveProject(project);
    },

    async deleteProject(id) {
      const projects = await repo.getProjects();
      set(
        STORAGE_KEYS.projects,
        projects.filter((p) => p.id !== id)
      );
    },

    /**
     * CONTRACT: ids in `orderedIds` take that order; ids present in storage but
     * ABSENT from `orderedIds` follow, in their existing relative order.
     *
     * ⚠️ Until v0.37.12 this wrote ONLY the ids it was handed, so a caller
     * holding a stale picture of the list silently and permanently destroyed
     * every project missing from it. Reachable by an ordinary user with two
     * tabs: create a project in tab A, drag to reorder in tab B, and tab A's
     * project is gone. Nothing corrects tab B in local mode — this file has zero
     * `cloudSyncBus` references and no `storage` listener exists for
     * `msb:projects` (`FirstRunBanner.tsx:57` is the only one, for another key).
     *
     * ⚠️ End-placement is not an arbitrary pick. `saveProject` pushes (:142),
     * so new projects already go last here; and Firestore has implemented the
     * same rule all along — `createProject` sets `order: projects.length` and
     * `getProjects` sorts on `order`, so a project a stale tab never saw keeps
     * the highest `order` and sorts last. The interface is named *reorder*, not
     * *replace*. THIS implementation was the outlier; the fix makes it conform.
     *
     * ⚠⚠ BOUND, stated because the obvious stronger claim is FALSE: this never
     * drops a project that `getProjects()` RETURNED. It is NOT "never reduces the
     * stored project count". `getProjects` reads through `isValidProjectArray`,
     * which is `.every(...)`, so ONE malformed stored project makes it return the
     * `[]` fallback and this function then writes `[]`. Measured 2026-09-03 WITH
     * this fix applied: three well-formed projects seeded alongside one malformed
     * entry, all three destroyed by an ordinary drag. That is a separate, general
     * localStorage hazard — `saveProject` and `deleteProject` read through the
     * same fallback and would do the same — and is a named follow-up item by
     * owner decision, deliberately NOT fixed here.
     */
    async reorderProjects(orderedIds) {
      const projects = await repo.getProjects();
      const byId = new Map(projects.map((p) => [p.id, p]));
      const handled = new Set(orderedIds);
      const reordered = orderedIds
        .map((id) => byId.get(id))
        .filter((p): p is Project => p !== undefined);
      // Unhandled projects follow, in storage order. When `orderedIds` covers
      // every stored project nothing is appended and the write is byte-identical
      // to the pre-v0.37.12 behaviour.
      set(STORAGE_KEYS.projects, [
        ...reordered,
        ...projects.filter((p) => !handled.has(p.id)),
      ]);
    },

    async exportAll() {
      const data: AppState = {
        version: DATA_VERSION,
        msbExportKind: 'dataset',  // discriminant — pitfall #61 gate for future formats
        settings: await repo.getSettings(),
        teamPool: await repo.getTeamPool(),
        projects: await repo.getProjects(),
        // Workspace reconciliation tokens
        _originRef: ensureOriginRef(),
        _storageRef: getWorkspaceId(),
        _changeLog: getChangeLog(),
      };

      // Conditionally inject export attribution
      const attr = getExportAttribution();
      if (attr.name) data._exportedBy = attr.name;
      if (attr.id) data._exportedById = attr.id;

      return data;
    },

    async importAll(state) {
      set(STORAGE_KEYS.version, state.version);
      set(STORAGE_KEYS.settings, state.settings);
      set(STORAGE_KEYS.teamPool, state.teamPool);
      set(STORAGE_KEYS.projects, state.projects);

      // Preserve _originRef from imported file; backfill with current workspace if absent
      const importedOrigin = state._originRef;
      const originRef = typeof importedOrigin === 'string' && importedOrigin
        ? importedOrigin
        : getWorkspaceId();
      setOriginRef(originRef);

      // Preserve imported changelog, append import event
      const importedLog: ChangeLogEntry[] = Array.isArray(state._changeLog) ? state._changeLog : [];
      const withImportEvent: ChangeLogEntry[] = [...importedLog, {
        t: Math.floor(Date.now() / 1000),
        op: 'import',
        entity: 'dataset',
        source: 'file',
      }];
      setChangeLog(withImportEvent);
    },

    async clear() {
      Object.values(STORAGE_KEYS).forEach((key) => {
        localStorage.removeItem(key);
      });
    },

    async getVersion() {
      return get<string>(STORAGE_KEYS.version, DATA_VERSION);
    },

    async migrateIfNeeded() {
      const currentVersion = await repo.getVersion();
      const data = await repo.exportAll();
      const migrated = runMigrations(data, currentVersion);

      if (migrated.version !== currentVersion) {
        await repo.importAll(migrated);
      }
    },
  };

  return repo;
}
