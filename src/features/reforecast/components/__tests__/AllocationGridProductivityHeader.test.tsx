// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * v0.43.0 — the amber productivity figure under a month in the allocation grid
 * is the factor the calc engine APPLIED, read from its monthly breakdown.
 *
 * Until v0.43.0 the header computed its own calendar-day average from the
 * windows, so it could disagree with the numbers beside it: a 0% window over
 * Thanksgiving week showed "83%" in November while the engine applied the
 * holiday and then the window on top. These renders drive the REAL engine into
 * the REAL grid, so the chain engine → grid → header is what is tested, not a
 * hand-built factor.
 *
 * The no-figure assertion for the redundant window is a pure absence — true of
 * a header that shows nothing at all — so it lives in the same test as the
 * window-alone render, which fails if the figure is not wired through.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AllocationGrid } from '../AllocationGrid';
import { buildAllocationMap, calculateProjectMetrics } from '@/lib/calc';
import { formatMonthLabel } from '@/lib/utils/dates';
import type { Holiday, Project, ProductivityWindow, Settings, TeamMember } from '@/types/domain';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const MONTHS = ['2026-10', '2026-11', '2026-12'];
const TEAM: TeamMember[] = [{ id: 'a1', name: 'Dev 1', role: 'Dev' }];
const THANKSGIVING_WINDOW: ProductivityWindow = { id: 'w', startDate: '2026-11-23', endDate: '2026-11-27', factor: 0 };
const THANKSGIVING: Holiday = { id: 'h', name: 'Thanksgiving Week', startDate: '2026-11-23', endDate: '2026-11-27' };

function project(): Project {
  return {
    id: 'p1',
    name: 'Test',
    startDate: '2026-10-19',
    endDate: '2026-12-18',
    activeReforecastId: 'rf1',
    reforecasts: [{
      id: 'rf1',
      name: 'Baseline',
      createdAt: '2026-10-02T00:00:00Z',
      startDate: '2026-10-19',
      endDate: '2026-12-18',
      reforecastDate: '2026-10-02',
      assignments: [{ id: 'a1', poolMemberId: 'pm1' }],
      allocations: MONTHS.map((month) => ({ memberId: 'a1', month, allocation: 1 })),
      productivityWindows: [THANKSGIVING_WINDOW],
      actualCost: 0,
      baselineBudget: 100_000,
    }],
  };
}

function settings(holidays: Holiday[]): Settings {
  return {
    discountRateAnnual: 0.03,
    laborRates: [{ role: 'Dev', hourlyRate: 100 }],
    holidays,
    trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
  };
}

function renderGrid(holidays: Holiday[] | null) {
  const p = project();
  const monthlyData = holidays === null
    ? undefined
    : calculateProjectMetrics(p, settings(holidays), TEAM).monthlyData;
  return render(
    <AllocationGrid
      months={MONTHS}
      teamMembers={TEAM}
      allocationMap={buildAllocationMap(p.reforecasts[0].allocations)}
      onAllocationChange={vi.fn()}
      onAllocationsChange={vi.fn()}
      monthlyData={monthlyData}
    />,
  );
}

function monthHeader(month: string): HTMLElement {
  const label = formatMonthLabel(month);
  const header = screen.getAllByRole('columnheader').find((th) => within(th).queryByText(label));
  if (!header) throw new Error(`no column header for ${label}`);
  return header;
}

describe('allocation grid month header — productivity figure', () => {
  it('[FALSIFY-AFTER] shows the factor the engine applied, and nothing for a window that only covers holidays', () => {
    // Window alone, no holidays: 16 of November's 21 working days remain → 76%.
    const alone = renderGrid([]);
    expect(monthHeader('2026-11').textContent, 'window alone: November').toContain('76%');
    expect(monthHeader('2026-11').getAttribute('title')).toBe('Productivity: 76% (reduced capacity)');
    expect(monthHeader('2026-10').textContent, 'window alone: October has no window').not.toMatch(/%/);
    alone.unmount();

    // The same window over a Thanksgiving holiday reduces no working day.
    const redundant = renderGrid([THANKSGIVING]);
    expect(monthHeader('2026-11').textContent, 'window over holidays only').not.toMatch(/%/);
    expect(monthHeader('2026-11').getAttribute('title')).toBeNull();
    redundant.unmount();
  });

  it('shows no figure while metrics are unavailable', () => {
    renderGrid(null);
    for (const month of MONTHS) {
      expect(monthHeader(month).textContent, month).not.toMatch(/%/);
    }
  });
});
