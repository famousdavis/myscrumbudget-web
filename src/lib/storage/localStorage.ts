import type { Repository } from './repository';
import type { Settings, PoolMember, Project, AppState } from '@/types/domain';
import { STORAGE_KEYS } from '@/types/storage';
import { runMigrations, CURRENT_VERSION } from './migrations';

export const DEFAULT_SETTINGS: Settings = {
  hoursPerMonth: 160,
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
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : fallback;
}

function set(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
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

    async exportAll() {
      return {
        version: CURRENT_VERSION,
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
      return get<string>(STORAGE_KEYS.version, CURRENT_VERSION);
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
