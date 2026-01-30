'use client';

import type { ProjectMetrics } from '@/types/domain';
import { formatCurrency, formatNumber, formatPercentValue } from '@/lib/utils/format';

interface ForecastMetricsPanelProps {
  metrics: ProjectMetrics | null;
}

function MetricCard({
  label,
  value,
  colorClass,
  indicator,
}: {
  label: string;
  value: string;
  colorClass?: string;
  indicator?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-sm font-medium ${colorClass ?? ''}`}>
        {indicator && <span className="mr-1">{indicator}</span>}
        {value}
      </p>
    </div>
  );
}

function varianceInfo(value: number): { color: string; indicator?: string } {
  if (value > 0) return { color: 'text-red-600 dark:text-red-400', indicator: '\u25B2' };
  if (value < 0) return { color: 'text-green-600 dark:text-green-400', indicator: '\u25BC' };
  return { color: '' };
}

function ratioInfo(value: number): { color: string; indicator?: string } {
  if (value >= 1) return { color: 'text-green-600 dark:text-green-400', indicator: '\u25B2' };
  if (value > 0) return { color: 'text-red-600 dark:text-red-400', indicator: '\u25BC' };
  return { color: '' };
}

export function ForecastMetricsPanel({ metrics }: ForecastMetricsPanelProps) {
  if (!metrics) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No forecast metrics available yet.
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Add team members and allocations to see forecast metrics.
        </p>
      </div>
    );
  }

  const vInfo = varianceInfo(metrics.variance);
  const vpInfo = varianceInfo(metrics.variancePercent);
  const rInfo = ratioInfo(metrics.budgetRatio);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <MetricCard label="Estimate to Complete (ETC)" value={formatCurrency(metrics.etc)} />
      <MetricCard label="Estimate at Completion (EAC)" value={formatCurrency(metrics.eac)} />
      <MetricCard
        label="Variance"
        value={formatCurrency(metrics.variance)}
        colorClass={vInfo.color}
        indicator={vInfo.indicator}
      />
      <MetricCard
        label="Variance %"
        value={formatPercentValue(metrics.variancePercent)}
        colorClass={vpInfo.color}
        indicator={vpInfo.indicator}
      />
      <MetricCard
        label="Budget Ratio"
        value={formatNumber(metrics.budgetRatio, 2)}
        colorClass={rInfo.color}
        indicator={rInfo.indicator}
      />
      <MetricCard
        label="Weekly Burn Rate"
        value={formatCurrency(metrics.weeklyBurnRate)}
      />
      <MetricCard label="NPV" value={formatCurrency(Math.round(metrics.npv))} />
      <MetricCard
        label="Total Hours"
        value={formatNumber(Math.round(metrics.totalHours))}
      />
    </div>
  );
}
