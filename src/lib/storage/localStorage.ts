import type { Repository } from './repository';
import type { Settings, PoolMember, Project, AppState } from '@/types/domain';
import { STORAGE_KEYS } from '@/types/storage';
import { runMigrations, DATA_VERSION } from './migrations';
import { isValidSettings, isValidProjectArray, isValidPoolMemberArray } from '@/lib/utils/validation';

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
  trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
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

    async deleteProject(id) {
      const projects = await repo.getProjects();
      set(
        STORAGE_KEYS.projects,
        projects.filter((p) => p.id !== id)
      );
    },

    async reorderProjects(orderedIds) {
      const projects = await repo.getProjects();
      const byId = new Map(projects.map((p) => [p.id, p]));
      const reordered = orderedIds
        .map((id) => byId.get(id))
        .filter((p): p is Project => p !== undefined);
      set(STORAGE_KEYS.projects, reordered);
    },

    async exportAll() {
      return {
        version: DATA_VERSION,
        settings: await repo.getSettings(),
        teamPool: await repo.getTeamPool(),
        projects: await repo.getProjects(),
      };
    },

    async importAll(state) {
      set(STORAGE_KEYS.version, state.version);
      set(STORAGE_KEYS.settings, state.settings);
      set(STORAGE_KEYS.teamPool, state.teamPool);
      set(STORAGE_KEYS.projects, state.projects);
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
