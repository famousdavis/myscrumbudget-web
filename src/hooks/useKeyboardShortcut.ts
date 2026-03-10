// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { useEffect } from 'react';

/**
 * Registers a global keyboard shortcut.
 * The callback is invoked when the specified key + modifier combination is pressed.
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: { ctrl?: boolean; shift?: boolean } = {},
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (options.ctrl && !(e.ctrlKey || e.metaKey)) return;
      if (options.shift && !e.shiftKey) return;
      if (e.key !== key) return;

      e.preventDefault();
      callback();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [key, callback, options.ctrl, options.shift]);
}
