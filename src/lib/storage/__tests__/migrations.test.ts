import { describe, it, expect } from 'vitest';
import { runMigrations, CURRENT_VERSION } from '../migrations';
import type { AppState } from '@/types/domain';

function makeAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    version: '1.0.0',
    settings: {
      hoursPerMonth: 160,
      discountRateAnnual: 0.03,
      laborRates: [],
    },
    projects: [],
    ...overrides,
  };
}

describe('Migrations', () => {
  it('returns data unchanged when already at current version', () => {
    const data = makeAppState();
    const result = runMigrations(data, CURRENT_VERSION);
    expect(result).toEqual(data);
  });

  it('returns data unchanged when no migrations are pending', () => {
    const data = makeAppState({ version: '1.0.0' });
    const result = runMigrations(data, '1.0.0');
    expect(result).toEqual(data);
  });

  it('exports current version constant', () => {
    expect(CURRENT_VERSION).toBe('1.0.0');
  });
});
