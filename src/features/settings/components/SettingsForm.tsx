'use client';

import type { Settings } from '@/types/domain';

interface SettingsFormProps {
  settings: Settings;
  onUpdate: (updater: (prev: Settings) => Settings) => void;
}

export function SettingsForm({ settings, onUpdate }: SettingsFormProps) {
  return (
    <div className="space-y-6">
      <div>
        <label
          htmlFor="discountRate"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Annual Discount Rate (%)
        </label>
        <input
          id="discountRate"
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={(settings.discountRateAnnual * 100).toFixed(1)}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val >= 0) {
              onUpdate((prev) => ({
                ...prev,
                discountRateAnnual: val / 100,
              }));
            }
          }}
          className="mt-1 w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
    </div>
  );
}
