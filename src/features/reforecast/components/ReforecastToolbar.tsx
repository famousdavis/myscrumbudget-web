// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useRef, useEffect } from 'react';
import type { Reforecast } from '@/types/domain';
import { NewReforecastDialog } from './NewReforecastDialog';
import { ConfirmDialog } from '@/components/BaseDialog';
import { TrashIcon } from '@/components/icons/TrashIcon';
import { PencilIcon } from '@/components/icons/PencilIcon';

interface ReforecastToolbarProps {
  reforecasts: Reforecast[];
  activeReforecastId: string | null;
  reforecastDate: string;
  actualsThroughDate?: string;
  /**
   * Active reforecast's window — used to set min/max bounds on the
   * Reforecast Date and Actuals Through date inputs (v0.29.1). The
   * window itself is edited via the project edit page, not here.
   */
  reforecastStartDate: string;
  reforecastEndDate: string;
  onSwitch: (id: string) => void;
  onCreate: (name: string, copyFromId?: string) => void;
  onDelete: (id: string) => void;
  onRename: (newName: string) => void;
  onReforecastDateChange: (date: string) => void;
  onActualsThroughDateChange: (date: string | undefined) => void;
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
}: ReforecastToolbarProps) {
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

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

  // Returns the clamped string when a non-empty value was committed to the
  // store. Returns undefined for empty input (user cleared the picker) so
  // the caller can suppress the local-buffer update and let React revert
  // the controlled input to the prior valid value.
  const handleReforecastDateChange = (newValue: string): string | undefined => {
    if (!newValue) return undefined;
    const minBound = reforecastStartDate <= today ? reforecastStartDate : today;
    let clamped = newValue;
    if (clamped > today) clamped = today;
    if (clamped < minBound) clamped = minBound;
    onReforecastDateChange(clamped);
    return clamped;
  };

  // ── A3 local buffer for date inputs ──────────────────────────────────────
  // Date inputs write to the store on every onChange. Focus guards prevent
  // incoming cloud-sync prop updates from overwriting a date the user is
  // actively selecting.
  //
  // For reforecast date: setLocalRfDate receives the CLAMPED value (the return
  // from handleReforecastDateChange). Without this, an out-of-range date
  // entered via paste/keyboard would display the unclamped value while the
  // store held the clamped one.
  //
  // S2 — clear-input handling: if the user clears the date picker
  // (e.target.value === ''), handleReforecastDateChange returns undefined and
  // does NOT update the store. We must NOT setLocalRfDate('') in that case —
  // doing so leaves the displayed buffer empty while the store retains the
  // prior value, and the prop-sync effect cannot recover because reforecastDate
  // did not change. Skipping setLocalRfDate keeps the controlled input pinned
  // to the prior valid value (React reverts the visual clear automatically).
  const [localRfDate, setLocalRfDate] = useState(reforecastDate);
  const rfDateFocusedRef = useRef(false);
  const [localActualsDate, setLocalActualsDate] = useState(actualsThroughDate ?? '');
  const actualsFocusedRef = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!rfDateFocusedRef.current) setLocalRfDate(reforecastDate);
  }, [reforecastDate]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!actualsFocusedRef.current) setLocalActualsDate(actualsThroughDate ?? '');
  }, [actualsThroughDate]);
  // ─────────────────────────────────────────────────────────────────────────

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
              htmlFor="rf-date"
              className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap"
            >
              Date
            </label>
            <input
              id="rf-date"
              type="date"
              value={localRfDate}
              min={reforecastStartDate <= today ? reforecastStartDate : today}
              max={today}
              onFocus={() => { rfDateFocusedRef.current = true; }}
              onBlur={() => { rfDateFocusedRef.current = false; }}
              onChange={(e) => {
                const clamped = handleReforecastDateChange(e.target.value);
                // Only update the local buffer when the handler committed a
                // value to the store. Skipping the update on an empty input
                // lets React's controlled-input behavior revert the visual
                // clear to the prior valid localRfDate (S2 — clear-date fix).
                if (clamped !== undefined) setLocalRfDate(clamped);
              }}
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
              value={localActualsDate}
              min={reforecastStartDate}
              max={reforecastEndDate}
              onFocus={() => { actualsFocusedRef.current = true; }}
              onBlur={() => { actualsFocusedRef.current = false; }}
              onChange={(e) => {
                setLocalActualsDate(e.target.value);
                onActualsThroughDateChange(e.target.value || undefined);
              }}
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
    </>
  );
}
