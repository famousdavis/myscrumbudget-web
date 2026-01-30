'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Project, ProjectMetrics } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/format';
import { formatMonthLabel } from '@/lib/utils/dates';

const editableClass =
  'rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 transition-colors';
const readonlyClass =
  'rounded-lg border border-zinc-200 p-4 dark:border-zinc-800';
const inputClass =
  'mt-1 w-full rounded border border-blue-400 px-2 py-1 text-base font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-blue-600 dark:bg-zinc-900';

// --- Reusable inline-editable currency field ---

interface InlineEditableFieldProps {
  label: string;
  value: number;
  onChange?: (value: number) => void;
}

function InlineEditableField({ label, value, onChange }: InlineEditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  // Sync when prop changes (e.g., reforecast switch)
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const save = () => {
    const clamped = Math.max(0, editValue);
    onChange?.(clamped);
    setEditing(false);
  };

  const cancel = () => {
    setEditValue(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  };

  const activate = () => {
    if (!editing) setEditing(true);
  };

  const handleContainerKeyDown = (e: React.KeyboardEvent) => {
    if (!editing && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      activate();
    }
  };

  return (
    <div
      className={editableClass}
      onClick={activate}
      onKeyDown={handleContainerKeyDown}
      role="button"
      tabIndex={editing ? -1 : 0}
      aria-label={`Edit ${label}`}
    >
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      {editing ? (
        <input
          type="number"
          min="0"
          value={editValue}
          onChange={(e) =>
            setEditValue(Math.max(0, parseFloat(e.target.value) || 0))
          }
          onBlur={save}
          onKeyDown={handleKeyDown}
          autoFocus
          className={inputClass}
        />
      ) : (
        <p className="mt-1 text-base font-medium">{formatCurrency(value)}</p>
      )}
    </div>
  );
}

// --- Main component ---

interface ProjectSummaryProps {
  project: Project;
  metrics?: ProjectMetrics | null;
  actualCost: number;
  baselineBudget: number;
  onActualCostChange?: (value: number) => void;
  onBaselineBudgetChange?: (value: number) => void;
}

export function ProjectSummary({
  project,
  metrics,
  actualCost,
  baselineBudget,
  onActualCostChange,
  onBaselineBudgetChange,
}: ProjectSummaryProps) {
  const eacStatus = metrics
    ? metrics.eac <= baselineBudget
      ? { color: 'text-green-600 dark:text-green-400', label: '(under)' }
      : { color: 'text-red-600 dark:text-red-400', label: '(over)' }
    : { color: '', label: '' };

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
        <InlineEditableField
          label="Baseline Budget"
          value={baselineBudget}
          onChange={onBaselineBudgetChange}
        />
        <InlineEditableField
          label="Actual Cost"
          value={actualCost}
          onChange={onActualCostChange}
        />
        <div className={readonlyClass}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">ETC</p>
          <p className="mt-1 text-base font-medium">
            {metrics ? formatCurrency(metrics.etc) : '\u2014'}
          </p>
        </div>
        <div className={readonlyClass}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">EAC</p>
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
