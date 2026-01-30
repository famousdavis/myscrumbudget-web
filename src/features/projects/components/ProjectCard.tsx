'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { Project, Settings, PoolMember } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/format';
import { formatMonthLabel } from '@/lib/utils/dates';
import { calculateProjectMetrics } from '@/lib/calc';
import { resolveAssignments, getMostRecentReforecast } from '@/lib/utils/teamResolution';

interface ProjectCardProps {
  project: Project;
  settings?: Settings | null;
  pool: PoolMember[];
  onDelete: (id: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
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
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
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
    const teamMembers = resolveAssignments(project.assignments ?? [], pool);
    return calculateProjectMetrics(dashProject, settings, teamMembers);
  }, [project, settings, pool, mostRecentRf]);

  const budget = mostRecentRf?.baselineBudget ?? 0;

  const eacStatus = metrics
    ? metrics.eac <= budget
      ? { color: 'text-green-600 dark:text-green-400', label: '(under budget)' }
      : { color: 'text-red-600 dark:text-red-400', label: '(over budget)' }
    : { color: '', label: '' };

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
      {/* Reorder controls */}
      <div className="mr-3 flex flex-col items-center gap-0.5 pt-1">
        {onMoveUp && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={!canMoveUp}
            title="Move up"
            aria-label={`Move ${project.name} up`}
            className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 disabled:cursor-default disabled:opacity-30 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path fillRule="evenodd" d="M8 3.5a.75.75 0 01.53.22l3.25 3.25a.75.75 0 01-1.06 1.06L8 5.31 5.28 8.03a.75.75 0 01-1.06-1.06l3.25-3.25A.75.75 0 018 3.5z" clipRule="evenodd" />
            </svg>
          </button>
        )}
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
        {onMoveDown && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={!canMoveDown}
            title="Move down"
            aria-label={`Move ${project.name} down`}
            className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 disabled:cursor-default disabled:opacity-30 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path fillRule="evenodd" d="M8 12.5a.75.75 0 01-.53-.22l-3.25-3.25a.75.75 0 011.06-1.06L8 10.69l2.72-2.72a.75.75 0 011.06 1.06l-3.25 3.25a.75.75 0 01-.53.22z" clipRule="evenodd" />
            </svg>
          </button>
        )}
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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
          </svg>
        </button>
        <Link href={`/projects/${project.id}`} className="block">
          <h3 className="pr-6 text-lg font-semibold">{project.name}</h3>
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
            {metrics && (
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">EAC: </span>
                <span className={`font-medium ${eacStatus.color}`}>
                  {formatCurrency(metrics.eac)}
                </span>
                {eacStatus.label && (
                  <span className={`ml-1 text-sm ${eacStatus.color}`}>{eacStatus.label}</span>
                )}
              </div>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}
