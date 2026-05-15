// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';
import type { Reforecast } from '@/types/domain';
import { NewReforecastDialog } from './NewReforecastDialog';
import { BaseDialog, ConfirmDialog, dialogButtonStyles } from '@/components/BaseDialog';
import { TrashIcon } from '@/components/icons/TrashIcon';
import { PencilIcon } from '@/components/icons/PencilIcon';
import { isValidDateString } from '@/lib/utils/validation';
import {
  computeSingleReforecastTimelineChangeSummary,
  summaryHasChanges,
  type TimelineChangeSummary,
} from '@/features/projects/lib/timelineChange';

interface ReforecastToolbarProps {
  reforecasts: Reforecast[];
  activeReforecastId: string | null;
  reforecastDate: string;
  actualsThroughDate?: string;
  reforecastStartDate: string;
  reforecastEndDate: string;
  onSwitch: (id: string) => void;
  onCreate: (name: string, copyFromId?: string) => void;
  onDelete: (id: string) => void;
  onRename: (newName: string) => void;
  onReforecastDateChange: (date: string) => void;
  onActualsThroughDateChange: (date: string | undefined) => void;
  onCommitStartDate: (date: string, today: string) => void;
  onCommitEndDate: (date: string) => void;
}

export function ReforecastToolbar({
  reforecasts,
  activeReforecastId,
  reforecastDate,
  actualsThroughDate,
  reforecastStartDate,
  reforecastEndDate,
  onSwitch,
  onCreate,
  onDelete,
  onRename,
  onReforecastDateChange,
  onActualsThroughDateChange,
  onCommitStartDate,
  onCommitEndDate,
}: ReforecastToolbarProps) {
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  // Window-change confirmation draft state
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const [pendingField, setPendingField] = useState<'start' | 'end' | null>(null);
  const [pendingSummary, setPendingSummary] = useState<TimelineChangeSummary | null>(null);
  const [pendingToday, setPendingToday] = useState<string | null>(null);

  // today captured at render; frozen into pendingToday when a dialog opens (D20)
  const today = new Date().toISOString().slice(0, 10);

  // Newest first by reforecastDate (createdAt as tiebreaker). Lexical
  // comparison works since both are ISO date strings.
  const sortedReforecasts = [...reforecasts].sort((a, b) => {
    if (b.reforecastDate !== a.reforecastDate) {
      return b.reforecastDate.localeCompare(a.reforecastDate);
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  const selectedId =
    activeReforecastId ?? (sortedReforecasts.length > 0 ? sortedReforecasts[0].id : '');
  const selectedReforecast = sortedReforecasts.find((r) => r.id === selectedId);
  const rf: Reforecast | null = reforecasts.find((r) => r.id === activeReforecastId) ?? null;

  const beginEdit = () => {
    if (!selectedReforecast) return;
    setDraftName(selectedReforecast.name);
    setEditingName(true);
  };

  const commitEdit = () => {
    const trimmed = draftName.trim();
    if (trimmed.length > 0) {
      onRename(trimmed);
    }
    setEditingName(false);
  };

  const cancelEdit = () => {
    setEditingName(false);
  };

  const clearPending = () => {
    setDraftDate(null);
    setPendingField(null);
    setPendingSummary(null);
    setPendingToday(null);
  };

  const handleStartChange = (newValue: string) => {
    if (!rf || !newValue || !isValidDateString(newValue)) return;
    if (newValue === reforecastStartDate) return;
    const frozenToday = today;
    const summary = computeSingleReforecastTimelineChangeSummary(
      rf,
      newValue,
      reforecastEndDate,
      frozenToday,
    );
    if (summaryHasChanges(summary)) {
      setDraftDate(newValue);
      setPendingField('start');
      setPendingSummary(summary);
      setPendingToday(frozenToday);
    } else {
      onCommitStartDate(newValue, frozenToday);
    }
  };

  const handleEndChange = (newValue: string) => {
    if (!rf || !newValue || !isValidDateString(newValue)) return;
    if (newValue === reforecastEndDate) return;
    const frozenToday = today; // captured for symmetry; unused by commitReforecastEndDate
    const summary = computeSingleReforecastTimelineChangeSummary(
      rf,
      reforecastStartDate,
      newValue,
      frozenToday,
    );
    if (summaryHasChanges(summary)) {
      setDraftDate(newValue);
      setPendingField('end');
      setPendingSummary(summary);
      setPendingToday(frozenToday); // pendingToday unused on end path; set for future symmetry with start path
    } else {
      onCommitEndDate(newValue);
    }
  };

  const handleReforecastDateChange = (newValue: string) => {
    if (!newValue) return;
    const minBound = reforecastStartDate <= today ? reforecastStartDate : today;
    let clamped = newValue;
    if (clamped > today) clamped = today;
    if (clamped < minBound) clamped = minBound;
    onReforecastDateChange(clamped);
  };

  const handleConfirm = () => {
    if (!draftDate) return;
    if (pendingField === 'start' && pendingToday !== null) {
      onCommitStartDate(draftDate, pendingToday);
    } else if (pendingField === 'end') {
      onCommitEndDate(draftDate);
    }
    clearPending();
  };

  const dialogHeading =
    pendingSummary && summaryOnlyFlagsWindows(pendingSummary)
      ? "Changing this reforecast's dates will have the following effects:"
      : "Changing this reforecast's dates will affect its existing data:";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 md:flex-nowrap md:gap-3 dark:border-zinc-800 dark:bg-zinc-900">
        <label
          htmlFor={editingName ? 'rf-name-edit' : 'rf-select'}
          className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
        >
          Reforecast
        </label>

        {sortedReforecasts.length > 0 ? (
          editingName ? (
            <input
              id="rf-name-edit"
              type="text"
              value={draftName}
              maxLength={50}
              autoFocus
              onChange={(e) => setDraftName(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitEdit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              aria-label="Edit reforecast name"
              className="min-w-56 rounded border border-blue-400 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-blue-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          ) : (
            <select
              id="rf-select"
              value={selectedId}
              onChange={(e) => onSwitch(e.target.value)}
              className="min-w-56 rounded border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {sortedReforecasts.map((rfOpt) => (
                <option key={rfOpt.id} value={rfOpt.id}>
                  {rfOpt.name}
                </option>
              ))}
            </select>
          )
        ) : (
          <span className="text-sm text-zinc-400 dark:text-zinc-500">
            No reforecasts yet
          </span>
        )}

        {sortedReforecasts.length > 0 && !editingName && (
          <button
            type="button"
            onClick={beginEdit}
            className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:text-zinc-500 dark:hover:bg-blue-950 dark:hover:text-blue-400"
            title="Rename reforecast"
            aria-label="Rename reforecast"
          >
            <PencilIcon />
          </button>
        )}

        {reforecasts.length > 0 && (
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="rf-start-date"
              className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap"
            >
              Start
            </label>
            <input
              id="rf-start-date"
              type="date"
              value={reforecastStartDate}
              max={reforecastEndDate}
              onChange={(e) => handleStartChange(e.target.value)}
              title="Reforecast window start date"
              aria-label="Reforecast start date"
              style={{ width: 120, minWidth: 120 }}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        )}

        {reforecasts.length > 0 && (
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="rf-end-date"
              className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap"
            >
              End
            </label>
            <input
              id="rf-end-date"
              type="date"
              value={reforecastEndDate}
              min={reforecastStartDate}
              onChange={(e) => handleEndChange(e.target.value)}
              title="Reforecast window end date"
              aria-label="Reforecast end date"
              style={{ width: 120, minWidth: 120 }}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        )}

        {reforecasts.length > 0 && (
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="rf-date"
              className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap"
            >
              Date
            </label>
            <input
              id="rf-date"
              type="date"
              value={reforecastDate}
              min={reforecastStartDate <= today ? reforecastStartDate : today}
              max={today}
              onChange={(e) => handleReforecastDateChange(e.target.value)}
              title="Reforecast date"
              aria-label="Reforecast date"
              style={{ width: 120, minWidth: 120 }}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        )}

        {reforecasts.length > 0 && (
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="actuals-through-date"
              className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap"
            >
              Actuals Through
            </label>
            <input
              id="actuals-through-date"
              type="date"
              value={actualsThroughDate ?? ''}
              min={reforecastStartDate}
              max={reforecastEndDate}
              onChange={(e) => onActualsThroughDateChange(e.target.value || undefined)}
              title="Actuals through date — ETC starts the day after this date"
              aria-label="Actuals through date"
              style={{ width: 120, minWidth: 120 }}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            {actualsThroughDate && (
              <button
                type="button"
                onClick={() => onActualsThroughDateChange(undefined)}
                className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                title="Clear actuals through date"
                aria-label="Clear actuals through date"
              >
                &times;
              </button>
            )}
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            onClick={() => setShowNewDialog(true)}
            className="whitespace-nowrap rounded border border-blue-300 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
          >
            + New Reforecast
          </button>

          {reforecasts.length > 1 && (
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-950 dark:hover:text-red-400"
              title="Delete reforecast"
              aria-label="Delete reforecast"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      {showNewDialog && (
        <NewReforecastDialog
          reforecasts={sortedReforecasts}
          onConfirm={(name, copyFromId) => {
            onCreate(name, copyFromId);
            setShowNewDialog(false);
          }}
          onCancel={() => setShowNewDialog(false)}
        />
      )}

      {showDeleteDialog && (
        <ConfirmDialog
          title="Delete Reforecast"
          message={<>Are you sure you want to delete <strong>{sortedReforecasts.find((r) => r.id === selectedId)?.name ?? ''}</strong>? All allocations and productivity windows in this reforecast will be lost.</>}
          onConfirm={() => {
            onDelete(selectedId);
            setShowDeleteDialog(false);
          }}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}

      {pendingSummary && draftDate && (
        <BaseDialog
          title="Adjust reforecast window"
          actions={
            <>
              <button onClick={clearPending} className={dialogButtonStyles.cancel}>
                Cancel
              </button>
              <button onClick={handleConfirm} className={dialogButtonStyles.primary}>
                Confirm
              </button>
            </>
          }
        >
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{dialogHeading}</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            {renderSummaryBullets(pendingSummary)}
          </ul>
        </BaseDialog>
      )}
    </>
  );
}

function summaryOnlyFlagsWindows(s: TimelineChangeSummary): boolean {
  return (
    s.productivityWindowsToFlag > 0 &&
    s.allocationsToRemove === 0 &&
    s.historicalCostEntriesToRemove === 0 &&
    s.reforecastDateAdjustment === null &&
    s.actualsThroughDateAdjustment === null
  );
}

function renderSummaryBullets(s: TimelineChangeSummary): React.ReactNode {
  const items: React.ReactNode[] = [];
  if (s.allocationsToRemove > 0) {
    items.push(
      <li key="alloc">
        {s.allocationsToRemove === 1
          ? 'Remove 1 allocation outside the new date range.'
          : `Remove ${s.allocationsToRemove} allocations outside the new date range.`}
      </li>,
    );
  }
  if (s.historicalCostEntriesToRemove > 0) {
    items.push(
      <li key="hist">
        {s.historicalCostEntriesToRemove === 1
          ? 'Remove 1 historical cost entry outside the new range.'
          : `Remove ${s.historicalCostEntriesToRemove} historical cost entries outside the new range.`}
      </li>,
    );
  }
  if (s.productivityWindowsToFlag > 0) {
    items.push(
      <li key="pw">
        {s.productivityWindowsToFlag === 1
          ? '1 productivity window will fall outside the new range and be flagged for review.'
          : `${s.productivityWindowsToFlag} productivity windows will fall outside the new range and be flagged for review.`}
      </li>,
    );
  }
  if (s.reforecastDateAdjustment) {
    items.push(
      <li key="rd">
        Adjust the Reforecast Date from <strong>{s.reforecastDateAdjustment.from}</strong> to{' '}
        <strong>{s.reforecastDateAdjustment.to}</strong>.
      </li>,
    );
  }
  if (s.actualsThroughDateAdjustment) {
    items.push(
      <li key="atd">
        Adjust the Actuals Through date from <strong>{s.actualsThroughDateAdjustment.from}</strong>{' '}
        to <strong>{s.actualsThroughDateAdjustment.to}</strong>.
      </li>,
    );
  }
  return items;
}
