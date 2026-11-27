// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { APP_VERSION } from '@/lib/constants';
import { TOS_URL, PRIVACY_URL, LICENSE_URL } from '@/lib/tos/tosConstants';
import { ShortcutsDialog } from './ShortcutsDialog';
import { CopyrightYear } from './CopyrightYear';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';

/**
 * The frame's footer (FRAME26, contract §3 and §6, v0.45.0): a full-width 69 px band with a 1 px top rule and two
 * centred lines, flowing after `main`. Wording and destinations are unchanged. The links' colour is the frame's
 * `--sf-link` (`#155dfc` / `#51a2ff`: 5.25 and 6.73 : 1 on the page ground) and their hover underline is the frame's
 * too, never a utility here: the stylesheet is unlayered, so a utility would lose anyway (stage 0's colour pairs,
 * v0.44.14, gave way to it). "Keyboard shortcuts" is a `button.sf-link`, styled as the links. `Footer.contrast.test.tsx`
 * holds this. The © year is `CopyrightYear` (FRAME26 Y1, v0.47.0), which the About page also renders, so the two can
 * never differ, and which renders the visitor's year without a hydration mismatch after 1 January.
 *
 * The shortcuts dialog renders in a `font-sans` wrapper so it keeps the body's font (Geist): `.sf-app` sets the frame's
 * font stack, and a dialog inherits from where it is rendered (there are no portals here).
 */
export function Footer() {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const toggleShortcuts = useCallback(() => setShowShortcuts((v) => !v), []);
  useKeyboardShortcut('?', toggleShortcuts, { ctrl: true });

  return (
    <>
      <footer className="sf-footer" data-sf="footer">
        <div className="sf-col">
          <div>
            &copy; <CopyrightYear /> William W. Davis, MSPM, PMP |{' '}
            <Link href="/changelog">Version {APP_VERSION}</Link>{' '}
            | Licensed under GNU GPL v3 |{' '}
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className="sf-link"
              title="Keyboard shortcuts (Ctrl+?)"
              aria-label="Show keyboard shortcuts"
            >
              Keyboard shortcuts
            </button>
          </div>
          <div>
            <a href="https://spertsuite.com" target="_blank" rel="noopener noreferrer">
              SPERT&reg; Suite
            </a>
            {' | '}
            <a href={TOS_URL} target="_blank" rel="noopener noreferrer">
              Terms of Service
            </a>
            {' | '}
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
            {' | '}
            <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">
              License
            </a>
          </div>
        </div>
      </footer>
      {showShortcuts && (
        <div className="font-sans">
          <ShortcutsDialog onClose={() => setShowShortcuts(false)} />
        </div>
      )}
    </>
  );
}
