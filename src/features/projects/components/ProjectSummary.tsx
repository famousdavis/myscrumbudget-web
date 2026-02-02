'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Project, ProjectMetrics, TrafficLightThresholds } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/format';
import { formatMonthLabel } from '@/lib/utils/dates';
import { getTrafficLightStatus, getTrafficLightDisplay, DEFAULT_THRESHOLDS } from '@/lib/calc';

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
  const [editValue, setEditValue] = useState(String(value));

  // Sync when prop changes (e.g., reforecast switch)
  useEffect(() => {
    setEditValue(String(value));
  }, [value]);

  const save = () => {
    const parsed = parseFloat(editValue);
    const clamped = Math.max(0, Number.isFinite(parsed) ? parsed : 0);
    onChange?.(clamped);
    setEditing(false);
  };

  const cancel = () => {
    setEditValue(String(value));
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  };

  const activate = () => {
    if (!editing) {
      setEditValue(value ? String(value) : '');
      setEditing(true);
    }
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
          onChange={(e) => setEditValue(e.target.value)}
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
  trafficLightThresholds?: TrafficLightThresholds;
  onActualCostChange?: (value: number) => void;
  onBaselineBudgetChange?: (value: number) => void;
}

export function ProjectSummary({
  project,
  metrics,
  actualCost,
  baselineBudget,
  trafficLightThresholds,
  onActualCostChange,
  onBaselineBudgetChange,
}: ProjectSummaryProps) {
  const trafficLight = metrics
    ? getTrafficLightDisplay(
        getTrafficLightStatus(metrics, trafficLightThresholds ?? DEFAULT_THRESHOLDS),
      )
    : null;

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
          <p className={`mt-1 text-base font-medium ${trafficLight?.color ?? ''}`}>
            {metrics ? formatCurrency(metrics.eac) : '\u2014'}
            {trafficLight && (
              <span className="ml-1 text-xs font-normal">
                <span aria-hidden="true">{trafficLight.indicator}</span>
                {' '}
                {trafficLight.label}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
