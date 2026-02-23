'use client';

import { useEffect } from 'react';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { SettingsForm } from '@/features/settings/components/SettingsForm';
import { RateTable } from '@/features/settings/components/RateTable';
import { HolidayTable } from '@/features/settings/components/HolidayTable';
import { ThresholdSettings } from '@/features/settings/components/ThresholdSettings';
import { DataPortability } from '@/features/settings/components/DataPortability';
import { ExportAttribution } from '@/features/settings/components/ExportAttribution';
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
        <ExportAttribution />
        <hr className="border-zinc-200 dark:border-zinc-800" />
        <DataPortability onImportComplete={handleImportComplete} />
      </div>
    </div>
  );
}
