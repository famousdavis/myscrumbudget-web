// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';
import { STORAGE_KEYS } from '@/types/storage';

/**
 * Checkbox + label controlling the `msb:suppressLocalStorageWarning` flag.
 * Rendered inside the "Notifications" section on both the Settings page
 * and the Cloud Storage modal so the two surfaces stay in lock-step.
 */
export function LocalStorageWarningToggle() {
  const [warnEnabled, setWarnEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return localStorage.getItem(STORAGE_KEYS.suppressLocalStorageWarning) !== 'true';
    } catch {
      return true;
    }
  });

  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={warnEnabled}
        onChange={(e) => {
          const checked = e.target.checked;
          setWarnEnabled(checked);
          try {
            localStorage.setItem(
              STORAGE_KEYS.suppressLocalStorageWarning,
              checked ? 'false' : 'true',
            );
          } catch {
            // Best-effort — ignore quota/SecurityError
          }
        }}
        className="mt-0.5"
      />
      <div>
        <span className="font-medium">Warn me on startup when using local storage</span>
        <p className="text-zinc-500 dark:text-zinc-400">
          Shows a caution banner each time the app opens while your data is stored locally in this browser.
        </p>
      </div>
    </label>
  );
}
