// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach } from 'vitest';
import { repo, switchRepoImpl } from '../repo';
import { createLocalStorageRepository } from '../localStorage';
import type { Repository } from '../repository';

describe('delegating repo', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset to localStorage impl
    switchRepoImpl(createLocalStorageRepository());
  });

  it('delegates to the active implementation', async () => {
    const settings = await repo.getSettings();
    expect(settings).toBeDefined();
    expect(settings.discountRateAnnual).toBe(0.03);
  });

  it('switches implementation at runtime', async () => {
    // Create a mock repo
    const mockRepo: Repository = {
      getSettings: async () => ({
        discountRateAnnual: 0.99,
        laborRates: [],
        holidays: [],
        trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
      }),
      saveSettings: async () => {},
      getTeamPool: async () => [],
      saveTeamPool: async () => {},
      getProjects: async () => [],
      getProject: async () => null,
      saveProject: async () => {},
      createProject: async () => {},
      deleteProject: async () => {},
      reorderProjects: async () => {},
      exportAll: async () => ({
        version: '0.7.0',
        settings: { discountRateAnnual: 0.99, laborRates: [], holidays: [], trafficLightThresholds: { amberPercent: 5, redPercent: 15 } },
        teamPool: [],
        projects: [],
      }),
      importAll: async () => {},
      clear: async () => {},
      getVersion: async () => '0.7.0',
      migrateIfNeeded: async () => {},
    };

    switchRepoImpl(mockRepo);

    const settings = await repo.getSettings();
    expect(settings.discountRateAnnual).toBe(0.99);
  });

  it('createProject delegates to active implementation', async () => {
    // In localStorage mode, createProject delegates to saveProject
    const project = {
      id: 'test-1',
      name: 'Test Project',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      assignments: [],
      reforecasts: [],
      activeReforecastId: null,
    };

    await repo.createProject(project);
    const saved = await repo.getProject('test-1');
    expect(saved).not.toBeNull();
    expect(saved!.name).toBe('Test Project');
  });
});
