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
          // SECURITY (v0.28.2 / L9): do NOT include `value` in the log —
          // the closed-over T may be a Project / Settings / TeamPool
          // payload containing member emails or UIDs. A malicious browser
          // extension scraping console output would harvest PII. Log the
          // error only.
          console.error('[useDebouncedSave] save failed:', err);
        });
      }, DEBOUNCE_MS);
    },
    [saveFn],
  );

  /**
   * Flush any pending save synchronously. Returns a Promise that resolves
   * when the underlying saveFn completes (or rejects, swallowed and logged).
   * Callers that need a guaranteed-persisted state before navigation MUST
   * `await flush()` (v0.29.2 fix — prevents Edit-page → Detail-page state
   * staleness after a date change).
   *
   * Returns a resolved Promise when there is nothing pending (caller can
   * still `await` safely with no extra latency).
   */
  const flush = useCallback((): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current) {
      const value = pendingRef.current.value;
      pendingRef.current = null;
      return Promise.resolve(saveFn(value)).catch((err) => {
        // SECURITY (v0.28.2 / L9): do NOT include the rejected value in
        // the log (see save() above for rationale).
        console.error('[useDebouncedSave] flush failed:', err);
      });
    }
    return Promise.resolve();
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
