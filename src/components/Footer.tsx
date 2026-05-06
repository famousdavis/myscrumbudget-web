// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { APP_VERSION } from '@/lib/constants';
import { TOS_URL, PRIVACY_URL, LICENSE_URL } from '@/lib/tos/tosConstants';
import { ShortcutsDialog } from './ShortcutsDialog';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';

export function Footer() {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const toggleShortcuts = useCallback(() => setShowShortcuts((v) => !v), []);
  useKeyboardShortcut('?', toggleShortcuts, { ctrl: true });

  return (
    <>
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-3 text-sm text-gray-500 dark:text-gray-400">
        <div className="mx-auto w-full max-w-7xl px-4 text-center">
          <div>
            &copy; {new Date().getFullYear()} William W. Davis, MSPM, PMP |{' '}
            <Link href="/changelog" className="text-blue-600 hover:text-blue-700">
              Version {APP_VERSION}
            </Link>{' '}
            | Licensed under GNU GPL v3 |{' '}
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className="text-blue-600 hover:text-blue-700"
              title="Keyboard shortcuts (Ctrl+?)"
              aria-label="Show keyboard shortcuts"
            >
              Keyboard shortcuts
            </button>
          </div>
          <div className="mt-1">
            <a href="https://spertsuite.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
              SPERT&reg; Suite
            </a>
            {' | '}
            <a href={TOS_URL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
              Terms of Service
            </a>
            {' | '}
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
              Privacy Policy
            </a>
            {' | '}
            <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
              License
            </a>
          </div>
        </div>
      </footer>
      {showShortcuts && (
        <ShortcutsDialog onClose={() => setShowShortcuts(false)} />
      )}
    </>
  );
}
