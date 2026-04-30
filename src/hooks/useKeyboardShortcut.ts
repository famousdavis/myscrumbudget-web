// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { useEffect } from 'react';

/**
 * Registers a global keyboard shortcut.
 *
 * `options.shift` is tristate:
 *   true      — Shift must be PRESENT
 *   false     — Shift must be ABSENT
 *   undefined — either (the default; preserved so callers like `Ctrl+?`
 *               match regardless of whether Shift is pressed)
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: { ctrl?: boolean; shift?: boolean } = {},
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (options.ctrl && !(e.ctrlKey || e.metaKey)) return;
      if (options.shift === true && !e.shiftKey) return;
      if (options.shift === false && e.shiftKey) return;
      if (e.key !== key) return;

      e.preventDefault();
      callback();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [key, callback, options.ctrl, options.shift]);
}
