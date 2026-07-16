// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { sanitizeAppState } from '../sanitizeImport';
import type { AppState } from '@/types/domain';

function baseState(): AppState {
  return {
    version: '0.13.0',
    settings: {
      discountRateAnnual: 0.05,
      laborRates: [{ role: 'Dev', hourlyRate: 100 }],
      holidays: [],
      trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
    },
    teamPool: [{ id: 'p1', name: 'Alice', role: 'Dev' }],
    projects: [
      {
        id: 'proj1',
        name: 'Demo',
        startDate: '2026-06-01',
        endDate: '2026-12-31',
        activeReforecastId: 'rf1',
        reforecasts: [
          {
            id: 'rf1',
            name: 'Baseline',
            createdAt: '2026-05-01T00:00:00.000Z',
            startDate: '2026-06-01',
            endDate: '2026-12-31',
            reforecastDate: '2026-05-01',
            allocations: [{ memberId: 'a1', month: '2026-06', allocation: 0.5 }],
            assignments: [{ id: 'a1', poolMemberId: 'p1' }],
            productivityWindows: [],
            actualCost: 0,
            baselineBudget: 100000,
          },
        ],
      },
    ],
  };
}

describe('sanitizeAppState', () => {
  it('passes through a clean state with no unknown fields verbatim', () => {
    const clean = baseState();
    const out = sanitizeAppState(clean);
    expect(out).toEqual(clean);
  });

  it('preserves project color and archived through the strip pass, dropping unknown siblings', () => {
    const state = baseState();
    const tampered = {
      ...state,
      projects: [
        {
          ...state.projects[0],
          color: 'teal',
          archived: true,
          bogus: 'x',
        } as typeof state.projects[number] & { color: string; archived: boolean; bogus: unknown },
      ],
    } as unknown as AppState;
    const out = sanitizeAppState(tampered);
    const project = out.projects[0] as typeof out.projects[number] & {
      color?: unknown;
      archived?: unknown;
      bogus?: unknown;
    };
    expect(project.color).toBe('teal');
    expect(project.archived).toBe(true);
    expect(project.bogus).toBeUndefined();
  });

  it('strips unknown top-level fields (e.g. attacker-injected metadata)', () => {
    const dirty = { ...baseState(), _admin: true, secret: 'xxx' } as unknown as AppState;
    const out = sanitizeAppState(dirty) as AppState & { _admin?: unknown; secret?: unknown };
    expect(out._admin).toBeUndefined();
    expect(out.secret).toBeUndefined();
    expect(out.version).toBe('0.13.0');
  });

  it('strips injected `members` and `owner` from project payloads', () => {
    const state = baseState();
    const tampered = {
      ...state,
      projects: [
        {
          ...state.projects[0],
          members: { 'victim-uid': 'owner' },
          owner: 'attacker-uid',
        } as typeof state.projects[number] & { members: unknown; owner: unknown },
      ],
    } as unknown as AppState;
    const out = sanitizeAppState(tampered);
    const project = out.projects[0] as typeof out.projects[number] & {
      members?: unknown;
      owner?: unknown;
    };
    expect(project.members).toBeUndefined();
    expect(project.owner).toBeUndefined();
    expect(project.id).toBe('proj1');
  });

  it('strips unknown fields nested inside reforecasts and allocations', () => {
    const state = baseState();
    const tampered = {
      ...state,
      projects: [
        {
          ...state.projects[0],
          reforecasts: [
            {
              ...state.projects[0].reforecasts[0],
              evilField: 'pwn',
              allocations: [
                { memberId: 'a1', month: '2026-06', allocation: 0.5, secret: 'x' },
              ],
            },
          ],
        },
      ],
    } as unknown as AppState;
    const out = sanitizeAppState(tampered);
    const rf = out.projects[0].reforecasts[0] as typeof out.projects[number]['reforecasts'][number] & {
      evilField?: unknown;
    };
    expect(rf.evilField).toBeUndefined();
    const alloc = rf.allocations[0] as typeof rf.allocations[number] & { secret?: unknown };
    expect(alloc.secret).toBeUndefined();
    expect(alloc.allocation).toBe(0.5);
  });

  it('strips unknown fields inside settings.laborRates, holidays, and trafficLightThresholds', () => {
    const state = baseState();
    const tampered = {
      ...state,
      settings: {
        ...state.settings,
        laborRates: [{ role: 'Dev', hourlyRate: 100, bonus: 999 }],
        holidays: [{ id: 'h1', name: 'NY', startDate: '2026-01-01', endDate: '2026-01-01', secret: 'x' }],
        trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20, hidden: 1 },
      },
    } as unknown as AppState;
    const out = sanitizeAppState(tampered);
    const rate = out.settings.laborRates[0] as typeof out.settings.laborRates[number] & { bonus?: unknown };
    expect(rate.bonus).toBeUndefined();
    const hol = out.settings.holidays[0] as typeof out.settings.holidays[number] & { secret?: unknown };
    expect(hol.secret).toBeUndefined();
    const tl = out.settings.trafficLightThresholds as typeof out.settings.trafficLightThresholds & {
      hidden?: unknown;
    };
    expect(tl.hidden).toBeUndefined();
  });

  it('preserves optional fields when present (actualsThroughDate, notes, historicalCosts)', () => {
    const state = baseState();
    state.projects[0].reforecasts[0].actualsThroughDate = '2026-07-15';
    state.projects[0].reforecasts[0].notes = 'Some narrative';
    state.projects[0].reforecasts[0].historicalCosts = [
      { month: '2026-06', cost: 5000, hours: 100 },
    ];
    const out = sanitizeAppState(state);
    const rf = out.projects[0].reforecasts[0];
    expect(rf.actualsThroughDate).toBe('2026-07-15');
    expect(rf.notes).toBe('Some narrative');
    expect(rf.historicalCosts).toEqual([{ month: '2026-06', cost: 5000, hours: 100 }]);
  });

  it('preserves optional AppState audit fields (_originRef, _changeLog) but drops unknown sibling keys', () => {
    const state = baseState();
    const tampered = {
      ...state,
      _originRef: 'origin-uid',
      _changeLog: [],
      _bogus: 'should-go',
    } as unknown as AppState;
    const out = sanitizeAppState(tampered) as AppState & { _bogus?: unknown };
    expect(out._originRef).toBe('origin-uid');
    expect(out._changeLog).toEqual([]);
    expect(out._bogus).toBeUndefined();
  });
});
