// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Project, Settings, PoolMember, ProjectColor } from '@/types/domain';
import { formatCurrency, formatDateMedium } from '@/lib/utils/format';
import { formatMonthLabel } from '@/lib/utils/dates';
import { calculateProjectMetrics, getTrafficLightStatus, getTrafficLightDisplay } from '@/lib/calc';
import { resolveAssignments, getMostRecentReforecast } from '@/lib/utils/teamResolution';
import { getProjectTileTint, PROJECT_COLOR_OPTIONS } from '@/features/projects/lib/projectColors';
import { isReforecastStale } from '@/features/projects/lib/dashboardCard';
import { TrashIcon } from '@/components/icons/TrashIcon';
import { ExportIcon } from '@/components/icons/ExportIcon';
import { CloneIcon } from '@/components/icons/CloneIcon';
import { ArchiveIcon } from '@/components/icons/ArchiveIcon';

interface ProjectCardProps {
  project: Project;
  settings?: Settings | null;
  pool: PoolMember[];
  onDelete: (id: string) => void;
  onExport?: (id: string) => void;
  onClone?: (id: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onColorChange?: (id: string, color: ProjectColor | undefined) => void;
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

// Local-time YYYY-MM-DD for "today" — avoids the UTC drift that toISOString
// would introduce on evenings west of GMT.
function todayLocalYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const actionButtonClass =
  'rounded p-1 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300';

export function ProjectCard({
  project,
  settings,
  pool,
  onDelete,
  onExport,
  onClone,
  onArchive,
  onUnarchive,
  onColorChange,
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
  const [colorOpen, setColorOpen] = useState(false);

  // Dashboard uses the most-recent reforecast by date — its window AND metrics.
  // (Project-level startDate/endDate are frozen creation-time metadata since
  // v0.29.0; reading them here would show stale dates after any reforecast edit.)
  const mostRecentRf = useMemo(
    () => getMostRecentReforecast(project),
    [project],
  );

  const startLabel = formatMonthLabel(mostRecentRf?.startDate ?? project.startDate);
  const endLabel = formatMonthLabel(mostRecentRf?.endDate ?? project.endDate);

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

  const tint = getProjectTileTint(project.color);
  const reforecastStale = mostRecentRf
    ? isReforecastStale(mostRecentRf.reforecastDate, todayLocalYmd())
    : false;
  const currentSwatch = PROJECT_COLOR_OPTIONS.find((o) => o.key === project.color)?.swatch;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`group relative flex rounded-lg border p-5 transition-colors ${
        isDragging
          ? 'opacity-40'
          : isDragOver
            ? 'border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-950/30'
            : `border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600 ${tint} ${project.archived ? 'opacity-60 hover:opacity-100' : ''}`
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
        {/* Action cluster: export · clone · archive/unarchive · swatch · trash.
            Export/clone are hover/focus-revealed and COLLAPSE when hidden
            (display:none, not opacity-0) so they reserve no idle space. They
            sit to the LEFT of the always-visible swatch + trash, and the
            cluster is right-anchored — so the swatch and trash stay put,
            adjacent, at the right edge, and the hover pair slides in to their
            left without displacing them or leaving a gap. Archive follows the
            same hover-reveal rule as export/clone on an ACTIVE card. Unarchive
            is the exception: on an ARCHIVED card it's always visible, joining
            swatch + trash as a third always-on control, because it's the only
            way back for a touch-device user (no hover state to reveal it).
            Colored-hover buttons (archive/unarchive/trash) write standalone
            class strings — NOT actionButtonClass + hover:text-* — so a single
            hover:text color wins cleanly (no double hover:text-* to order). */}
        <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5">
          {onExport && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onExport(project.id);
              }}
              title="Export this project (JSON)"
              aria-label="Export project as JSON"
              className={`${actionButtonClass} hidden group-hover:inline-flex group-focus-within:inline-flex`}
            >
              <ExportIcon className="h-4 w-4" />
            </button>
          )}
          {onClone && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClone(project.id);
              }}
              title="Duplicate this project"
              aria-label="Clone project"
              className={`${actionButtonClass} hidden group-hover:inline-flex group-focus-within:inline-flex`}
            >
              <CloneIcon className="h-4 w-4" />
            </button>
          )}
          {project.archived
            ? onUnarchive && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onUnarchive(project.id);
                  }}
                  title="Unarchive this project"
                  aria-label="Unarchive project"
                  className="inline-flex rounded p-1 text-zinc-300 hover:bg-zinc-100 hover:text-blue-500 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-blue-400"
                >
                  <ArchiveIcon className="h-4 w-4" />
                </button>
              )
            : onArchive && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onArchive(project.id);
                  }}
                  title="Archive this project"
                  aria-label="Archive project"
                  className="hidden rounded p-1 text-zinc-300 hover:bg-zinc-100 hover:text-amber-500 group-hover:inline-flex group-focus-within:inline-flex dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-amber-400"
                >
                  <ArchiveIcon className="h-4 w-4" />
                </button>
              )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setColorOpen((o) => !o);
            }}
            title="Tile color"
            aria-label="Set tile color"
            aria-haspopup="true"
            aria-expanded={colorOpen}
            className={actionButtonClass}
          >
            <span
              className={`block h-3.5 w-3.5 rounded-full border ${
                currentSwatch
                  ? `${currentSwatch} border-black/10 dark:border-white/20`
                  : 'border-zinc-400 dark:border-zinc-500'
              }`}
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(project.id);
            }}
            title="Delete project"
            aria-label="Delete project"
            className="rounded p-1 text-zinc-300 hover:bg-red-50 hover:text-red-500 dark:text-zinc-600 dark:hover:bg-red-950 dark:hover:text-red-400"
          >
            <TrashIcon />
          </button>
        </div>

        {/* Color picker popover */}
        {colorOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setColorOpen(false);
              }}
              aria-hidden="true"
            />
            <div
              className="absolute right-2 top-11 z-20 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
              role="menu"
            >
              <div className="flex items-center gap-1.5">
                {PROJECT_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onColorChange?.(project.id, opt.key);
                      setColorOpen(false);
                    }}
                    title={opt.label}
                    aria-label={opt.label}
                    className={`h-5 w-5 rounded-full ${opt.swatch} ${
                      project.color === opt.key
                        ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-zinc-900'
                        : 'border border-black/10 dark:border-white/20'
                    }`}
                  />
                ))}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onColorChange?.(project.id, undefined);
                    setColorOpen(false);
                  }}
                  title="No color"
                  aria-label="No color"
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-[11px] leading-none text-zinc-500 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  &times;
                </button>
              </div>
            </div>
          </>
        )}

        <Link href={`/projects/${project.id}`} className="block">
          <h3 className="pr-24 text-lg font-semibold">
            {project.name}
            {isShared && (
              <span className="ml-2 inline-block rounded bg-blue-100 px-1.5 py-0.5 align-middle text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                Shared
              </span>
            )}
            {project.archived && (
              <span className="ml-2 inline-block rounded bg-zinc-100 px-1.5 py-0.5 align-middle text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Archived
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
          {mostRecentRf && (
            <p
              className={`mt-2 text-xs ${
                reforecastStale
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
              title="Date of the most recent reforecast"
            >
              as of {formatDateMedium(mostRecentRf.reforecastDate)}
            </p>
          )}
        </Link>
      </div>
    </div>
  );
}
