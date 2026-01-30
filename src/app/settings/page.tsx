'use client';

import { useSettings } from '@/features/settings/hooks/useSettings';
import { SettingsForm } from '@/features/settings/components/SettingsForm';
import { RateTable } from '@/features/settings/components/RateTable';
import { HolidayTable } from '@/features/settings/components/HolidayTable';
import { DataPortability } from '@/features/settings/components/DataPortability';

export default function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings();

  if (loading || !settings) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-4 text-zinc-500">Loading...</p>
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
        <DataPortability onImportComplete={handleImportComplete} />
      </div>
    </div>
  );
}
