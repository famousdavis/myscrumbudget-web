'use client';

import type { Settings } from '@/types/domain';
import { CollapsibleSection } from '@/components/CollapsibleSection';

interface ThresholdSettingsProps {
  amberPercent: number;
  redPercent: number;
  onUpdate: (updater: (prev: Settings) => Settings) => void;
}

export function ThresholdSettings({ amberPercent, redPercent, onUpdate }: ThresholdSettingsProps) {
  const handleChange = (field: 'amberPercent' | 'redPercent', value: string) => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) return;
    onUpdate((prev) => ({
      ...prev,
      trafficLightThresholds: {
        ...prev.trafficLightThresholds,
        [field]: parsed,
      },
    }));
  };

  return (
    <CollapsibleSection title="Dashboard Thresholds">
      <div className="max-w-md space-y-4">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Set variance percentage thresholds for project status indicators on the dashboard.
        </p>
        <div className="flex items-center gap-4">
          <label className="w-32 text-sm text-zinc-600 dark:text-zinc-400">
            Amber above (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={amberPercent}
            onChange={(e) => handleChange('amberPercent', e.target.value)}
            className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="w-32 text-sm text-zinc-600 dark:text-zinc-400">
            Red above (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={redPercent}
            onChange={(e) => handleChange('redPercent', e.target.value)}
            className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        {redPercent < amberPercent && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Red threshold is below amber — the amber band will be empty.
          </p>
        )}
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Green: at or below amber threshold. Amber: above amber, at or below red. Red: above red threshold.
        </p>
      </div>
    </CollapsibleSection>
  );
}
