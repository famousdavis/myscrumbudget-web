import { describe, it, expect } from 'vitest';
import { runMigrations, DATA_VERSION } from '../migrations';
import type { AppState } from '@/types/domain';

function makeAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    version: '0.5.0',
    settings: {
      discountRateAnnual: 0.03,
      laborRates: [],
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
    const data = makeAppState({ version: '0.5.0' });
    const result = runMigrations(data, '0.5.0');
    expect(result).toEqual(data);
  });

  it('exports current version constant', () => {
    expect(DATA_VERSION).toBe('0.5.0');
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
    expect(result.version).toBe('0.5.0');

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

    // Project should have assignments instead of teamMembers
    const proj = result.projects[0];
    expect(proj.assignments).toHaveLength(2);
    expect(proj.assignments[0]).toEqual({
      id: 'tm1',
      poolMemberId: 'tm1',
    });
    expect(proj.assignments[1]).toEqual({
      id: 'tm2',
      poolMemberId: 'tm2',
    });
    // teamMembers should be gone
    expect((proj as Record<string, unknown>).teamMembers).toBeUndefined();

    // hoursPerMonth should be stripped from settings
    expect((result.settings as Record<string, unknown>).hoursPerMonth).toBeUndefined();

    // v0.4.0 migration: actualCost moved into auto-created Baseline reforecast
    expect((proj as Record<string, unknown>).actualCost).toBeUndefined();
    expect(proj.reforecasts).toHaveLength(1);
    expect(proj.reforecasts[0].name).toBe('Baseline');
    expect(proj.reforecasts[0].actualCost).toBe(200000);
    expect(proj.activeReforecastId).toBe(proj.reforecasts[0].id);

    // v0.5.0 migration: baselineBudget moved to reforecast, reforecastDate added
    expect((proj as Record<string, unknown>).baselineBudget).toBeUndefined();
    expect(proj.reforecasts[0].baselineBudget).toBe(1000000);
    expect(proj.reforecasts[0].reforecastDate).toBeTruthy();
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

    expect(result.version).toBe('0.5.0');
    // hoursPerMonth should be removed
    expect((result.settings as Record<string, unknown>).hoursPerMonth).toBeUndefined();
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

    expect(migrated.version).toBe('0.5.0');
    expect(migrated.teamPool).toHaveLength(1);
    expect(migrated.teamPool[0].name).toBe('Alice');
    expect(migrated.projects[0].assignments).toHaveLength(1);
    expect(migrated.projects[0].assignments[0].poolMemberId).toBe('tm1');
    expect((migrated.projects[0] as Record<string, unknown>).teamMembers).toBeUndefined();
    // hoursPerMonth stripped
    expect((migrated.settings as Record<string, unknown>).hoursPerMonth).toBeUndefined();
    expect(migrated.settings.discountRateAnnual).toBe(0.05);

    // v0.4.0 migration: actualCost moved into auto-created Baseline reforecast
    expect((migrated.projects[0] as Record<string, unknown>).actualCost).toBeUndefined();
    expect(migrated.projects[0].reforecasts).toHaveLength(1);
    expect(migrated.projects[0].reforecasts[0].actualCost).toBe(5000);

    // v0.5.0 migration: baselineBudget moved to reforecast, reforecastDate added
    expect((migrated.projects[0] as Record<string, unknown>).baselineBudget).toBeUndefined();
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

    expect(result.version).toBe('0.5.0');
    const proj = result.projects[0];

    // actualCost should be removed from project level
    expect((proj as Record<string, unknown>).actualCost).toBeUndefined();

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
    expect((proj as Record<string, unknown>).baselineBudget).toBeUndefined();
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

    expect(result.version).toBe('0.5.0');
    const proj = result.projects[0];

    // actualCost removed from project
    expect((proj as Record<string, unknown>).actualCost).toBeUndefined();

    // Baseline reforecast created with the project's actualCost
    expect(proj.reforecasts).toHaveLength(1);
    expect(proj.reforecasts[0].name).toBe('Baseline');
    expect(proj.reforecasts[0].actualCost).toBe(30000);
    expect(proj.reforecasts[0].startDate).toBe('2026-06');

    // activeReforecastId set to the new Baseline
    expect(proj.activeReforecastId).toBe(proj.reforecasts[0].id);

    // v0.5.0 migration: baselineBudget moved to reforecast, reforecastDate added
    expect((proj as Record<string, unknown>).baselineBudget).toBeUndefined();
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
      expect((proj as Record<string, unknown>).actualCost).toBeUndefined();
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

    expect(result.version).toBe('0.5.0');
    const proj = result.projects[0];

    // baselineBudget removed from project level
    expect((proj as Record<string, unknown>).baselineBudget).toBeUndefined();

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

    expect(result.version).toBe('0.5.0');
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

    expect(result.version).toBe('0.5.0');
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

    expect(result.version).toBe('0.5.0');
    expect(result.projects[0].reforecasts[0].baselineBudget).toBe(0);
    expect(result.projects[1].reforecasts[0].baselineBudget).toBe(0);
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

    expect(result.version).toBe('0.5.0');
    const proj = result.projects[0];

    // reforecastDate falls back to today when createdAt is missing
    expect(proj.reforecasts[0].reforecastDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(proj.reforecasts[0].baselineBudget).toBe(100000);
  });
});
