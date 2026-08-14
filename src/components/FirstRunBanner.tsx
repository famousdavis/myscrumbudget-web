// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect } from 'react';
import { TOS_URL, PRIVACY_URL } from '@/lib/tos/tosConstants';
import { isTosAccepted } from '@/lib/tos/tosHelpers';

const FIRST_RUN_KEY = 'spert_firstRun_seen';

export function FirstRunBanner() {
  // Always false on the first render — on the server AND on the client. Real
  // visibility is computed in the effect below, which only runs after hydration.
  //
  // ⚠️ Do NOT "simplify" this into a lazy useState initializer with a
  // `typeof window === 'undefined'` guard. That guard looks SSR-safe and is the
  // opposite: the server returns false, the client's FIRST render returns the
  // real localStorage value, and those two disagreeing IS the hydration
  // mismatch. This component shipped that exact construct — with a comment
  // claiming it was safe — and produced a React #418 on every page load for
  // every visitor who had not dismissed this banner. `LocalStorageWarningBanner`
  // had the same bug fixed in v0.21.6; this one was missed for 15 releases
  // because its comment asserted the pattern was fine.
  //
  // The pattern is only harmless in a component that cannot render during
  // hydration. Every other lazy-initializer site in this app sits inside
  // `MigrationGuard`, which returns null on the server and on the client's first
  // render. This banner and its sibling are rendered OUTSIDE it, which is
  // precisely why they were the two exposed.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(FIRST_RUN_KEY) === 'true') return;
      if (isTosAccepted()) return;
      // Deliberate: defer until after hydration. Reading these values at
      // useState init would re-introduce the hydration mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    } catch {
      // localStorage unavailable — leave hidden
    }
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
        SPERT&reg; Suite web apps are free to use. No account is required to use them. By
        accessing or using this app, you agree to our{' '}
        <a href={TOS_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
          Terms of Service
        </a>{' '}
        and{' '}
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
          Privacy Policy
        </a>
        . If you choose to enable optional Cloud Storage, you&apos;ll be asked to explicitly
        confirm your agreement.
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
