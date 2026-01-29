'use client';

import { useState } from 'react';
import type { Reforecast } from '@/types/domain';

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
  const [copyFromId, setCopyFromId] = useState('');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">New Reforecast</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
