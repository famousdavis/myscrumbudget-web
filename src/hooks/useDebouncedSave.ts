'use client';

import { useCallback, useRef } from 'react';

const DEBOUNCE_MS = 500;

/**
 * Returns a stable callback that debounces calls to `saveFn`.
 * Each new call resets the timer so only the last value is persisted.
 */
export function useDebouncedSave<T>(saveFn: (value: T) => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (value: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => saveFn(value), DEBOUNCE_MS);
    },
    [saveFn],
  );
}
