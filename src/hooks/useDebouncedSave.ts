'use client';

import { useCallback, useRef } from 'react';

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
        saveFn(value);
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

  return { save, flush };
}
