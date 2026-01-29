'use client';

import { useRef } from 'react';
import { repo } from '@/lib/storage/repo';
import type { AppState } from '@/types/domain';

interface DataPortabilityProps {
  onImportComplete: () => void;
}

export function DataPortability({ onImportComplete }: DataPortabilityProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    const data = await repo.exportAll();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myscrumbudget-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as AppState;

      if (!data.version || !data.settings || !data.projects) {
        alert('Invalid file format. Expected a MyScrumBudget export file.');
        return;
      }

      if (
        !confirm(
          'This will replace all existing data. Are you sure you want to continue?'
        )
      ) {
        return;
      }

      await repo.importAll(data);
      onImportComplete();
    } catch {
      alert('Failed to parse the file. Please check the format.');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Data Export / Import
      </h3>
      <div className="flex items-center gap-3">
        <button
          onClick={handleExport}
          className="rounded bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Export JSON
        </button>
        <label className="cursor-pointer rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
          Import JSON
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}
