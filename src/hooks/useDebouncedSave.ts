// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { register as registerPendingSave } from '@/lib/storage/pendingSaveRegistry';

const DEBOUNCE_MS = 500;

/**
 * Returns a debounced save callback and a flush function.
 * Each new call resets the timer so only the last value is persisted.
 * Call `flush()` to immediately persist any pending value.
 */
export function useDebouncedSave<T>(saveFn: (value: T) => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ value: T } | null>(null);

  const save = useCallback(
    (value: T) => {
      pendingRef.current = { value };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        pendingRef.current = null;
        Promise.resolve(saveFn(value)).catch((err) => {
          console.error('[useDebouncedSave] save failed:', err);
        });
      }, DEBOUNCE_MS);
    },
    [saveFn],
  );

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current) {
      saveFn(pendingRef.current.value);
      pendingRef.current = null;
    }
  }, [saveFn]);

  /** Cancel any pending debounced save without persisting. */
  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  // Register this instance's cancel with the module-level registry so
  // `performSignOutCleanup` can abort every in-flight save before Firebase
  // credentials are revoked. Unregisters on unmount.
  useEffect(() => registerPendingSave(cancel), [cancel]);

  return { save, flush, cancel };
}
