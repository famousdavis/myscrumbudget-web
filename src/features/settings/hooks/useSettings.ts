'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '@/types/domain';
import { repo } from '@/lib/storage/repo';
import { useDebouncedSave } from '@/hooks/useDebouncedSave';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    repo.getSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const { save: persistSettings } = useDebouncedSave<Settings>((s) => repo.saveSettings(s));

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
