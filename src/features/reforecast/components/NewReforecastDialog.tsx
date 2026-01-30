'use client';

import { useState } from 'react';
import type { Reforecast } from '@/types/domain';
import { BaseDialog, dialogButtonStyles } from '@/components/BaseDialog';

interface NewReforecastDialogProps {
  reforecasts: Reforecast[];
  onConfirm: (name: string, copyFromId?: string) => void;
  onCancel: () => void;
}

export function NewReforecastDialog({
  reforecasts,
  onConfirm,
  onCancel,
}: NewReforecastDialogProps) {
  const [name, setName] = useState('');
  const [copyFromId, setCopyFromId] = useState(
    reforecasts.length > 0 ? reforecasts[reforecasts.length - 1].id : ''
  );
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Reforecast name is required.');
      return;
    }
    onConfirm(trimmed, copyFromId || undefined);
  };

  return (
    <BaseDialog
      title="New Reforecast"
      actions={
        <>
          <button
            type="button"
            onClick={onCancel}
            className={dialogButtonStyles.cancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="new-reforecast-form"
            disabled={!name.trim()}
            className={dialogButtonStyles.primary}
          >
            Create
          </button>
        </>
      }
    >
      <form id="new-reforecast-form" onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="rf-name"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Name
          </label>
          <input
            id="rf-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            maxLength={50}
            autoFocus
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="e.g., Q3 Reforecast"
          />
          {error && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {reforecasts.length > 0 && (
          <div>
            <label
              htmlFor="rf-copy-from"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Copy allocations from
            </label>
            <select
              id="rf-copy-from"
              value={copyFromId}
              onChange={(e) => setCopyFromId(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">Start fresh</option>
              {reforecasts.map((rf) => (
                <option key={rf.id} value={rf.id}>
                  {rf.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </form>
    </BaseDialog>
  );
}
