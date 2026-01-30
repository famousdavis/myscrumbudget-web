'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Project, ProjectMetrics } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/format';
import { formatMonthLabel } from '@/lib/utils/dates';

interface ProjectSummaryProps {
  project: Project;
  metrics?: ProjectMetrics | null;
  actualCost: number;
  onActualCostChange?: (value: number) => void;
}

export function ProjectSummary({
  project,
  metrics,
  actualCost,
  onActualCostChange,
}: ProjectSummaryProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(actualCost);

  // Sync editValue when actualCost prop changes (e.g., reforecast switch)
  useEffect(() => {
    setEditValue(actualCost);
  }, [actualCost]);

  const handleSave = () => {
    const clamped = Math.max(0, editValue);
    onActualCostChange?.(clamped);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(actualCost);
      setEditing(false);
    }
  };

  const eacStatus = metrics
    ? metrics.eac <= project.baselineBudget
      ? { color: 'text-green-600 dark:text-green-400', label: '(under)' }
      : { color: 'text-red-600 dark:text-red-400', label: '(over)' }
    : { color: '', label: '' };

  const editableClass =
    'rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 transition-colors';
  const readonlyClass =
    'rounded-lg border border-zinc-200 p-4 dark:border-zinc-800';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Link href={`/projects/${project.id}/edit`} className={editableClass}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Timeline</p>
          <p className="mt-1 text-sm font-medium">
            {formatMonthLabel(project.startDate)} &ndash;{' '}
            {formatMonthLabel(project.endDate)}
          </p>
        </Link>
        <Link href={`/projects/${project.id}/edit`} className={editableClass}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Baseline Budget
          </p>
          <p className="mt-1 text-base font-medium">
            {formatCurrency(project.baselineBudget)}
          </p>
        </Link>
        <div
          className={editableClass}
          onClick={() => {
            if (!editing) setEditing(true);
          }}
        >
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Actual Cost
          </p>
          {editing ? (
            <input
              type="number"
              min="0"
              value={editValue || ''}
              onChange={(e) =>
                setEditValue(Math.max(0, parseFloat(e.target.value) || 0))
              }
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
              className="mt-1 w-full rounded border border-blue-400 px-2 py-1 text-base font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-blue-600 dark:bg-zinc-900"
            />
          ) : (
            <p className="mt-1 text-base font-medium">
              {formatCurrency(actualCost)}
            </p>
          )}
        </div>
        <div className={readonlyClass}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            ETC
          </p>
          <p className="mt-1 text-base font-medium">
            {metrics ? formatCurrency(metrics.etc) : '\u2014'}
          </p>
        </div>
        <div className={readonlyClass}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            EAC
          </p>
          <p className={`mt-1 text-base font-medium ${eacStatus.color}`}>
            {metrics ? formatCurrency(metrics.eac) : '\u2014'}
            {eacStatus.label && (
              <span className="ml-1 text-xs font-normal">{eacStatus.label}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
