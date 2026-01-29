'use client';

import Link from 'next/link';
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

  const editableClass =
    'rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 transition-colors';
  const readonlyClass =
    'rounded-lg border border-zinc-200 p-4 dark:border-zinc-800';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        <Link href={`/projects/${project.id}/edit`} className={editableClass}>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Timeline</p>
          <p className="mt-1 text-sm font-medium">
            {formatMonthLabel(project.startDate)} &ndash;{' '}
            {formatMonthLabel(project.endDate)}
          </p>
        </Link>
        <Link href={`/projects/${project.id}/edit`} className={editableClass}>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Baseline Budget
          </p>
          <p className="mt-1 text-sm font-medium">
            {formatCurrency(project.baselineBudget)}
          </p>
        </Link>
        <Link href={`/projects/${project.id}/edit`} className={editableClass}>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Actual Cost
          </p>
          <p className="mt-1 text-sm font-medium">
            {formatCurrency(project.actualCost)}
          </p>
        </Link>
        <div className={readonlyClass}>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            ETC
          </p>
          <p className="mt-1 text-sm font-medium">
            {metrics ? formatCurrency(metrics.etc) : '\u2014'}
          </p>
        </div>
        <div className={readonlyClass}>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            EAC
          </p>
          <p className={`mt-1 text-sm font-medium ${eacColor}`}>
            {metrics ? formatCurrency(metrics.eac) : '\u2014'}
          </p>
        </div>
        <div className={readonlyClass}>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Team Members
          </p>
          <p className="mt-1 text-sm font-medium">
            {(project.assignments ?? []).length}
          </p>
        </div>
      </div>
    </div>
  );
}
