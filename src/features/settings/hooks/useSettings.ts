'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Settings } from '@/types/domain';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';

const repo = createLocalStorageRepository();
const DEBOUNCE_MS = 500;

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    repo.getSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const persistSettings = useCallback((updated: Settings) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      repo.saveSettings(updated);
    }, DEBOUNCE_MS);
  }, []);

  const updateSettings = useCallback(
    (updater: (prev: Settings) => Settings) => {
      setSettings((prev) => {
        if (!prev) return prev;
        const updated = updater(prev);
        persistSettings(updated);
        return updated;
      });
    },
    [persistSettings]
  );

  return { settings, loading, updateSettings };
}
