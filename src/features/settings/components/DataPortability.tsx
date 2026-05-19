// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { repo } from '@/lib/storage/repo';
import { useToast } from '@/components/Toast';

/**
 * Export-only component (v0.30.0+). Import moved to the Dashboard with a
 * per-project preview and conflict-detection workflow — see useImportState
 * and ImportPreviewSection.
 */
export function DataPortability() {
  const { addToast } = useToast();

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
    addToast('Export complete', 'success');
  };

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Data Export
      </h3>
      <div className="flex items-center gap-3">
        <button
          onClick={handleExport}
          className="rounded bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Export JSON
        </button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          To import a workspace, use the &ldquo;Import JSON&rdquo; button on the Dashboard.
        </p>
      </div>
    </div>
  );
}
