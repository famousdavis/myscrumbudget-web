// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * v0.44.0 — the printed report carries the spend-to-date comparison in its
 * Active Reforecast section, under the Actuals Through date it is measured
 * against. [FALSIFY-AFTER]: v0.43.0 prints neither row.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrintableReport } from '../PrintableReport';
import type { Project, ProjectMetrics, Reforecast } from '@/types/domain';

const PROJECT: Project = {
  id: 'p1',
  name: 'Test',
  startDate: '2026-10-19',
  endDate: '2027-02-22',
  reforecasts: [],
  activeReforecastId: 'rf1',
};

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

const METRICS: ProjectMetrics = {
  etc: 207_104,
  eac: 237_104,
  variance: -17_529,
  variancePercent: -6.88,
  budgetRatio: 1.07,
  weeklyBurnRate: 16_180,
  npv: 205_000,
  totalHours: 2_201.6,
  monthlyData: [],
  plannedCostToDate: 32_360,
};

function cellAfter(label: string): string | null | undefined {
  return screen.getByText(label).nextElementSibling?.textContent;
}

describe('PrintableReport — spend to date', () => {
  it('[FALSIFY-AFTER] prints the planned cost to date and the difference from it', () => {
    render(
      <PrintableReport
        project={PROJECT}
        activeReforecast={reforecast('2026-10-31')}
        metrics={METRICS}
        chartData={[]}
        baselineBudget={254_633}
        actualCost={30_000}
      />,
    );
    expect(cellAfter('Planned to Date')).toBe('$32,360');
    expect(cellAfter('Spend vs Plan')).toBe('-$2,360');
  });

  it('[FALSIFY-AFTER] prints neither row without an Actuals Through date', () => {
    // Paired with the test above, which fails if the rows never render.
    render(
      <PrintableReport
        project={PROJECT}
        activeReforecast={reforecast(undefined)}
        metrics={{ ...METRICS, plannedCostToDate: null }}
        chartData={[]}
        baselineBudget={254_633}
        actualCost={30_000}
      />,
    );
    expect(screen.queryByText('Planned to Date')).toBeNull();
    expect(screen.queryByText('Spend vs Plan')).toBeNull();
  });
});
