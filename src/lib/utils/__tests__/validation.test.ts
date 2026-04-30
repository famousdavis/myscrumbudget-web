// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { validateAppState } from '../validation';
import { REFORECAST_NOTES_MAX_LENGTH } from '@/lib/constants';

function makeState(notes: unknown) {
  return {
    version: '0.8.0',
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
        activeReforecastId: 'rf_1',
        reforecasts: [
          {
            id: 'rf_1',
            name: 'Baseline',
            createdAt: '2026-06-01T00:00:00Z',
            reforecastDate: '2026-06-01',
            startDate: '2026-06',
            assignments: [],
            allocations: [],
            productivityWindows: [],
            actualCost: 0,
            baselineBudget: 100000,
            ...(notes === undefined ? {} : { notes }),
          },
        ],
      },
    ],
  };
}

describe('validateAppState — reforecast notes', () => {
  it('accepts missing notes (backward compatible)', () => {
    const result = validateAppState(makeState(undefined));
    expect(result.valid).toBe(true);
  });

  it('accepts empty notes', () => {
    const result = validateAppState(makeState(''));
    expect(result.valid).toBe(true);
  });

  it('accepts valid notes under the cap', () => {
    const result = validateAppState(makeState('Scope expanded to include API work.'));
    expect(result.valid).toBe(true);
  });

  it('accepts notes exactly at the cap', () => {
    const result = validateAppState(makeState('x'.repeat(REFORECAST_NOTES_MAX_LENGTH)));
    expect(result.valid).toBe(true);
  });

  it('rejects non-string notes', () => {
    const result = validateAppState(makeState(12345));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('notes: expected string'))).toBe(true);
  });

  it('rejects notes over the cap', () => {
    const result = validateAppState(makeState('x'.repeat(REFORECAST_NOTES_MAX_LENGTH + 1)));
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes('exceeds max length')),
    ).toBe(true);
  });
});

function makeStateWithPoolMember(member: unknown) {
  return {
    version: '0.12.0',
    settings: {
      discountRateAnnual: 0.03,
      laborRates: [],
      holidays: [],
      trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
    },
    teamPool: [member],
    projects: [],
  };
}

describe('validateAppState — pool member archived flag', () => {
  it('accepts pool member with archived: true', () => {
    const result = validateAppState(
      makeStateWithPoolMember({ id: 'pm-1', name: 'Alice', role: 'BA', archived: true }),
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts pool member with archived: false', () => {
    const result = validateAppState(
      makeStateWithPoolMember({ id: 'pm-1', name: 'Alice', role: 'BA', archived: false }),
    );
    expect(result.valid).toBe(true);
  });

  it('accepts pool member with no archived field (back-compat)', () => {
    const result = validateAppState(
      makeStateWithPoolMember({ id: 'pm-1', name: 'Alice', role: 'BA' }),
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects pool member with non-boolean archived', () => {
    const result = validateAppState(
      makeStateWithPoolMember({ id: 'pm-1', name: 'Alice', role: 'BA', archived: 'yes' }),
    );
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.includes('archived') && e.includes('boolean'),
      ),
    ).toBe(true);
  });
});
