// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import type { Project, ProjectMetrics, Reforecast, TrafficLightThresholds, CharterBudget } from '@/types/domain';
import { formatCurrency, formatDateMedium } from '@/lib/utils/format';
import { getTrafficLightStatus, getTrafficLightDisplay, DEFAULT_THRESHOLDS } from '@/lib/calc';

const editableClass =
  'rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 transition-colors';
const readonlyClass =
  'rounded-lg border border-zinc-200 p-4 dark:border-zinc-800';
const inputClass =
  'mt-1 w-full rounded border border-blue-400 px-2 py-1 text-base font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-blue-600 dark:bg-zinc-900';

const DIST_SHORT: Record<CharterBudget['distribution'], string> = {
  normal: 'Normal',
  lognormal: 'Lognormal',
  beta_pert: 'Beta-PERT',
};

// --- Reusable inline-editable currency field ---

interface InlineEditableFieldProps {
  label: string;
  value: number;
  onChange?: (value: number) => void;
  tooltip?: string;
  /** Optional content rendered below the value (e.g. the charter-budget badge). */
  badge?: ReactNode;
}

function InlineEditableField({ label, value, onChange, tooltip, badge }: InlineEditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));

  // Sync when prop changes (e.g., reforecast switch)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      title={tooltip}
    >
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      {editing ? (
        <input
          name="inlineEditValue"
          type="number"
          min="0"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.target.select()}
          autoFocus
          aria-label={label}
          className={inputClass}
        />
      ) : (
        <p className="mt-1 text-base font-medium">{formatCurrency(value)}</p>
      )}
      {!editing && badge}
    </div>
  );
}

// --- Main component ---

interface ProjectSummaryProps {
  project: Project;
  /**
   * Active reforecast — when present, drives the displayed Start/Finish
   * dates so they reflect the current scenario's window (v0.29.1). Falls
   * back to project.startDate/endDate when null (degenerate state).
   */
  activeReforecast: Reforecast | null;
  metrics?: ProjectMetrics | null;
  actualCost: number;
  baselineBudget: number;
  trafficLightThresholds?: TrafficLightThresholds;
  onActualCostChange?: (value: number) => void;
  onBaselineBudgetChange?: (value: number) => void;
  /** Stored charter on the active reforecast (drives the Baseline-tile badge). */
  charterBudget?: CharterBudget;
  /** Computed once at the page layer (see §7.2) — badge + panel share it. */
  charterStale?: boolean;
  /** Opens the charter panel; omit to hide the charter affordance entirely. */
  onOpenCharter?: () => void;
}

export function ProjectSummary({
  project,
  activeReforecast,
  metrics,
  actualCost,
  baselineBudget,
  trafficLightThresholds,
  onActualCostChange,
  onBaselineBudgetChange,
  charterBudget,
  charterStale,
  onOpenCharter,
}: ProjectSummaryProps) {
  const startDate = activeReforecast?.startDate ?? project.startDate;
  const endDate = activeReforecast?.endDate ?? project.endDate;
  const trafficLight = metrics
    ? getTrafficLightDisplay(
        getTrafficLightStatus(metrics, trafficLightThresholds ?? DEFAULT_THRESHOLDS),
      )
    : null;

  // Charter-budget affordance under the Baseline tile. A compact inline badge
  // (not an extra stacked row) — keeps tile heights even (v0.22.5 lesson).
  // The button stops propagation so it doesn't trip the tile's click-to-edit.
  const charterBadge = onOpenCharter ? (
    charterBudget ? (
      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">
          P{charterBudget.targetPercentile} &middot; {DIST_SHORT[charterBudget.distribution]}
          {charterBudget.riskProfile.optimismUpliftPct > 0 &&
            ` · +${Math.round(charterBudget.riskProfile.optimismUpliftPct * 100)}% bias`}
        </span>
        {charterStale && (
          <span
            className="text-amber-600 dark:text-amber-400"
            title="ETC changed since this charter was set"
          >
            &middot; stale
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenCharter?.();
          }}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Edit charter budget &rarr;
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenCharter?.();
        }}
        className="mt-1 block text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Set charter budget &rarr;
      </button>
    )
  ) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Link href={`/projects/${project.id}/edit`} className={editableClass}>
          <div className="space-y-0.5 text-sm font-medium">
            <p><span className="font-normal text-zinc-500 dark:text-zinc-400">Start:</span> {formatDateMedium(startDate)}</p>
            <p><span className="font-normal text-zinc-500 dark:text-zinc-400">Finish:</span> {formatDateMedium(endDate)}</p>
          </div>
        </Link>
        <InlineEditableField
          label="Baseline Budget"
          value={baselineBudget}
          onChange={onBaselineBudgetChange}
          badge={charterBadge}
        />
        <InlineEditableField
          label="Actual Cost"
          value={actualCost}
          onChange={onActualCostChange}
          tooltip="Actual Cost (AC)"
        />
        <div className={readonlyClass} title="Estimate to Complete (ETC)">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">ETC</p>
          <p className="mt-1 text-base font-medium">
            {metrics ? formatCurrency(metrics.etc) : '\u2014'}
          </p>
        </div>
        <div className={readonlyClass} title="Estimate at Completion (EAC)">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">EAC</p>
          <p className={`mt-1 text-base font-medium ${trafficLight?.color ?? ''}`}>
            {metrics ? formatCurrency(metrics.eac) : '\u2014'}
          </p>
          {trafficLight && (
            <p className={`mt-0.5 text-xs ${trafficLight.color}`}>
              <span aria-hidden="true">{trafficLight.indicator}</span>
              {' '}
              {trafficLight.label}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
