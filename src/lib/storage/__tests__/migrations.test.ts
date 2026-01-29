import { describe, it, expect } from 'vitest';
import { runMigrations, DATA_VERSION } from '../migrations';
import type { AppState } from '@/types/domain';

function makeAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    version: '0.2.0',
    settings: {
      hoursPerMonth: 160,
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
    const data = makeAppState({ version: '0.2.0' });
    const result = runMigrations(data, '0.2.0');
    expect(result).toEqual(data);
  });

  it('exports current version constant', () => {
    expect(DATA_VERSION).toBe('0.2.0');
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

    // Version should be bumped
    expect(result.version).toBe('0.2.0');

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

    expect(migrated.version).toBe('0.2.0');
    expect(migrated.teamPool).toHaveLength(1);
    expect(migrated.teamPool[0].name).toBe('Alice');
    expect(migrated.projects[0].assignments).toHaveLength(1);
    expect(migrated.projects[0].assignments[0].poolMemberId).toBe('tm1');
    expect((migrated.projects[0] as Record<string, unknown>).teamMembers).toBeUndefined();
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
});
