'use client';

import Link from 'next/link';
import type { Project } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/format';
import { formatMonthLabel } from '@/lib/utils/dates';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const startLabel = formatMonthLabel(project.startDate);
  const endLabel = formatMonthLabel(project.endDate);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-lg border border-zinc-200 p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
    >
      <h3 className="text-lg font-semibold">{project.name}</h3>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {startLabel} &ndash; {endLabel}
      </p>
      <div className="mt-3 flex gap-6 text-sm">
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Budget: </span>
          <span className="font-medium">
            {formatCurrency(project.baselineBudget)}
          </span>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Team: </span>
          <span className="font-medium">{project.teamMembers.length}</span>
        </div>
      </div>
    </Link>
  );
}
