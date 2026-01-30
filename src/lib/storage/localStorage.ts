import type { Repository } from './repository';
import type { Settings, PoolMember, Project, AppState } from '@/types/domain';
import { STORAGE_KEYS } from '@/types/storage';
import { runMigrations, DATA_VERSION } from './migrations';

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
};

function get<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    console.warn(`[storage] Failed to read "${key}":`, e);
    return fallback;
  }
}

function set(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[storage] Failed to write "${key}":`, e);
  }
}

export function createLocalStorageRepository(): Repository {
  const repo: Repository = {
    async getSettings() {
      return get<Settings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    },

    async saveSettings(settings) {
      set(STORAGE_KEYS.settings, settings);
    },

    async getTeamPool() {
      return get<PoolMember[]>(STORAGE_KEYS.teamPool, []);
    },

    async saveTeamPool(pool) {
      set(STORAGE_KEYS.teamPool, pool);
    },

    async getProjects() {
      return get<Project[]>(STORAGE_KEYS.projects, []);
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
