import { describe, it, expect, beforeEach } from 'vitest';
import {
  createLocalStorageRepository,
  DEFAULT_SETTINGS,
} from '../localStorage';
import { STORAGE_KEYS } from '@/types/storage';
import type { Project, Settings } from '@/types/domain';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj_001',
    name: 'Test Project',
    startDate: '2026-06-15',
    endDate: '2027-07-15',
    baselineBudget: 1000000,
    actualCost: 200000,
    teamMembers: [],
    reforecasts: [],
    activeReforecastId: null,
    ...overrides,
  };
}

describe('LocalStorage Repository', () => {
  let repo: ReturnType<typeof createLocalStorageRepository>;

  beforeEach(() => {
    localStorage.clear();
    repo = createLocalStorageRepository();
  });

  describe('Settings', () => {
    it('returns default settings when none are stored', async () => {
      const settings = await repo.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('saves and retrieves settings', async () => {
      const custom: Settings = {
        hoursPerMonth: 140,
        discountRateAnnual: 0.05,
        laborRates: [{ role: 'Dev', hourlyRate: 120 }],
      };
      await repo.saveSettings(custom);
      const result = await repo.getSettings();
      expect(result).toEqual(custom);
    });
  });

  describe('Projects', () => {
    it('returns empty array when no projects stored', async () => {
      const projects = await repo.getProjects();
      expect(projects).toEqual([]);
    });

    it('saves and retrieves a project', async () => {
      const project = makeProject();
      await repo.saveProject(project);
      const result = await repo.getProject('proj_001');
      expect(result).toEqual(project);
    });

    it('updates an existing project', async () => {
      const project = makeProject();
      await repo.saveProject(project);
      const updated = { ...project, name: 'Updated Name' };
      await repo.saveProject(updated);
      const result = await repo.getProject('proj_001');
      expect(result?.name).toBe('Updated Name');
      const all = await repo.getProjects();
      expect(all).toHaveLength(1);
    });

    it('deletes a project', async () => {
      await repo.saveProject(makeProject({ id: 'p1' }));
      await repo.saveProject(makeProject({ id: 'p2' }));
      await repo.deleteProject('p1');
      const all = await repo.getProjects();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('p2');
    });

    it('returns null for non-existent project', async () => {
      const result = await repo.getProject('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('Export / Import', () => {
    it('exports all data', async () => {
      const project = makeProject();
      await repo.saveProject(project);
      const exported = await repo.exportAll();
      expect(exported.version).toBe('1.0.0');
      expect(exported.settings).toEqual(DEFAULT_SETTINGS);
      expect(exported.projects).toEqual([project]);
    });

    it('imports data and overwrites existing', async () => {
      await repo.saveProject(makeProject({ id: 'old' }));
      const importData = {
        version: '1.0.0',
        settings: {
          hoursPerMonth: 140,
          discountRateAnnual: 0.05,
          laborRates: [],
        },
        projects: [makeProject({ id: 'new' })],
      };
      await repo.importAll(importData);
      const projects = await repo.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe('new');
      const settings = await repo.getSettings();
      expect(settings.hoursPerMonth).toBe(140);
    });
  });

  describe('Clear', () => {
    it('removes all stored data', async () => {
      await repo.saveProject(makeProject());
      await repo.clear();
      const projects = await repo.getProjects();
      expect(projects).toEqual([]);
      // Settings should return defaults after clear
      const settings = await repo.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('Version', () => {
    it('returns current version when none stored', async () => {
      const version = await repo.getVersion();
      expect(version).toBe('1.0.0');
    });
  });
});
