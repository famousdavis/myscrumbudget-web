// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect, useState } from 'react';
import { getStorageMode } from '@/lib/storage/storageMode';
import { STORAGE_KEYS } from '@/types/storage';

export function LocalStorageWarningBanner() {
  // Always render nothing on SSR + first client render so the two stay in
  // sync. Compute real visibility in useEffect, which only runs client-side
  // after hydration. A lazy useState initializer with a typeof-window guard
  // would branch on the server vs client and produce a hydration mismatch.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (getStorageMode() !== 'local') return;
      if (localStorage.getItem(STORAGE_KEYS.suppressLocalStorageWarning) === 'true') return;
      // Deliberate: defer until after hydration. Reading these values at
      // useState init would re-introduce the hydration mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    } catch {
      // localStorage unavailable — leave hidden
    }
  }, []);

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
