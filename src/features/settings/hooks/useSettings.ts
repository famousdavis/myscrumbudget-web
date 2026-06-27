// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '@/types/domain';
import { repo } from '@/lib/storage/repo';
import { useDebouncedSave } from '@/hooks/useDebouncedSave';
import { cloudSyncBus } from '@/lib/firebase/cloudSyncBus';
import { addToastGlobal } from '@/components/Toast';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const s = await repo.getSettings();
      setSettings(s);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== 'permission-denied') {
        // v0.31.0 (I2): permission-denied is silent across the cloud-sync
        // chain. The listener emitted a bus event that brought us here;
        // useSettings and useTeamPool both react to the same event, so
        // toasting in either would produce a confusing duplicate. Silent
        // eviction is intentional — users who lost access (sign-out
        // cascade, admin revocation) typically already know.
        addToastGlobal('Failed to load settings. Please check your connection.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch-on-mount + cloudSyncBus subscription — externally driven, not cascading.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  // Subscribe to cloud sync events for settings
  useEffect(() => {
    return cloudSyncBus.subscribe((event) => {
      if (event === 'settings') reload();
    });
  }, [reload]);

  const persistSettingsFn = useCallback(async (s: Settings) => {
    try {
      await repo.saveSettings(s);
    } catch (err) {
      addToastGlobal('Failed to save settings. Please check your connection.', 'error');
      throw err;
    }
  }, []);
  const { save: persistSettings, flush } = useDebouncedSave<Settings>(persistSettingsFn);

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
