// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect } from 'react';
import { TOS_URL, PRIVACY_URL } from '@/lib/tos/tosConstants';
import { isTosAccepted } from '@/lib/tos/tosHelpers';

const FIRST_RUN_KEY = 'spert_firstRun_seen';

export function FirstRunBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(FIRST_RUN_KEY) === 'true';
      if (!dismissed && !isTosAccepted()) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check visibility when storage changes (e.g., after ToS acceptance in modal)
  useEffect(() => {
    if (!visible) return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === FIRST_RUN_KEY || e.key === 'spert_tos_accepted_version') {
        if (isTosAccepted() || localStorage.getItem(FIRST_RUN_KEY) === 'true') {
          setVisible(false);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [visible]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(FIRST_RUN_KEY, 'true');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const linkClass = 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline';

  return (
    <div className="mb-6 flex items-start justify-between gap-3 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-zinc-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-zinc-300">
      <p>
        SPERT&reg; Suite web apps are free to use. No account is required. If you choose to
        enable optional Cloud Storage, you will be asked to review and agree to our{' '}
        <a href={TOS_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
          Terms of Service
        </a>{' '}
        and{' '}
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
          Privacy Policy
        </a>
        .
      </p>
      <button
        onClick={dismiss}
        className="shrink-0 rounded border border-blue-300 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-900/50"
      >
        Got it
      </button>
    </div>
  );
}
