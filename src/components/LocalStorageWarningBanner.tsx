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
  //
  // Since v0.44.7 this banner renders inside the provider stack, below
  // `TopBar` (see `ShellTop`), so `MigrationGuard` keeps it out of hydration
  // today. That shield belongs to the layout, not to this file; keep this form,
  // which is safe wherever the banner sits. "Got it" is in-memory only: the
  // layout stays mounted across in-app navigation, so the caution stays hidden
  // until the next page load and returns on the next one.
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
    // The frame's caution notice (`.sf-notice--caution`, FRAME26 contract §3, v0.45.0). Its "Got it" is the frame's
    // `.sf-notice-dismiss`; it still writes nothing, so the caution comes back on the next load.
    <div className="sf-notice sf-notice--caution">
      <p>
        <strong>Your data exists only in this browser</strong> and can be lost
        without warning. Export at the end of every session to protect your work.
      </p>
      <button type="button" onClick={() => setVisible(false)} className="sf-notice-dismiss">
        Got it
      </button>
    </div>
  );
}
