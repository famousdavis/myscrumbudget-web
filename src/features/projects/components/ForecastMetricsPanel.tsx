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
}: {
  label: string;
  value: string;
  colorClass?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-sm font-medium ${colorClass ?? ''}`}>{value}</p>
    </div>
  );
}

function varianceColor(value: number): string {
  if (value > 0) return 'text-red-600 dark:text-red-400';
  if (value < 0) return 'text-green-600 dark:text-green-400';
  return '';
}

function ratioColor(value: number): string {
  if (value >= 1) return 'text-green-600 dark:text-green-400';
  if (value > 0) return 'text-red-600 dark:text-red-400';
  return '';
}

export function ForecastMetricsPanel({ metrics }: ForecastMetricsPanelProps) {
  if (!metrics) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Add team members and allocations to see forecast metrics.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <MetricCard label="Estimate to Complete (ETC)" value={formatCurrency(metrics.etc)} />
      <MetricCard label="Estimate at Completion (EAC)" value={formatCurrency(metrics.eac)} />
      <MetricCard
        label="Variance"
        value={formatCurrency(metrics.variance)}
        colorClass={varianceColor(metrics.variance)}
      />
      <MetricCard
        label="Variance %"
        value={formatPercentValue(metrics.variancePercent)}
        colorClass={varianceColor(metrics.variancePercent)}
      />
      <MetricCard
        label="Budget Ratio"
        value={formatNumber(metrics.budgetRatio, 2)}
        colorClass={ratioColor(metrics.budgetRatio)}
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
