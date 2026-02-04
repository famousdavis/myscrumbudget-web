'use client';

import { useRef, useState } from 'react';
import { repo } from '@/lib/storage/repo';
import { runMigrations } from '@/lib/storage/migrations';
import { validateAppState } from '@/lib/utils/validation';
import { AlertDialog, ConfirmDialog } from '@/components/BaseDialog';
import type { AppState } from '@/types/domain';

type AlertState =
  | { kind: 'error'; title: string; message: string }
  | { kind: 'confirm-import' }
  | null;

interface DataPortabilityProps {
  onImportComplete: () => void;
}

export function DataPortability({ onImportComplete }: DataPortabilityProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [alertState, setAlertState] = useState<AlertState>(null);
  const [pendingImportData, setPendingImportData] = useState<AppState | null>(null);

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
      const data = JSON.parse(text);

      if (!data.version || typeof data.version !== 'string') {
        setAlertState({
          kind: 'error',
          title: 'Invalid File',
          message: 'Missing or invalid version field.',
        });
        return;
      }
      if (!data.settings || typeof data.settings !== 'object') {
        setAlertState({
          kind: 'error',
          title: 'Invalid File',
          message: 'Missing settings.',
        });
        return;
      }
      if (!Array.isArray(data.projects)) {
        setAlertState({
          kind: 'error',
          title: 'Invalid File',
          message: 'Missing or invalid projects array.',
        });
        return;
      }

      // Run migrations if importing data from an older version
      const migrated = runMigrations(data as AppState, data.version);

      // Deep validation of migrated data structure
      const validation = validateAppState(migrated);
      if (!validation.valid) {
        const errorSummary = validation.errors.slice(0, 5).join('\n');
        const moreErrors =
          validation.errors.length > 5
            ? `\n...and ${validation.errors.length - 5} more errors`
            : '';
        setAlertState({
          kind: 'error',
          title: 'Invalid Data Structure',
          message: `${errorSummary}${moreErrors}`,
        });
        return;
      }

      // Store data and show confirmation dialog
      setPendingImportData(migrated);
      setAlertState({ kind: 'confirm-import' });
    } catch {
      setAlertState({
        kind: 'error',
        title: 'Import Failed',
        message: 'Failed to parse the file. Please check the format.',
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImportData) return;
    await repo.importAll(pendingImportData);
    setPendingImportData(null);
    setAlertState(null);
    onImportComplete();
  };

  const handleCancelImport = () => {
    setPendingImportData(null);
    setAlertState(null);
  };

  const handleCloseAlert = () => {
    setAlertState(null);
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

      {alertState?.kind === 'error' && (
        <AlertDialog
          title={alertState.title}
          message={alertState.message}
          onClose={handleCloseAlert}
        />
      )}

      {alertState?.kind === 'confirm-import' && (
        <ConfirmDialog
          title="Replace All Data"
          message="This will replace all existing data. Are you sure you want to continue?"
          confirmLabel="Import"
          onConfirm={handleConfirmImport}
          onCancel={handleCancelImport}
        />
      )}
    </div>
  );
}
