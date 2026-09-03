// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Team Pool page — the settings-loading window (v0.37.6).
 *
 * ⚠️ THIS FILE EXISTS FOR ONE EXPRESSION. `team/page.tsx` passes
 * `laborRates={settings?.laborRates}` to two components, and the whole point is that it
 * is NOT `?? []`. Nothing at the component level can hold that: `RoleSelect`'s own tests
 * pass `undefined` directly, so they stay green no matter what the page collapses it to.
 * Only a test that renders the real page with the real expression can fail when someone
 * "tidies" the optional chain back into a default.
 *
 * ⚠️ THE PAIR IS THE INSTRUMENT. A test that only checks the loading case passes under
 * both the correct implementation and the naive one for different reasons; a test that
 * only checks the empty case passes under both outright. The two together discriminate.
 *
 * ⚠️ Why the loading window is reachable at all: the page's `if (loading)` gate reads
 * `useTeamPool`'s flag and DISCARDS `useSettings`' (`page.tsx:25`), so the table renders
 * as soon as the pool resolves — while `settings` may still be null. The two hooks issue
 * independent `await repository.*()` calls and nothing orders them.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Settings, PoolMember } from '@/types/domain';
import TeamPoolPage from '../page';

const pool: PoolMember[] = [{ id: 'pm-1', name: 'Grace Kim', role: 'Data Engineer' }];

const teamPoolValue = {
  pool,
  loading: false,
  addPoolMember: vi.fn(),
  updatePoolMember: vi.fn(),
  archivePoolMember: vi.fn(),
  unarchivePoolMember: vi.fn(),
  deletePoolMember: vi.fn(),
  flush: vi.fn(),
};

let settingsValue: { settings: Settings | null } = { settings: null };

vi.mock('@/features/team/hooks/useTeamPool', () => ({
  useTeamPool: () => teamPoolValue,
}));
vi.mock('@/features/settings/hooks/useSettings', () => ({
  useSettings: () => settingsValue,
}));

function buildSettings(laborRates: Settings['laborRates']): Settings {
  return {
    discountRateAnnual: 0.03,
    laborRates,
    holidays: [],
    trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
  };
}

/** The member's row select only exists once Edit is clicked — non-editing rows are text. */
function startEditingGrace() {
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
}

describe('TeamPoolPage — labor rates while settings are still loading', () => {
  beforeEach(() => {
    settingsValue = { settings: null };
  });

  it('marks NOTHING as "(rate removed)" while settings are unresolved', () => {
    // The pool has resolved (loading: false) but settings has not. Collapsing that to []
    // would tell every select the role has no rate — a claim, not an absence.
    settingsValue = { settings: null };
    render(<TeamPoolPage />);
    startEditingGrace();

    expect(screen.queryByText(/rate removed/)).toBeNull();
  });

  it('DOES mark a role removed once settings load and the rate genuinely is absent', () => {
    settingsValue = { settings: buildSettings([{ role: 'BA', hourlyRate: 75 }]) };
    render(<TeamPoolPage />);
    startEditingGrace();

    expect(screen.getByText(/Data Engineer \(rate removed\)/)).toBeDefined();
  });

  it('does not mark a role whose rate exists', () => {
    settingsValue = {
      settings: buildSettings([{ role: 'Data Engineer', hourlyRate: 120 }]),
    };
    render(<TeamPoolPage />);
    startEditingGrace();

    expect(screen.queryByText(/rate removed/)).toBeNull();
  });

  it('renders the member row as plain text before Edit is clicked', () => {
    // Pins the fact that made the passive case unreachable: a non-editing row has no
    // select at all, so no marker can appear on it whatever laborRates holds.
    settingsValue = { settings: null };
    render(<TeamPoolPage />);

    expect(screen.getByText('Data Engineer')).toBeDefined();
    expect(screen.queryByRole('combobox', { name: /Data Engineer/ })).toBeNull();
    expect(screen.queryByText(/rate removed/)).toBeNull();
  });
});
