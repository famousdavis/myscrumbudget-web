// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { runMigrations, DATA_VERSION } from '../migrations';
import type { AppState } from '@/types/domain';

function makeAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    version: '0.11.0',
    settings: {
      discountRateAnnual: 0.03,
      laborRates: [],
      holidays: [],
      trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
    },
    teamPool: [],
    projects: [],
    ...overrides,
  };
}

describe('Migrations', () => {
  it('returns data unchanged when already at current version', () => {
    const data = makeAppState();
    const result = runMigrations(data, DATA_VERSION);
    expect(result).toEqual(data);
  });

  it('returns data unchanged when no migrations are pending', () => {
    const data = makeAppState({ version: '0.13.0' });
    const result = runMigrations(data, '0.13.0');
    expect(result).toEqual(data);
  });

  it('exports current version constant', () => {
    expect(DATA_VERSION).toBe('0.13.0');
  });

  it('migrates v1 data to v2 (extracts team pool from projects)', () => {
    // Simulate v1 data with teamMembers embedded in projects
    const v1Data = {
      version: '1.0.0',
      settings: {
        hoursPerMonth: 160,
        discountRateAnnual: 0.03,
        laborRates: [],
      },
      projects: [
        {
          id: 'proj1',
          name: 'Project 1',
          startDate: '2026-06-15',
          endDate: '2027-07-15',
          baselineBudget: 1000000,
          actualCost: 200000,
          teamMembers: [
            { id: 'tm1', name: 'Alice', role: 'Dev', type: 'Core' },
            { id: 'tm2', name: 'Bob', role: 'QA', type: 'Extended' },
          ],
          reforecasts: [],
          activeReforecastId: null,
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v1Data, '1.0.0');

    // Version should be bumped to latest
    expect(result.version).toBe('0.13.0');

    // Pool should contain both members
    expect(result.teamPool).toHaveLength(2);
    expect(result.teamPool[0]).toEqual({
      id: 'tm1',
      name: 'Alice',
      role: 'Dev',
    });
    expect(result.teamPool[1]).toEqual({
      id: 'tm2',
      name: 'Bob',
      role: 'QA',
    });

    // Project-level assignments are gone (moved into reforecasts in v0.11.0)
    const proj = result.projects[0];
    expect((proj as unknown as Record<string, unknown>).assignments).toBeUndefined();
    // Baseline reforecast carries the assignments
    const baseline = proj.reforecasts[0];
    expect(baseline.assignments).toHaveLength(2);
    expect(baseline.assignments[0]).toEqual({
      id: 'tm1',
      poolMemberId: 'tm1',
    });
    expect(baseline.assignments[1]).toEqual({
      id: 'tm2',
      poolMemberId: 'tm2',
    });
    // teamMembers should be gone
    expect((proj as unknown as Record<string, unknown>).teamMembers).toBeUndefined();

    // hoursPerMonth should be stripped from settings
    expect((result.settings as unknown as Record<string, unknown>).hoursPerMonth).toBeUndefined();

    // v0.4.0 migration: actualCost moved into auto-created Baseline reforecast
    expect((proj as unknown as Record<string, unknown>).actualCost).toBeUndefined();
    expect(proj.reforecasts).toHaveLength(1);
    expect(proj.reforecasts[0].name).toBe('Baseline');
    expect(proj.reforecasts[0].actualCost).toBe(200000);
    expect(proj.activeReforecastId).toBe(proj.reforecasts[0].id);

    // v0.5.0 migration: baselineBudget moved to reforecast, reforecastDate added
    expect((proj as unknown as Record<string, unknown>).baselineBudget).toBeUndefined();
    expect(proj.reforecasts[0].baselineBudget).toBe(1000000);
    expect(proj.reforecasts[0].reforecastDate).toBeTruthy();

    // v0.6.0 migration: holidays added to settings
    expect(result.settings.holidays).toEqual([]);

    // v0.7.0 migration: trafficLightThresholds added to settings.
    // v0.13.0 migration: violetPercent backfilled.
    expect(result.settings.trafficLightThresholds).toEqual({
      amberPercent: 5,
      redPercent: 15,
      violetPercent: 20,
    });
  });

  it('migrates v0.2.0 to v0.3.0 (strips hoursPerMonth from settings)', () => {
    const v2Data = {
      version: '0.2.0',
      settings: {
        hoursPerMonth: 160,
        discountRateAnnual: 0.03,
        laborRates: [{ role: 'Dev', hourlyRate: 100 }],
      },
      teamPool: [{ id: 'pm1', name: 'Alice', role: 'Dev' }],
      projects: [],
    } as unknown as AppState;

    const result = runMigrations(v2Data, '0.2.0');

    expect(result.version).toBe('0.13.0');
    // hoursPerMonth should be removed
    expect((result.settings as unknown as Record<string, unknown>).hoursPerMonth).toBeUndefined();
    // Other settings preserved
    expect(result.settings.discountRateAnnual).toBe(0.03);
    expect(result.settings.laborRates).toEqual([{ role: 'Dev', hourlyRate: 100 }]);
    // Pool and projects unchanged
    expect(result.teamPool).toHaveLength(1);
  });

  it('migrates imported older data through runMigrations', () => {
    // Simulates the import flow: parse JSON → runMigrations → verify
    const importedData = {
      version: '1.0.0',
      settings: {
        hoursPerMonth: 140,
        discountRateAnnual: 0.05,
        laborRates: [{ role: 'Dev', hourlyRate: 100 }],
      },
      projects: [
        {
          id: 'p1',
          name: 'Imported Project',
          startDate: '2026-06',
          endDate: '2027-06',
          baselineBudget: 100000,
          actualCost: 5000,
          teamMembers: [
            { id: 'tm1', name: 'Alice', role: 'Dev', type: 'Core' },
          ],
          reforecasts: [],
          activeReforecastId: null,
        },
      ],
    } as unknown as AppState;

    const migrated = runMigrations(importedData, '1.0.0');

    expect(migrated.version).toBe('0.13.0');
    expect(migrated.teamPool).toHaveLength(1);
    expect(migrated.teamPool[0].name).toBe('Alice');
    expect((migrated.projects[0] as unknown as Record<string, unknown>).assignments).toBeUndefined();
    expect(migrated.projects[0].reforecasts[0].assignments).toHaveLength(1);
    expect(migrated.projects[0].reforecasts[0].assignments[0].poolMemberId).toBe('tm1');
    expect((migrated.projects[0] as unknown as Record<string, unknown>).teamMembers).toBeUndefined();
    // hoursPerMonth stripped
    expect((migrated.settings as unknown as Record<string, unknown>).hoursPerMonth).toBeUndefined();
    expect(migrated.settings.discountRateAnnual).toBe(0.05);

    // v0.4.0 migration: actualCost moved into auto-created Baseline reforecast
    expect((migrated.projects[0] as unknown as Record<string, unknown>).actualCost).toBeUndefined();
    expect(migrated.projects[0].reforecasts).toHaveLength(1);
    expect(migrated.projects[0].reforecasts[0].actualCost).toBe(5000);

    // v0.5.0 migration: baselineBudget moved to reforecast, reforecastDate added
    expect((migrated.projects[0] as unknown as Record<string, unknown>).baselineBudget).toBeUndefined();
    expect(migrated.projects[0].reforecasts[0].baselineBudget).toBe(100000);
    expect(migrated.projects[0].reforecasts[0].reforecastDate).toBeTruthy();
  });

  it('migrates v0.3.0 to v0.4.0 (moves actualCost into existing reforecasts)', () => {
    const v3Data = {
      version: '0.3.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
      },
      teamPool: [],
      projects: [
        {
          id: 'proj1',
          name: 'Project With Reforecasts',
          startDate: '2026-06-15',
          endDate: '2027-07-15',
          baselineBudget: 500000,
          actualCost: 75000,
          assignments: [{ id: 'a1', poolMemberId: 'pm1' }],
          reforecasts: [
            {
              id: 'rf_1',
              name: 'Baseline',
              createdAt: '2026-06-01T00:00:00Z',
              startDate: '2026-06',
              allocations: [],
              productivityWindows: [],
            },
            {
              id: 'rf_2',
              name: 'Q3 Reforecast',
              createdAt: '2026-09-01T00:00:00Z',
              startDate: '2026-09',
              allocations: [],
              productivityWindows: [],
            },
          ],
          activeReforecastId: 'rf_2',
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v3Data, '0.3.0');

    expect(result.version).toBe('0.13.0');
    const proj = result.projects[0];

    // actualCost should be removed from project level
    expect((proj as unknown as Record<string, unknown>).actualCost).toBeUndefined();

    // Active reforecast (rf_2) gets the project's actualCost
    expect(proj.reforecasts).toHaveLength(2);
    expect(proj.reforecasts[1].id).toBe('rf_2');
    expect(proj.reforecasts[1].actualCost).toBe(75000);

    // Non-active reforecast (rf_1) gets 0
    expect(proj.reforecasts[0].id).toBe('rf_1');
    expect(proj.reforecasts[0].actualCost).toBe(0);

    // activeReforecastId preserved
    expect(proj.activeReforecastId).toBe('rf_2');

    // v0.5.0 migration: baselineBudget moved to reforecast, reforecastDate added
    expect((proj as unknown as Record<string, unknown>).baselineBudget).toBeUndefined();
    expect(proj.reforecasts[0].baselineBudget).toBe(500000);
    expect(proj.reforecasts[1].baselineBudget).toBe(500000);
    expect(proj.reforecasts[0].reforecastDate).toBe('2026-06-01');
    expect(proj.reforecasts[1].reforecastDate).toBe('2026-09-01');
  });

  it('migrates v0.3.0 to v0.4.0 (creates Baseline for project without reforecasts)', () => {
    const v3Data = {
      version: '0.3.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
      },
      teamPool: [],
      projects: [
        {
          id: 'proj_no_rf',
          name: 'Project Without Reforecasts',
          startDate: '2026-06-15',
          endDate: '2027-07-15',
          baselineBudget: 500000,
          actualCost: 30000,
          assignments: [],
          reforecasts: [],
          activeReforecastId: null,
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v3Data, '0.3.0');

    expect(result.version).toBe('0.13.0');
    const proj = result.projects[0];

    // actualCost removed from project
    expect((proj as unknown as Record<string, unknown>).actualCost).toBeUndefined();

    // Baseline reforecast created with the project's actualCost
    expect(proj.reforecasts).toHaveLength(1);
    expect(proj.reforecasts[0].name).toBe('Baseline');
    expect(proj.reforecasts[0].actualCost).toBe(30000);
    expect(proj.reforecasts[0].startDate).toBe('2026-06');

    // activeReforecastId set to the new Baseline
    expect(proj.activeReforecastId).toBe(proj.reforecasts[0].id);

    // v0.5.0 migration: baselineBudget moved to reforecast, reforecastDate added
    expect((proj as unknown as Record<string, unknown>).baselineBudget).toBeUndefined();
    expect(proj.reforecasts[0].baselineBudget).toBe(500000);
    expect(proj.reforecasts[0].reforecastDate).toBeTruthy();
  });

  it('migrates v0.3.0 to v0.4.0 with null/undefined actualCost (defaults to 0)', () => {
    const v3Data = {
      version: '0.3.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
      },
      teamPool: [],
      projects: [
        {
          id: 'proj_null_ac',
          name: 'Null AC Project',
          startDate: '2026-06-15',
          endDate: '2027-07-15',
          baselineBudget: 100000,
          actualCost: null,
          assignments: [],
          reforecasts: [],
          activeReforecastId: null,
        },
        {
          id: 'proj_undef_ac',
          name: 'Undefined AC Project',
          startDate: '2026-06-15',
          endDate: '2027-07-15',
          baselineBudget: 100000,
          // actualCost intentionally omitted (undefined)
          assignments: [],
          reforecasts: [],
          activeReforecastId: null,
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v3Data, '0.3.0');

    // Both projects should get a Baseline reforecast with actualCost = 0
    for (const proj of result.projects) {
      expect(proj.reforecasts).toHaveLength(1);
      expect(proj.reforecasts[0].actualCost).toBe(0);
      expect((proj as unknown as Record<string, unknown>).actualCost).toBeUndefined();
    }
  });

  it('deduplicates pool members across projects', () => {
    const v1Data = {
      version: '1.0.0',
      settings: {
        hoursPerMonth: 160,
        discountRateAnnual: 0.03,
        laborRates: [],
      },
      projects: [
        {
          id: 'proj1',
          name: 'Project 1',
          startDate: '2026-06',
          endDate: '2027-06',
          baselineBudget: 500000,
          actualCost: 0,
          teamMembers: [
            { id: 'tm1', name: 'Alice', role: 'Dev', type: 'Core' },
          ],
          reforecasts: [],
          activeReforecastId: null,
        },
        {
          id: 'proj2',
          name: 'Project 2',
          startDate: '2026-06',
          endDate: '2027-06',
          baselineBudget: 500000,
          actualCost: 0,
          teamMembers: [
            { id: 'tm1', name: 'Alice', role: 'Dev', type: 'Core' },
            { id: 'tm3', name: 'Charlie', role: 'PM', type: 'Core' },
          ],
          reforecasts: [],
          activeReforecastId: null,
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v1Data, '1.0.0');

    // Pool should deduplicate by id — 2 unique members, not 3
    expect(result.teamPool).toHaveLength(2);
    expect(result.teamPool.map(m => m.id).sort()).toEqual(['tm1', 'tm3']);
  });

  it('migrates v0.4.0 to v0.5.0 (moves baselineBudget into reforecasts, adds reforecastDate)', () => {
    const v4Data = {
      version: '0.4.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
      },
      teamPool: [],
      projects: [
        {
          id: 'proj1',
          name: 'Budget Project',
          startDate: '2026-06-15',
          endDate: '2027-07-15',
          baselineBudget: 750000,
          assignments: [],
          reforecasts: [
            {
              id: 'rf_1',
              name: 'Baseline',
              createdAt: '2026-06-01T00:00:00Z',
              startDate: '2026-06',
              allocations: [],
              productivityWindows: [],
              actualCost: 10000,
            },
            {
              id: 'rf_2',
              name: 'Q3 Reforecast',
              createdAt: '2026-09-15T12:00:00Z',
              startDate: '2026-09',
              allocations: [],
              productivityWindows: [],
              actualCost: 50000,
            },
          ],
          activeReforecastId: 'rf_2',
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v4Data, '0.4.0');

    expect(result.version).toBe('0.13.0');
    const proj = result.projects[0];

    // baselineBudget removed from project level
    expect((proj as unknown as Record<string, unknown>).baselineBudget).toBeUndefined();

    // All reforecasts inherit the project's baselineBudget
    expect(proj.reforecasts[0].baselineBudget).toBe(750000);
    expect(proj.reforecasts[1].baselineBudget).toBe(750000);

    // reforecastDate derived from createdAt
    expect(proj.reforecasts[0].reforecastDate).toBe('2026-06-01');
    expect(proj.reforecasts[1].reforecastDate).toBe('2026-09-15');
  });

  it('migrates v0.4.0 to v0.5.0 with missing/undefined baselineBudget (defaults to 0)', () => {
    const v4Data = {
      version: '0.4.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
      },
      teamPool: [],
      projects: [
        {
          id: 'proj_no_bb',
          name: 'No Budget Project',
          startDate: '2026-06-15',
          endDate: '2027-07-15',
          // baselineBudget intentionally omitted
          assignments: [],
          reforecasts: [
            {
              id: 'rf_1',
              name: 'Baseline',
              createdAt: '2026-06-01T00:00:00Z',
              startDate: '2026-06',
              allocations: [],
              productivityWindows: [],
              actualCost: 0,
            },
          ],
          activeReforecastId: 'rf_1',
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v4Data, '0.4.0');

    expect(result.version).toBe('0.13.0');
    const proj = result.projects[0];

    // Missing baselineBudget defaults to 0
    expect(proj.reforecasts[0].baselineBudget).toBe(0);
    expect(proj.reforecasts[0].reforecastDate).toBe('2026-06-01');
  });

  it('migrates v0.4.0 to v0.5.0 with null baselineBudget (defaults to 0)', () => {
    const v4Data = {
      version: '0.4.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
      },
      teamPool: [],
      projects: [
        {
          id: 'proj_null_bb',
          name: 'Null Budget',
          startDate: '2026-06-15',
          endDate: '2027-07-15',
          baselineBudget: null,
          assignments: [],
          reforecasts: [
            {
              id: 'rf_1',
              name: 'Baseline',
              createdAt: '2026-06-01T00:00:00Z',
              startDate: '2026-06',
              allocations: [],
              productivityWindows: [],
              actualCost: 0,
            },
          ],
          activeReforecastId: 'rf_1',
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v4Data, '0.4.0');

    expect(result.version).toBe('0.13.0');
    expect(result.projects[0].reforecasts[0].baselineBudget).toBe(0);
  });

  it('migrates v0.4.0 to v0.5.0 with NaN/Infinity baselineBudget (defaults to 0)', () => {
    const v4Data = {
      version: '0.4.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
      },
      teamPool: [],
      projects: [
        {
          id: 'proj_nan_bb',
          name: 'NaN Budget',
          startDate: '2026-06-15',
          endDate: '2027-07-15',
          baselineBudget: NaN,
          assignments: [],
          reforecasts: [
            {
              id: 'rf_1',
              name: 'Baseline',
              createdAt: '2026-06-01T00:00:00Z',
              startDate: '2026-06',
              allocations: [],
              productivityWindows: [],
              actualCost: 0,
            },
          ],
          activeReforecastId: 'rf_1',
        },
        {
          id: 'proj_inf_bb',
          name: 'Infinity Budget',
          startDate: '2026-06-15',
          endDate: '2027-07-15',
          baselineBudget: Infinity,
          assignments: [],
          reforecasts: [
            {
              id: 'rf_2',
              name: 'Baseline',
              createdAt: '2026-06-01T00:00:00Z',
              startDate: '2026-06',
              allocations: [],
              productivityWindows: [],
              actualCost: 0,
            },
          ],
          activeReforecastId: 'rf_2',
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v4Data, '0.4.0');

    expect(result.version).toBe('0.13.0');
    expect(result.projects[0].reforecasts[0].baselineBudget).toBe(0);
    expect(result.projects[1].reforecasts[0].baselineBudget).toBe(0);
  });

  it('migrates v0.5.0 to v0.6.0 (adds holidays to settings)', () => {
    const v5Data = {
      version: '0.5.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [{ role: 'Dev', hourlyRate: 100 }],
      },
      teamPool: [],
      projects: [],
    } as unknown as AppState;

    const result = runMigrations(v5Data, '0.5.0');

    expect(result.version).toBe('0.13.0');
    expect(result.settings.holidays).toEqual([]);
    // Other settings preserved
    expect(result.settings.discountRateAnnual).toBe(0.03);
    expect(result.settings.laborRates).toEqual([{ role: 'Dev', hourlyRate: 100 }]);
  });

  it('migrates v0.5.0 to v0.6.0 preserving existing holidays if present', () => {
    const v5Data = {
      version: '0.5.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
        holidays: [
          { id: 'h1', name: 'Test', startDate: '2026-05-25', endDate: '2026-05-25' },
        ],
      },
      teamPool: [],
      projects: [],
    } as unknown as AppState;

    const result = runMigrations(v5Data, '0.5.0');

    expect(result.version).toBe('0.13.0');
    expect(result.settings.holidays).toHaveLength(1);
    expect(result.settings.holidays[0].name).toBe('Test');
  });

  it('migrates v0.4.0 to v0.5.0 with reforecast missing createdAt (uses today)', () => {
    const v4Data = {
      version: '0.4.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
      },
      teamPool: [],
      projects: [
        {
          id: 'proj_no_created',
          name: 'No CreatedAt',
          startDate: '2026-06-15',
          endDate: '2027-07-15',
          baselineBudget: 100000,
          assignments: [],
          reforecasts: [
            {
              id: 'rf_1',
              name: 'Baseline',
              // createdAt intentionally omitted
              startDate: '2026-06',
              allocations: [],
              productivityWindows: [],
              actualCost: 0,
            },
          ],
          activeReforecastId: 'rf_1',
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v4Data, '0.4.0');

    expect(result.version).toBe('0.13.0');
    const proj = result.projects[0];

    // reforecastDate falls back to today when createdAt is missing
    expect(proj.reforecasts[0].reforecastDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(proj.reforecasts[0].baselineBudget).toBe(100000);
  });

  it('migrates v0.6.0 to v0.7.0 (adds trafficLightThresholds to settings)', () => {
    const v6Data = {
      version: '0.6.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [{ role: 'Dev', hourlyRate: 100 }],
        holidays: [],
      },
      teamPool: [],
      projects: [],
    } as unknown as AppState;

    const result = runMigrations(v6Data, '0.6.0');

    expect(result.version).toBe('0.13.0');
    // v0.7.0 seeds defaults, v0.13.0 backfills violetPercent.
    expect(result.settings.trafficLightThresholds).toEqual({
      amberPercent: 5,
      redPercent: 15,
      violetPercent: 20,
    });
    // Other settings preserved
    expect(result.settings.discountRateAnnual).toBe(0.03);
    expect(result.settings.laborRates).toEqual([{ role: 'Dev', hourlyRate: 100 }]);
    expect(result.settings.holidays).toEqual([]);
  });

  it('migrates v0.6.0 to v0.7.0 preserving existing thresholds if present', () => {
    const v6Data = {
      version: '0.6.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
        holidays: [],
        trafficLightThresholds: { amberPercent: 10, redPercent: 20 },
      },
      teamPool: [],
      projects: [],
    } as unknown as AppState;

    const result = runMigrations(v6Data, '0.6.0');

    expect(result.version).toBe('0.13.0');
    // User customizations preserved through 0.7.0; 0.13.0 backfills violetPercent.
    expect(result.settings.trafficLightThresholds).toEqual({
      amberPercent: 10,
      redPercent: 20,
      violetPercent: 20,
    });
  });

  it('migrates v0.7.0 to v0.8.0 (backfills notes on all reforecasts)', () => {
    const v7Data = {
      version: '0.7.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
        holidays: [],
        trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
      },
      teamPool: [],
      projects: [
        {
          id: 'proj1',
          name: 'Project',
          startDate: '2026-06-15',
          endDate: '2027-07-15',
          assignments: [],
          reforecasts: [
            {
              id: 'rf_1',
              name: 'Baseline',
              createdAt: '2026-06-01T00:00:00Z',
              reforecastDate: '2026-06-01',
              startDate: '2026-06',
              allocations: [],
              productivityWindows: [],
              actualCost: 0,
              baselineBudget: 100000,
            },
            {
              id: 'rf_2',
              name: 'Q3',
              createdAt: '2026-09-01T00:00:00Z',
              reforecastDate: '2026-09-01',
              startDate: '2026-09',
              allocations: [],
              productivityWindows: [],
              actualCost: 10000,
              baselineBudget: 100000,
            },
          ],
          activeReforecastId: 'rf_1',
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v7Data, '0.7.0');

    expect(result.version).toBe('0.13.0');
    expect(result.projects[0].reforecasts[0].notes).toBe('');
    expect(result.projects[0].reforecasts[1].notes).toBe('');
  });

  it('v0.7.0 to v0.8.0 preserves existing notes if already present', () => {
    const v7Data = {
      version: '0.7.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
        holidays: [],
        trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
      },
      teamPool: [],
      projects: [
        {
          id: 'proj1',
          name: 'Project',
          startDate: '2026-06-15',
          endDate: '2027-07-15',
          assignments: [],
          reforecasts: [
            {
              id: 'rf_1',
              name: 'Baseline',
              createdAt: '2026-06-01T00:00:00Z',
              reforecastDate: '2026-06-01',
              startDate: '2026-06',
              allocations: [],
              productivityWindows: [],
              actualCost: 0,
              baselineBudget: 100000,
              notes: 'Scope change — added API work',
            },
          ],
          activeReforecastId: 'rf_1',
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v7Data, '0.7.0');

    expect(result.projects[0].reforecasts[0].notes).toBe('Scope change — added API work');
  });

  it('v0.9.0 to v0.10.0 strips useForHistory and scrapped scenario-source historicalCosts entries', () => {
    // Reproduces the actual pollution shape found in a user's localStorage
    // from an earlier (scrapped) v0.22.0 design attempt.
    const v9Data = {
      version: '0.9.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
        holidays: [],
        trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
      },
      teamPool: [],
      projects: [
        {
          id: 'proj1',
          name: 'Polluted Project',
          startDate: '2026-03-02',
          endDate: '2026-05-29',
          assignments: [],
          activeReforecastId: 'rf-march-30',
          reforecasts: [
            {
              id: 'rf-baseline',
              name: 'Baseline',
              createdAt: '2026-04-25T01:24:28.949Z',
              reforecastDate: '2026-04-25',
              startDate: '2026-03',
              allocations: [],
              productivityWindows: [],
              actualCost: 0,
              baselineBudget: 65000,
              notes: '',
              useForHistory: true,                  // dead-design field
              actualsThroughDate: '2026-03-02',
            },
            {
              id: 'rf-march-30',
              name: 'March 30',
              createdAt: '2026-04-25T12:37:43.289Z',
              reforecastDate: '2026-03-30',
              startDate: '2026-03',
              allocations: [],
              productivityWindows: [],
              actualCost: 20000,
              baselineBudget: 65000,
              notes: '',
              actualsThroughDate: '2026-03-28',
              historicalCosts: [
                {
                  month: '2026-03',
                  cost: 5000,
                  hours: 218.4,
                  source: 'scenario',                  // dead-design metadata
                  sourceScenarioId: 'rf-baseline',
                  sourceScenarioName: 'Baseline',
                  isManualOverride: true,
                },
              ],
            },
          ],
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v9Data, '0.9.0');

    expect(result.version).toBe('0.13.0');

    const baseline = result.projects[0].reforecasts[0];
    const march30 = result.projects[0].reforecasts[1];

    // useForHistory stripped
    expect((baseline as unknown as Record<string, unknown>).useForHistory).toBeUndefined();
    expect((march30 as unknown as Record<string, unknown>).useForHistory).toBeUndefined();

    // scenario-source entry dropped — historicalCosts field removed since
    // every entry on March 30 was scrapped-design auto-generated
    expect((march30 as unknown as Record<string, unknown>).historicalCosts).toBeUndefined();
  });

  it('v0.9.0 to v0.10.0 preserves user-entered historicalCosts entries (no source field)', () => {
    const v9Data = {
      version: '0.9.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
        holidays: [],
        trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
      },
      teamPool: [],
      projects: [
        {
          id: 'proj1',
          name: 'Mixed Project',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          assignments: [],
          activeReforecastId: 'rf-1',
          reforecasts: [
            {
              id: 'rf-1',
              name: 'Q1',
              createdAt: '2026-04-01T00:00:00Z',
              reforecastDate: '2026-04-01',
              startDate: '2026-01',
              allocations: [],
              productivityWindows: [],
              actualCost: 50000,
              baselineBudget: 100000,
              notes: '',
              actualsThroughDate: '2026-03-15',
              historicalCosts: [
                // Genuinely user-entered: no source field
                { month: '2026-01', cost: 10000, hours: 80 },
                // Scrapped-design auto-generated: dropped
                {
                  month: '2026-02',
                  cost: 9999,
                  hours: 0,
                  source: 'scenario',
                  isManualOverride: true,
                },
              ],
            },
          ],
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v9Data, '0.9.0');

    expect(result.version).toBe('0.13.0');
    const rf = result.projects[0].reforecasts[0];

    // User-entered Jan entry survives, normalized to {month, cost, hours}
    expect(rf.historicalCosts).toEqual([
      { month: '2026-01', cost: 10000, hours: 80 },
    ]);
  });

  it('v0.9.0 to v0.10.0 leaves clean reforecasts unchanged', () => {
    const v9Data = {
      version: '0.9.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
        holidays: [],
        trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
      },
      teamPool: [],
      projects: [
        {
          id: 'proj1',
          name: 'Clean',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          assignments: [],
          activeReforecastId: 'rf-1',
          reforecasts: [
            {
              id: 'rf-1',
              name: 'Baseline',
              createdAt: '2026-01-01T00:00:00Z',
              reforecastDate: '2026-01-01',
              startDate: '2026-01',
              allocations: [],
              productivityWindows: [],
              actualCost: 0,
              baselineBudget: 50000,
              notes: '',
            },
          ],
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v9Data, '0.9.0');
    expect(result.version).toBe('0.13.0');
    // v0.11.0 migration adds an empty `assignments` array to each reforecast.
    expect(result.projects[0].reforecasts[0]).toEqual({
      ...v9Data.projects[0].reforecasts[0],
      assignments: [],
    });
  });

  it('v0.7.0 to v0.8.0 coerces non-string notes to empty string', () => {
    const v7Data = {
      version: '0.7.0',
      settings: {
        discountRateAnnual: 0.03,
        laborRates: [],
        holidays: [],
        trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
      },
      teamPool: [],
      projects: [
        {
          id: 'proj1',
          name: 'Project',
          startDate: '2026-06-15',
          endDate: '2027-07-15',
          assignments: [],
          reforecasts: [
            {
              id: 'rf_1',
              name: 'Baseline',
              createdAt: '2026-06-01T00:00:00Z',
              reforecastDate: '2026-06-01',
              startDate: '2026-06',
              allocations: [],
              productivityWindows: [],
              actualCost: 0,
              baselineBudget: 100000,
              notes: 12345,
            },
          ],
          activeReforecastId: 'rf_1',
        },
      ],
    } as unknown as AppState;

    const result = runMigrations(v7Data, '0.7.0');

    expect(result.projects[0].reforecasts[0].notes).toBe('');
  });

  describe('v0.10.0 to v0.11.0 (assignments → Reforecast)', () => {
    it('copies project-level assignments to every reforecast (same IDs)', () => {
      const v10Data = {
        version: '0.10.0',
        settings: {
          discountRateAnnual: 0.03,
          laborRates: [],
          holidays: [],
          trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
        },
        teamPool: [],
        projects: [
          {
            id: 'p1',
            name: 'Project',
            startDate: '2026-06-15',
            endDate: '2027-07-15',
            assignments: [
              { id: 'a1', poolMemberId: 'pm1' },
              { id: 'a2', poolMemberId: 'pm2' },
            ],
            reforecasts: [
              {
                id: 'rf_old',
                name: 'Baseline',
                createdAt: '2026-06-01T00:00:00Z',
                reforecastDate: '2026-06-01',
                startDate: '2026-06',
                allocations: [{ memberId: 'a1', month: '2026-06', allocation: 0.5 }],
                productivityWindows: [],
                actualCost: 1000,
                baselineBudget: 500000,
              },
              {
                id: 'rf_new',
                name: 'Q3',
                createdAt: '2026-09-01T00:00:00Z',
                reforecastDate: '2026-09-01',
                startDate: '2026-06',
                allocations: [{ memberId: 'a2', month: '2026-09', allocation: 0.75 }],
                productivityWindows: [],
                actualCost: 5000,
                baselineBudget: 500000,
              },
            ],
            activeReforecastId: 'rf_new',
          },
        ],
      } as unknown as AppState;

      const result = runMigrations(v10Data, '0.10.0');

      expect(result.version).toBe('0.13.0');
      const proj = result.projects[0];
      expect((proj as unknown as Record<string, unknown>).assignments).toBeUndefined();
      expect(proj.reforecasts[0].assignments).toEqual([
        { id: 'a1', poolMemberId: 'pm1' },
        { id: 'a2', poolMemberId: 'pm2' },
      ]);
      expect(proj.reforecasts[1].assignments).toEqual([
        { id: 'a1', poolMemberId: 'pm1' },
        { id: 'a2', poolMemberId: 'pm2' },
      ]);
      // Distinct array references — mutating one does not affect the other
      expect(proj.reforecasts[0].assignments).not.toBe(proj.reforecasts[1].assignments);
      // Allocations still resolve against assignment IDs
      const oldRf = proj.reforecasts[0];
      const oldAssignmentIds = new Set(oldRf.assignments.map((a) => a.id));
      expect(oldRf.allocations.every((a) => oldAssignmentIds.has(a.memberId))).toBe(true);
    });

    it('handles project with empty assignments array', () => {
      const v10Data = {
        version: '0.10.0',
        settings: {
          discountRateAnnual: 0.03,
          laborRates: [],
          holidays: [],
          trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
        },
        teamPool: [],
        projects: [
          {
            id: 'p1',
            name: 'P',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            assignments: [],
            reforecasts: [
              {
                id: 'rf1',
                name: 'Baseline',
                createdAt: '2026-01-01T00:00:00Z',
                reforecastDate: '2026-01-01',
                startDate: '2026-01',
                allocations: [],
                productivityWindows: [],
                actualCost: 0,
                baselineBudget: 0,
              },
            ],
            activeReforecastId: 'rf1',
          },
        ],
      } as unknown as AppState;

      const result = runMigrations(v10Data, '0.10.0');

      expect(result.version).toBe('0.13.0');
      expect(result.projects[0].reforecasts[0].assignments).toEqual([]);
    });

    it('handles project missing assignments key entirely', () => {
      const v10Data = {
        version: '0.10.0',
        settings: {
          discountRateAnnual: 0.03,
          laborRates: [],
          holidays: [],
          trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
        },
        teamPool: [],
        projects: [
          {
            id: 'p1',
            name: 'P',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            reforecasts: [
              {
                id: 'rf1',
                name: 'Baseline',
                createdAt: '2026-01-01T00:00:00Z',
                reforecastDate: '2026-01-01',
                startDate: '2026-01',
                allocations: [],
                productivityWindows: [],
                actualCost: 0,
                baselineBudget: 0,
              },
            ],
            activeReforecastId: 'rf1',
          },
        ],
      } as unknown as AppState;

      const result = runMigrations(v10Data, '0.10.0');

      expect(result.version).toBe('0.13.0');
      expect(result.projects[0].reforecasts[0].assignments).toEqual([]);
    });

    it('idempotent: reforecast that already has its own assignments is preserved', () => {
      const v10Data = {
        version: '0.10.0',
        settings: {
          discountRateAnnual: 0.03,
          laborRates: [],
          holidays: [],
          trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
        },
        teamPool: [],
        projects: [
          {
            id: 'p1',
            name: 'P',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            assignments: [{ id: 'a1', poolMemberId: 'pm1' }],
            reforecasts: [
              {
                id: 'rf1',
                name: 'Baseline',
                createdAt: '2026-01-01T00:00:00Z',
                reforecastDate: '2026-01-01',
                startDate: '2026-01',
                assignments: [{ id: 'a99', poolMemberId: 'pm99' }],
                allocations: [],
                productivityWindows: [],
                actualCost: 0,
                baselineBudget: 0,
              },
            ],
            activeReforecastId: 'rf1',
          },
        ],
      } as unknown as AppState;

      const result = runMigrations(v10Data, '0.10.0');

      expect(result.version).toBe('0.13.0');
      // Existing per-reforecast assignments win
      expect(result.projects[0].reforecasts[0].assignments).toEqual([
        { id: 'a99', poolMemberId: 'pm99' },
      ]);
    });
  });

  describe('v0.11.0 to v0.12.0 (PoolMember.archived optional field)', () => {
    function makeV11(): unknown {
      return {
        version: '0.11.0',
        settings: {
          discountRateAnnual: 0.03,
          laborRates: [],
          holidays: [],
          trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
        },
        teamPool: [
          { id: 'pm-1', name: 'Alice', role: 'BA' },
          { id: 'pm-2', name: 'Bob', role: 'IT-SoftEng' },
        ],
        projects: [
          {
            id: 'p1',
            name: 'Project One',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            activeReforecastId: 'rf-1',
            reforecasts: [
              {
                id: 'rf-1',
                name: 'Baseline',
                createdAt: '2026-01-01T00:00:00Z',
                startDate: '2026-01',
                reforecastDate: '2026-01-01',
                assignments: [{ id: 'a-1', poolMemberId: 'pm-1' }],
                allocations: [],
                productivityWindows: [],
                actualCost: 0,
                baselineBudget: 100000,
              },
            ],
          },
        ],
      };
    }

    it('migrates v0.11.0 → v0.12.0 as a no-op for teamPool/projects (post-0.13.0 settings gain violetPercent)', () => {
      const v11Data = makeV11();
      const result = runMigrations(v11Data as never, '0.11.0');

      expect(result.version).toBe('0.13.0');
      expect(result.teamPool).toEqual([
        { id: 'pm-1', name: 'Alice', role: 'BA' },
        { id: 'pm-2', name: 'Bob', role: 'IT-SoftEng' },
      ]);
      expect(result.projects).toEqual((v11Data as { projects: unknown }).projects);
      // Settings preserved EXCEPT trafficLightThresholds gains violetPercent: 20 from the 0.13.0 migration.
      const v11Settings = (v11Data as { settings: { trafficLightThresholds: object } }).settings;
      expect(result.settings).toEqual({
        ...v11Settings,
        trafficLightThresholds: { ...v11Settings.trafficLightThresholds, violetPercent: 20 },
      });
    });

    it('migrates v0.12.0 forward to 0.13.0 (adds violetPercent to settings)', () => {
      const v12Data = { ...(makeV11() as object), version: '0.12.0' } as {
        version: string;
        settings: { trafficLightThresholds: object };
      };
      const result = runMigrations(v12Data as never, '0.12.0');

      expect(result.version).toBe('0.13.0');
      expect(result.settings.trafficLightThresholds).toEqual({
        amberPercent: 5,
        redPercent: 15,
        violetPercent: 20,
      });
    });
  });

  describe('v0.12.0 to v0.13.0 (adds violetPercent to trafficLightThresholds)', () => {
    function makeV12(): unknown {
      return {
        version: '0.12.0',
        settings: {
          discountRateAnnual: 0.03,
          laborRates: [],
          holidays: [],
          trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
        },
        teamPool: [],
        projects: [],
      };
    }

    it('backfills violetPercent: 20 when missing', () => {
      const data = makeV12();
      const result = runMigrations(data as never, '0.12.0');
      expect(result.version).toBe('0.13.0');
      expect(result.settings.trafficLightThresholds).toEqual({
        amberPercent: 5,
        redPercent: 15,
        violetPercent: 20,
      });
    });

    it('preserves a user-customized violetPercent if already present', () => {
      const data = makeV12() as { settings: { trafficLightThresholds: Record<string, number> } };
      data.settings.trafficLightThresholds.violetPercent = 35;
      const result = runMigrations(data as never, '0.12.0');
      expect(result.settings.trafficLightThresholds.violetPercent).toBe(35);
    });

    it('does not clobber existing amberPercent or redPercent', () => {
      const data = makeV12() as { settings: { trafficLightThresholds: Record<string, number> } };
      data.settings.trafficLightThresholds = { amberPercent: 8, redPercent: 22 };
      const result = runMigrations(data as never, '0.12.0');
      expect(result.settings.trafficLightThresholds).toEqual({
        amberPercent: 8,
        redPercent: 22,
        violetPercent: 20,
      });
    });
  });
});
