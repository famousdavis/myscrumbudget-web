// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { Project, Settings, PoolMember } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/format';
import { formatMonthLabel } from '@/lib/utils/dates';
import { calculateProjectMetrics, getTrafficLightStatus, getTrafficLightDisplay } from '@/lib/calc';
import { resolveAssignments, getMostRecentReforecast } from '@/lib/utils/teamResolution';
import { TrashIcon } from '@/components/icons/TrashIcon';

interface ProjectCardProps {
  project: Project;
  settings?: Settings | null;
  pool: PoolMember[];
  onDelete: (id: string) => void;
  isShared?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export function ProjectCard({
  project,
  settings,
  pool,
  onDelete,
  isShared,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
}: ProjectCardProps) {
  const startLabel = formatMonthLabel(project.startDate);
  const endLabel = formatMonthLabel(project.endDate);

  // Dashboard uses the most-recent reforecast by date
  const mostRecentRf = useMemo(
    () => getMostRecentReforecast(project),
    [project],
  );

  const metrics = useMemo(() => {
    if (!settings) return null;
    if (!mostRecentRf || mostRecentRf.allocations.length === 0) return null;
    // Build a view of the project with the most-recent RF as active
    const dashProject = {
      ...project,
      activeReforecastId: mostRecentRf.id,
    };
    const teamMembers = resolveAssignments(mostRecentRf.assignments ?? [], pool);
    return calculateProjectMetrics(dashProject, settings, teamMembers);
  }, [project, settings, pool, mostRecentRf]);

  const budget = mostRecentRf?.baselineBudget ?? 0;

  const trafficLight = useMemo(() => {
    if (!metrics || !settings) return null;
    const status = getTrafficLightStatus(metrics, settings.trafficLightThresholds);
    return getTrafficLightDisplay(status);
  }, [metrics, settings]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative flex rounded-lg border p-5 transition-colors ${
        isDragging
          ? 'opacity-40'
          : isDragOver
            ? 'border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-950/30'
            : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600'
      }`}
    >
      {/* Drag handle */}
      <div className="mr-3 flex items-start pt-1">
        <div
          className="cursor-grab text-zinc-300 hover:text-zinc-500 active:cursor-grabbing dark:text-zinc-600 dark:hover:text-zinc-400"
          title="Drag to reorder"
          aria-hidden="true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(project.id);
          }}
          title="Delete project"
          className="absolute right-3 top-3 rounded p-1 text-zinc-300 hover:bg-red-50 hover:text-red-500 dark:text-zinc-600 dark:hover:bg-red-950 dark:hover:text-red-400"
        >
          <TrashIcon />
        </button>
        <Link href={`/projects/${project.id}`} className="block">
          <h3 className="pr-6 text-lg font-semibold">
            {project.name}
            {isShared && (
              <span className="ml-2 inline-block rounded bg-blue-100 px-1.5 py-0.5 align-middle text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                Shared
              </span>
            )}
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {startLabel} &ndash; {endLabel}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Budget: </span>
              <span className="font-medium">
                {formatCurrency(budget)}
              </span>
            </div>
            {metrics && trafficLight && (
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">EAC: </span>
                <span className={`font-medium ${trafficLight.color}`}>
                  {formatCurrency(metrics.eac)}
                </span>
                <span className={`ml-1 text-sm ${trafficLight.color}`}>
                  <span aria-hidden="true">{trafficLight.indicator}</span>
                  {' '}
                  {trafficLight.label}
                </span>
              </div>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}
