// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { SettingsForm } from '@/features/settings/components/SettingsForm';
import { RateTable } from '@/features/settings/components/RateTable';
import { HolidayTable } from '@/features/settings/components/HolidayTable';
import { ThresholdSettings } from '@/features/settings/components/ThresholdSettings';
import { DataPortability } from '@/features/settings/components/DataPortability';
import { ExportAttribution } from '@/features/settings/components/ExportAttribution';
import { CloudStorageSection } from '@/features/settings/components/CloudStorageSection';
import { Skeleton } from '@/components/Skeleton';
import { STORAGE_KEYS } from '@/types/storage';

export default function SettingsPage() {
  const { settings, loading, updateSettings, flush } = useSettings();

  useEffect(() => () => { flush(); }, [flush]);

  const [warnEnabled, setWarnEnabled] = useState(true);
  useEffect(() => {
    setWarnEnabled(
      localStorage.getItem(STORAGE_KEYS.suppressLocalStorageWarning) !== 'true'
    );
  }, []);

  if (loading || !settings) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="mt-6 space-y-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const handleImportComplete = () => {
    window.location.reload();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="mt-6 space-y-8">
        <SettingsForm settings={settings} onUpdate={updateSettings} />
        <hr className="border-zinc-200 dark:border-zinc-800" />
        <RateTable rates={settings.laborRates} onUpdate={updateSettings} />
        <hr className="border-zinc-200 dark:border-zinc-800" />
        <HolidayTable holidays={settings.holidays} onUpdate={updateSettings} />
        <hr className="border-zinc-200 dark:border-zinc-800" />
        <ThresholdSettings
          amberPercent={settings.trafficLightThresholds.amberPercent}
          redPercent={settings.trafficLightThresholds.redPercent}
          onUpdate={updateSettings}
        />
        <hr className="border-zinc-200 dark:border-zinc-800" />
        <div>
          <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Notifications
          </h3>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={warnEnabled}
              onChange={(e) => {
                const checked = e.target.checked;
                setWarnEnabled(checked);
                localStorage.setItem(
                  STORAGE_KEYS.suppressLocalStorageWarning,
                  checked ? 'false' : 'true'
                );
              }}
              className="mt-0.5"
            />
            <div>
              <span className="font-medium">Warn me on startup when using local storage</span>
              <p className="text-zinc-500 dark:text-zinc-400">
                Shows a caution banner each time the app opens while your data is stored locally in this browser.
              </p>
            </div>
          </label>
        </div>
        <hr className="border-zinc-200 dark:border-zinc-800" />
        <CloudStorageSection />
        <hr className="border-zinc-200 dark:border-zinc-800" />
        <ExportAttribution />
        <hr className="border-zinc-200 dark:border-zinc-800" />
        <DataPortability onImportComplete={handleImportComplete} />
      </div>
    </div>
  );
}
