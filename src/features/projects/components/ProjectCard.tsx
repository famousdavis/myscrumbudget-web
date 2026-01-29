'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { Project, Settings } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/format';
import { formatMonthLabel } from '@/lib/utils/dates';
import { calculateProjectMetrics } from '@/lib/calc';

interface ProjectCardProps {
  project: Project;
  settings?: Settings | null;
}

export function ProjectCard({ project, settings }: ProjectCardProps) {
  const startLabel = formatMonthLabel(project.startDate);
  const endLabel = formatMonthLabel(project.endDate);

  const metrics = useMemo(() => {
    if (!settings) return null;
    if (project.reforecasts.length === 0) return null;
    const rf = project.activeReforecastId
      ? project.reforecasts.find(r => r.id === project.activeReforecastId)
      : project.reforecasts[0];
    if (!rf || rf.allocations.length === 0) return null;
    return calculateProjectMetrics(project, settings);
  }, [project, settings]);

  const eacColor = metrics
    ? metrics.eac <= project.baselineBudget
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400'
    : '';

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-lg border border-zinc-200 p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
    >
      <h3 className="text-lg font-semibold">{project.name}</h3>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {startLabel} &ndash; {endLabel}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Budget: </span>
          <span className="font-medium">
            {formatCurrency(project.baselineBudget)}
          </span>
        </div>
        {metrics && (
          <div>
            <span className="text-zinc-500 dark:text-zinc-400">EAC: </span>
            <span className={`font-medium ${eacColor}`}>
              {formatCurrency(metrics.eac)}
            </span>
          </div>
        )}
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Team: </span>
          <span className="font-medium">{project.teamMembers.length}</span>
        </div>
      </div>
    </Link>
  );
}
