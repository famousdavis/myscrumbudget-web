'use client';

import { useState } from 'react';
import type { Reforecast } from '@/types/domain';
import { NewReforecastDialog } from './NewReforecastDialog';

interface ReforecastToolbarProps {
  reforecasts: Reforecast[];
  activeReforecastId: string | null;
  onSwitch: (id: string) => void;
  onCreate: (name: string, copyFromId?: string) => void;
}

export function ReforecastToolbar({
  reforecasts,
  activeReforecastId,
  onSwitch,
  onCreate,
}: ReforecastToolbarProps) {
  const [showNewDialog, setShowNewDialog] = useState(false);

  const selectedId =
    activeReforecastId ?? (reforecasts.length > 0 ? reforecasts[0].id : '');

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <label
          htmlFor="rf-select"
          className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
        >
          Reforecast
        </label>

        {reforecasts.length > 0 ? (
          <select
            id="rf-select"
            value={selectedId}
            onChange={(e) => onSwitch(e.target.value)}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {reforecasts.map((rf) => (
              <option key={rf.id} value={rf.id}>
                {rf.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            No reforecasts yet
          </span>
        )}

        <button
          onClick={() => setShowNewDialog(true)}
          className="ml-auto rounded border border-blue-300 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
        >
          + New Reforecast
        </button>
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
    </>
  );
}
