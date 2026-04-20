// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';
import { getStorageMode } from '@/lib/storage/storageMode';
import { STORAGE_KEYS } from '@/types/storage';

export function LocalStorageWarningBanner() {
  // Lazy initializer reads localStorage once on mount; SSR-safe via the
  // typeof window guard (returns false on the server, so the banner never
  // renders during SSR — avoids hydration mismatch).
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (getStorageMode() !== 'local') return false;
      if (localStorage.getItem(STORAGE_KEYS.suppressLocalStorageWarning) === 'true') return false;
      return true;
    } catch {
      return false;
    }
  });

  if (!visible) return null;

  return (
    <div className="mb-6 flex items-start justify-between gap-3 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-zinc-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-zinc-300">
      <p>
        <strong>Your data exists only in this browser</strong> and can be lost
        without warning. Export at the end of every session to protect your work.
      </p>
      <button
        onClick={() => setVisible(false)}
        className="shrink-0 rounded border border-amber-300 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/50"
      >
        Got it
      </button>
    </div>
  );
}
