// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import type {
  Project,
  Reforecast,
  ProjectMetrics,
  TrafficLightStatus,
  TrafficLightThresholds,
} from '@/types/domain';
import type { ChartDataPoint } from '@/lib/utils/buildChartData';
import { MonthlyCostBarChart } from '@/components/charts/MonthlyCostBarChart';
import { CumulativeCostLineChart } from '@/components/charts/CumulativeCostLineChart';
import { CostByPeriodTable } from '@/components/CostByPeriodTable';
import {
  formatCurrency,
  formatNumber,
  formatPercentValue,
  formatDateLong,
  formatDateMedium,
} from '@/lib/utils/format';
import {
  getTrafficLightStatus,
  getTrafficLightDisplay,
  DEFAULT_THRESHOLDS,
} from '@/lib/calc';
import { APP_NAME, APP_VERSION } from '@/lib/constants';

// Light-only color classes for the RAG indicator. The print report is
// hidden on screen (display:none until print:block fires) so dark variants
// would never activate visibly anyway, but explicitly omitting them avoids
// any surprise if the cascade ever changes.
const RAG_PRINT_COLORS: Record<TrafficLightStatus, string> = {
  green: 'text-green-700',
  amber: 'text-amber-600',
  red: 'text-red-700',
  violet: 'text-violet-700',
};

const sectionHeading =
  'text-xs font-semibold uppercase tracking-wider text-zinc-500';
const labelCell = 'py-0.5 pr-3 align-top text-zinc-600';
const valueCell = 'py-0.5 text-right align-top font-medium text-zinc-900';

// Shared column widths for all three executive-summary tables. Five tracks
// — label-L, value-L, GAP, label-R, value-R — so each value sits directly
// next to its own label and the two label/value pairs are separated by a
// visible whitespace channel in the middle (rather than huge gaps between
// each label and its value). Each row therefore renders five <td>s with an
// empty spacer cell at index 2. With `table-fixed` on the parent table
// these widths are authoritative.
const SummaryColGroup = (
  <colgroup>
    <col style={{ width: '27%' }} />
    <col style={{ width: '14%' }} />
    <col style={{ width: '18%' }} />
    <col style={{ width: '27%' }} />
    <col style={{ width: '14%' }} />
  </colgroup>
);
const gapCell = '';

interface PrintableReportProps {
  project: Project;
  activeReforecast: Reforecast | null;
  metrics: ProjectMetrics | null;
  chartData: ChartDataPoint[];
  baselineBudget: number;
  actualCost: number;
  trafficLightThresholds?: TrafficLightThresholds;
}

export function PrintableReport({
  project,
  activeReforecast,
  metrics,
  chartData,
  baselineBudget,
  actualCost,
  trafficLightThresholds,
}: PrintableReportProps) {
  const trafficLightStatus = metrics
    ? getTrafficLightStatus(metrics, trafficLightThresholds ?? DEFAULT_THRESHOLDS)
    : null;
  const trafficLight = trafficLightStatus
    ? getTrafficLightDisplay(trafficLightStatus)
    : null;
  const ragColorClass = trafficLightStatus
    ? RAG_PRINT_COLORS[trafficLightStatus]
    : '';

  const notes = activeReforecast?.notes?.trim();
  const reforecastName = activeReforecast?.name ?? 'No reforecast';

  return (
    <section className="print-report hidden text-zinc-900 print:block">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="print-section-keep">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
          {APP_NAME}
          <sup className="ml-0.5 text-[8px] font-normal text-zinc-400">TM</sup>{' '}
          v{APP_VERSION}
        </p>
        <h1 className="mt-0.5 text-2xl font-bold leading-tight">{project.name}</h1>
        <p className="mt-0.5 text-sm text-zinc-700">
          {formatDateLong(activeReforecast?.startDate ?? project.startDate)} – {formatDateLong(activeReforecast?.endDate ?? project.endDate)}
        </p>
        <p className="text-xs text-zinc-600">
          Reforecast: {reforecastName} · Generated {new Date().toLocaleString()}
        </p>
        <hr className="mt-2 border-t border-zinc-300" />
      </header>

      {/* ── Status banner (large, colored) ──────────────────── */}
      {trafficLight && (
        <p className={`mt-3 text-base font-semibold ${ragColorClass}`}>
          <span aria-hidden="true">{trafficLight.indicator}</span>{' '}
          Status: {trafficLight.label}
        </p>
      )}

      {/* ── Project Summary (compact 2-pair) ─────────────────── */}
      <section className="print-section-keep mt-3">
        <h2 className={sectionHeading}>Project Summary</h2>
        <table className="mt-1 w-full table-fixed text-sm">
          {SummaryColGroup}
          <tbody>
            <tr>
              <td className={labelCell}>Start Date</td>
              <td className={valueCell}>{formatDateMedium(activeReforecast?.startDate ?? project.startDate)}</td>
              <td className={gapCell} aria-hidden="true" />
              <td className={labelCell}>End Date</td>
              <td className={valueCell}>{formatDateMedium(activeReforecast?.endDate ?? project.endDate)}</td>
            </tr>
            <tr>
              <td className={labelCell}>Baseline Budget</td>
              <td className={valueCell}>{formatCurrency(baselineBudget)}</td>
              <td className={gapCell} aria-hidden="true" />
              <td className={labelCell}>Actual Cost (AC)</td>
              <td className={valueCell}>{formatCurrency(actualCost)}</td>
            </tr>
            <tr>
              <td className={labelCell}>Est. to Complete (ETC)</td>
              <td className={valueCell}>
                {metrics ? formatCurrency(metrics.etc) : '—'}
              </td>
              <td className={gapCell} aria-hidden="true" />
              <td className={labelCell}>Est. at Completion (EAC)</td>
              <td className={`py-0.5 text-right align-top font-bold ${ragColorClass || 'text-zinc-900'}`}>
                {metrics ? formatCurrency(metrics.eac) : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Active Reforecast (compact 2-pair) ───────────────── */}
      {activeReforecast && (
        <section className="print-section-keep mt-3">
          <h2 className={sectionHeading}>Active Reforecast</h2>
          <table className="mt-1 w-full table-fixed text-sm">
            {SummaryColGroup}
            <tbody>
              <tr>
                <td className={labelCell}>Name</td>
                <td className={valueCell}>{activeReforecast.name}</td>
                <td className={gapCell} aria-hidden="true" />
                <td className={labelCell}>Reforecast Date</td>
                <td className={valueCell}>
                  {activeReforecast.reforecastDate
                    ? formatDateMedium(activeReforecast.reforecastDate)
                    : 'Not set'}
                </td>
              </tr>
              <tr>
                <td className={labelCell}>Actuals Through</td>
                <td className={valueCell}>
                  {activeReforecast.actualsThroughDate
                    ? formatDateMedium(activeReforecast.actualsThroughDate)
                    : 'Not set'}
                </td>
                <td className={gapCell} aria-hidden="true" />
                <td className={labelCell}>Reforecast Baseline</td>
                <td className={valueCell}>
                  {formatCurrency(activeReforecast.baselineBudget)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* ── Notes (only if present) ─────────────────────────── */}
      {notes && (
        <section className="print-section-keep mt-3">
          <h2 className={sectionHeading}>Notes</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm">{notes}</p>
        </section>
      )}

      {/* ── Forecast Metrics (compact 2-pair, 4 rows) ────────── */}
      <section className="print-section-keep mt-3">
        <h2 className={sectionHeading}>Forecast Metrics</h2>
        {metrics ? (
          <table className="mt-1 w-full table-fixed text-sm">
            {SummaryColGroup}
            <tbody>
              <tr>
                <td className={labelCell}>ETC</td>
                <td className={valueCell}>{formatCurrency(metrics.etc)}</td>
                <td className={gapCell} aria-hidden="true" />
                <td className={labelCell}>EAC</td>
                <td className={valueCell}>{formatCurrency(metrics.eac)}</td>
              </tr>
              <tr>
                <td className={labelCell}>Variance</td>
                <td className={valueCell}>{formatCurrency(metrics.variance)}</td>
                <td className={gapCell} aria-hidden="true" />
                <td className={labelCell}>Variance %</td>
                <td className={valueCell}>
                  {formatPercentValue(metrics.variancePercent)}
                </td>
              </tr>
              <tr>
                <td className={labelCell}>Budget Ratio</td>
                <td className={valueCell}>{formatNumber(metrics.budgetRatio, 2)}</td>
                <td className={gapCell} aria-hidden="true" />
                <td className={labelCell}>Weekly Burn Rate</td>
                <td className={valueCell}>{formatCurrency(metrics.weeklyBurnRate)}</td>
              </tr>
              <tr>
                <td className={labelCell}>Net Present Value</td>
                <td className={valueCell}>
                  {formatCurrency(Math.round(metrics.npv))}
                </td>
                <td className={gapCell} aria-hidden="true" />
                <td className={labelCell}>Total Hours</td>
                <td className={valueCell}>
                  {formatNumber(Math.round(metrics.totalHours))}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="mt-1 text-sm italic text-zinc-700">
            No forecast metrics available.
          </p>
        )}
      </section>

      {/* ── Page 2: Charts + Cost by Period ─────────────────── */}
      {chartData.length > 0 && (
        <section className="print-section-keep mt-4 break-before-page">
          <h2 className={sectionHeading}>Monthly Cost</h2>
          <div className="mt-1">
            <MonthlyCostBarChart monthlyData={chartData} forceLightMode />
          </div>
        </section>
      )}

      {chartData.length > 0 && (
        <section className="print-section-keep mt-4">
          <h2 className={sectionHeading}>Cumulative Cost vs Budget</h2>
          <div className="mt-1">
            <CumulativeCostLineChart
              monthlyData={chartData}
              baselineBudget={baselineBudget}
              forceLightMode
            />
          </div>
        </section>
      )}

      {metrics && metrics.monthlyData.length > 0 && (
        <section className="print-section-keep mt-4">
          <h2 className={sectionHeading}>Cost by Period</h2>
          <div className="mt-1">
            <CostByPeriodTable
              monthlyData={metrics.monthlyData}
              actualCost={actualCost}
            />
          </div>
        </section>
      )}

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="mt-6 border-t border-zinc-300 pt-2 text-xs text-zinc-600">
        Generated by {APP_NAME} v{APP_VERSION}
      </footer>
    </section>
  );
}
