// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { register, registerKeyed } from '@/lib/storage/pendingSaveRegistry';

const DEBOUNCE_MS = 500;

/**
 * Returns a debounced save callback and a flush function.
 * Each new call resets the timer so only the last value is persisted.
 *
 * Optional `registryKey` lets callers register the cancel callback in the
 * per-key cancel registry so that `cancelByKey(registryKey)` can abort
 * pending saves for a specific entity (e.g., a project being deleted).
 * Cancel is ALSO registered globally; both registries are stripped on unmount.
 */
export function useDebouncedSave<T>(saveFn: (value: T) => void, registryKey?: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ value: T } | null>(null);

  const save = useCallback(
    (value: T) => {
      pendingRef.current = { value };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        pendingRef.current = null;
        Promise.resolve(saveFn(value)).catch((err) => {
          // SECURITY (v0.28.2 / L9): do NOT include `value` in the log —
          // the closed-over T may be a Project / Settings / TeamPool
          // payload containing member emails or UIDs.
          console.error('[useDebouncedSave] save failed:', err);
        });
      }, DEBOUNCE_MS);
    },
    [saveFn],
  );

  const flush = useCallback((): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current) {
      const value = pendingRef.current.value;
      pendingRef.current = null;
      return Promise.resolve(saveFn(value)).catch((err) => {
        console.error('[useDebouncedSave] flush failed:', err);
      });
    }
    return Promise.resolve();
  }, [saveFn]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  useEffect(() => {
    const unregisterGlobal = register(cancel, flush);
    const unregisterKeyed = registryKey ? registerKeyed(registryKey, cancel) : () => {};
    return () => { unregisterGlobal(); unregisterKeyed(); };
  }, [cancel, flush, registryKey]);

  return { save, flush, cancel };
}
