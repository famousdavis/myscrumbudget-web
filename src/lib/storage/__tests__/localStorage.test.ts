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
    assignments: [],
    reforecasts: [
      {
        id: 'rf-baseline',
        name: 'Baseline',
        createdAt: '2026-06-01T00:00:00Z',
        startDate: '2026-06',
        reforecastDate: '2026-06-01',
        allocations: [],
        productivityWindows: [],
        actualCost: 200000,
        baselineBudget: 1000000,
      },
    ],
    activeReforecastId: 'rf-baseline',
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
        discountRateAnnual: 0.05,
        laborRates: [{ role: 'Dev', hourlyRate: 120 }],
        holidays: [],
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

  describe('Team Pool', () => {
    it('returns empty array when no pool stored', async () => {
      const pool = await repo.getTeamPool();
      expect(pool).toEqual([]);
    });

    it('saves and retrieves pool members', async () => {
      const pool = [
        { id: 'pm1', name: 'Alice', role: 'Dev' },
        { id: 'pm2', name: 'Bob', role: 'QA' },
      ];
      await repo.saveTeamPool(pool);
      const result = await repo.getTeamPool();
      expect(result).toEqual(pool);
    });
  });

  describe('Export / Import', () => {
    it('exports all data', async () => {
      const project = makeProject();
      await repo.saveProject(project);
      const exported = await repo.exportAll();
      expect(exported.version).toBe('0.6.0');
      expect(exported.settings).toEqual(DEFAULT_SETTINGS);
      expect(exported.teamPool).toEqual([]);
      expect(exported.projects).toEqual([project]);
    });

    it('imports data and overwrites existing', async () => {
      await repo.saveProject(makeProject({ id: 'old' }));
      const importData = {
        version: '0.3.0',
        settings: {
          discountRateAnnual: 0.05,
          laborRates: [],
          holidays: [],
        },
        teamPool: [],
        projects: [makeProject({ id: 'new' })],
      };
      await repo.importAll(importData);
      const projects = await repo.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe('new');
      const settings = await repo.getSettings();
      expect(settings.discountRateAnnual).toBe(0.05);
    });
  });

  describe('Import / Export Round-Trip', () => {
    it('exported data can be re-imported without loss', async () => {
      const project = makeProject({ id: 'rt1', name: 'RoundTrip' });
      await repo.saveProject(project);
      await repo.saveTeamPool([
        { id: 'pm1', name: 'Alice', role: 'Dev' },
      ]);

      const exported = await repo.exportAll();
      await repo.clear();

      // Verify cleared
      expect(await repo.getProjects()).toEqual([]);

      await repo.importAll(exported);
      const projects = await repo.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('RoundTrip');

      const pool = await repo.getTeamPool();
      expect(pool).toHaveLength(1);
      expect(pool[0].name).toBe('Alice');
    });

    it('imported older data is migrated correctly through runMigrations', async () => {
      const { runMigrations } = await import('../../storage/migrations');

      const v1Data = {
        version: '1.0.0',
        settings: {
          hoursPerMonth: 160,
          discountRateAnnual: 0.03,
          laborRates: [],
        },
        teamPool: [],
        projects: [{
          id: 'p1',
          name: 'Legacy',
          startDate: '2026-06',
          endDate: '2027-06',
          baselineBudget: 100000,
          actualCost: 0,
          teamMembers: [
            { id: 'tm1', name: 'Bob', role: 'Dev', type: 'Core' },
          ],
          reforecasts: [],
          activeReforecastId: null,
        }],
      };

      // Simulate import flow: run migrations then import
      const migrated = runMigrations(v1Data as any, '1.0.0');
      await repo.importAll(migrated);

      const projects = await repo.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].assignments).toHaveLength(1);
      expect((projects[0] as any).teamMembers).toBeUndefined();

      const pool = await repo.getTeamPool();
      expect(pool).toHaveLength(1);
      expect(pool[0].name).toBe('Bob');

      // v0.4.0 migration: actualCost moved into Baseline reforecast
      expect((projects[0] as any).actualCost).toBeUndefined();
      expect(projects[0].reforecasts).toHaveLength(1);
      expect(projects[0].reforecasts[0].name).toBe('Baseline');
      expect(projects[0].reforecasts[0].actualCost).toBe(0);
      expect(projects[0].activeReforecastId).toBe(projects[0].reforecasts[0].id);

      // v0.5.0 migration: baselineBudget moved into reforecast, reforecastDate added
      expect((projects[0] as any).baselineBudget).toBeUndefined();
      expect(projects[0].reforecasts[0].baselineBudget).toBe(100000);
      expect(projects[0].reforecasts[0].reforecastDate).toBeTruthy();

      // hoursPerMonth should be stripped
      const settings = await repo.getSettings();
      expect((settings as any).hoursPerMonth).toBeUndefined();
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
      expect(version).toBe('0.6.0');
    });
  });
});
