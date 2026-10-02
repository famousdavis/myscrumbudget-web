// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * v0.44.0 — the Actual Cost tile says whether spending is under, on or over
 * the plan for the elapsed period, whenever an Actuals Through date is set.
 *
 * The planned figure comes from the calc engine (metrics.plannedCostToDate);
 * these tests cover the tile's wording, markers and hover detail. The "no
 * line" tests are pure absences — true of a tile that never renders the line
 * at all — so they sit beside the positive renders that would fail if it did
 * not exist. All are [FALSIFY-AFTER]: v0.43.0 has no such line.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectSummary } from '../ProjectSummary';
import type { Project, ProjectMetrics, Reforecast } from '@/types/domain';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

function reforecast(actualsThroughDate?: string): Reforecast {
  return {
    id: 'rf1',
    name: 'Week 2',
    createdAt: '2026-10-02T00:00:00Z',
    startDate: '2026-10-19',
    endDate: '2027-02-22',
    reforecastDate: '2026-10-02',
    actualsThroughDate,
    assignments: [],
    allocations: [],
    productivityWindows: [],
    actualCost: 30_000,
    baselineBudget: 254_633,
  };
}

function metrics(plannedCostToDate: number | null): ProjectMetrics {
  return {
    etc: 207_104,
    eac: 237_104,
    variance: -17_529,
    variancePercent: -6.88,
    budgetRatio: 1.07,
    weeklyBurnRate: 16_180,
    npv: 205_000,
    totalHours: 2_201.6,
    monthlyData: [],
    plannedCostToDate,
  };
}

const PROJECT: Project = {
  id: 'p1',
  name: 'Test',
  startDate: '2026-10-19',
  endDate: '2027-02-22',
  reforecasts: [],
  activeReforecastId: 'rf1',
};

function renderTile(actualCost: number, planned: number | null, actualsThroughDate: string | undefined = '2026-10-31', withMetrics = true) {
  return render(
    <ProjectSummary
      project={PROJECT}
      activeReforecast={reforecast(actualsThroughDate)}
      metrics={withMetrics ? metrics(planned) : null}
      actualCost={actualCost}
      baselineBudget={254_633}
    />,
  );
}

describe('Actual Cost tile — spend to date', () => {
  it('[FALSIFY-AFTER] reports spending under plan, with the planned figure on hover', () => {
    renderTile(30_000, 32_360);
    const line = screen.getByText('$2,360 under plan');
    expect(line.textContent).toContain('▼');
    expect(line.getAttribute('title')).toBe('Planned through Oct 31, 2026: $32,360 · Actual: $30,000 · 7.3% under');
  });

  it('[FALSIFY-AFTER] reports spending over plan', () => {
    renderTile(34_000, 32_360);
    const line = screen.getByText('$1,640 over plan');
    expect(line.textContent).toContain('▲');
    expect(line.getAttribute('title')).toBe('Planned through Oct 31, 2026: $32,360 · Actual: $34,000 · 5.1% over');
  });

  it('[FALSIFY-AFTER] says "On plan" when the difference rounds to $0', () => {
    renderTile(32_360, 32_360);
    const line = screen.getByText('On plan');
    expect(line.getAttribute('title')).toBe('Planned through Oct 31, 2026: $32,360 · Actual: $32,360');
  });

  it('[FALSIFY-AFTER] shows no line without an Actuals Through date, or while metrics are unavailable', () => {
    // Paired with the renders above: each of those fails if the line is absent.
    renderTile(30_000, null, undefined).unmount();
    expect(screen.queryByText(/plan$/)).toBeNull();
    renderTile(30_000, 32_360, '2026-10-31', false);
    expect(screen.queryByText(/plan$/)).toBeNull();
  });
});
