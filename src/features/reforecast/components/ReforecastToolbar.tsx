// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';
import type { Reforecast } from '@/types/domain';
import { NewReforecastDialog } from './NewReforecastDialog';
import { ConfirmDialog } from '@/components/BaseDialog';

interface ReforecastToolbarProps {
  reforecasts: Reforecast[];
  activeReforecastId: string | null;
  reforecastDate: string;
  actualsThroughDate?: string;
  onSwitch: (id: string) => void;
  onCreate: (name: string, copyFromId?: string) => void;
  onDelete: (id: string) => void;
  onReforecastDateChange: (date: string) => void;
  onActualsThroughDateChange: (date: string | undefined) => void;
}

export function ReforecastToolbar({
  reforecasts,
  activeReforecastId,
  reforecastDate,
  actualsThroughDate,
  onSwitch,
  onCreate,
  onDelete,
  onReforecastDateChange,
  onActualsThroughDateChange,
}: ReforecastToolbarProps) {
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const selectedId =
    activeReforecastId ?? (reforecasts.length > 0 ? reforecasts[0].id : '');

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 md:flex-nowrap md:gap-3 dark:border-zinc-800 dark:bg-zinc-900">
        <label
          htmlFor="rf-select"
          className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
        >
          Reforecast
        </label>

        {reforecasts.length > 0 ? (
          <select
            id="rf-select"
            value={selectedId}
            onChange={(e) => onSwitch(e.target.value)}
            className="min-w-64 rounded border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {reforecasts.map((rf) => (
              <option key={rf.id} value={rf.id}>
                {rf.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-zinc-400 dark:text-zinc-500">
            No reforecasts yet
          </span>
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
              onChange={(e) => onReforecastDateChange(e.target.value)}
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
          {reforecasts.length > 1 && (
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="whitespace-nowrap rounded border border-red-200 px-3 py-1 text-sm font-medium text-red-500 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Delete
            </button>
          )}

          <button
            onClick={() => setShowNewDialog(true)}
            className="whitespace-nowrap rounded border border-blue-300 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
          >
            + New Reforecast
          </button>
        </div>
      </div>

      {showNewDialog && (
        <NewReforecastDialog
          reforecasts={reforecasts}
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
          message={<>Are you sure you want to delete <strong>{reforecasts.find((r) => r.id === selectedId)?.name ?? ''}</strong>? All allocations and productivity windows in this reforecast will be lost.</>}
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
