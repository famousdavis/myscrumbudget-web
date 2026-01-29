'use client';

import type { Project, ProjectMetrics } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/format';
import { formatMonthLabel } from '@/lib/utils/dates';

interface ProjectSummaryProps {
  project: Project;
  metrics?: ProjectMetrics | null;
}

export function ProjectSummary({ project, metrics }: ProjectSummaryProps) {
  const eacColor = metrics
    ? metrics.eac <= project.baselineBudget
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400'
    : '';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Timeline</p>
          <p className="mt-1 text-sm font-medium">
            {formatMonthLabel(project.startDate)} &ndash;{' '}
            {formatMonthLabel(project.endDate)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Baseline Budget
          </p>
          <p className="mt-1 text-sm font-medium">
            {formatCurrency(project.baselineBudget)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Actual Cost
          </p>
          <p className="mt-1 text-sm font-medium">
            {formatCurrency(project.actualCost)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            EAC
          </p>
          <p className={`mt-1 text-sm font-medium ${eacColor}`}>
            {metrics ? formatCurrency(metrics.eac) : '\u2014'}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Team Members
          </p>
          <p className="mt-1 text-sm font-medium">
            {project.teamMembers.length}
          </p>
        </div>
      </div>
    </div>
  );
}
