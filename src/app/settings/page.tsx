// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect } from 'react';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { SettingsForm } from '@/features/settings/components/SettingsForm';
import { RateTable } from '@/features/settings/components/RateTable';
import { HolidayTable } from '@/features/settings/components/HolidayTable';
import { ThresholdSettings } from '@/features/settings/components/ThresholdSettings';
import { DataPortability } from '@/features/settings/components/DataPortability';
import { ExportAttribution } from '@/features/settings/components/ExportAttribution';
import { CloudStorageSection } from '@/features/settings/components/CloudStorageSection';
import { LocalStorageWarningToggle } from '@/features/settings/components/LocalStorageWarningToggle';
import { Skeleton } from '@/components/Skeleton';

export default function SettingsPage() {
  const { settings, loading, updateSettings, flush } = useSettings();

  useEffect(() => () => { flush(); }, [flush]);

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
          violetPercent={settings.trafficLightThresholds.violetPercent}
          onUpdate={updateSettings}
        />
        <hr className="border-zinc-200 dark:border-zinc-800" />
        <div>
          <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Notifications
          </h3>
          <LocalStorageWarningToggle />
        </div>
        <hr className="border-zinc-200 dark:border-zinc-800" />
        <CloudStorageSection />
        <hr className="border-zinc-200 dark:border-zinc-800" />
        <ExportAttribution />
        <hr className="border-zinc-200 dark:border-zinc-800" />
        <DataPortability />
      </div>
    </div>
  );
}
