'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '@/types/domain';
import { repo } from '@/lib/storage/repo';
import { useDebouncedSave } from '@/hooks/useDebouncedSave';
import { cloudSyncBus } from '@/lib/firebase/cloudSyncBus';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const s = await repo.getSettings();
    setSettings(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Subscribe to cloud sync events for settings
  useEffect(() => {
    return cloudSyncBus.subscribe((event) => {
      if (event === 'settings') reload();
    });
  }, [reload]);

  const { save: persistSettings, flush } = useDebouncedSave<Settings>((s) => repo.saveSettings(s));

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

  return { settings, loading, updateSettings, flush };
}
