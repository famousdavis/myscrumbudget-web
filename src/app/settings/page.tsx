// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Settings } from '@/types/domain';
import { useRepository } from '@/components/RepositoryProvider';
import { useToast } from '@/components/Toast';
import { cloudSyncBus } from '@/lib/firebase/cloudSyncBus';
import { ensureOriginRef, appendToChangeLog } from '@/lib/storage/fingerprint';
import { cascadeRoleRename } from '@/features/settings/lib/cascadeRoleRename';
import type { RoleRenameRequest } from '@/features/settings/components/RateTable';
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
  const { repository } = useRepository();
  const { addToast } = useToast();
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => () => { flush(); }, [flush]);

  /**
   * Rename a labor-rate role and move every pool member holding it, as ONE write.
   *
   * ⚠️ THE READ-MODIFY-WRITE IS AGAINST STORAGE, NOT AGAINST HOOK STATE, and that is
   * the whole shape of this handler. Two debounced writes lose this change on the
   * happy path: leave Settings inside the 500 ms window and the Team page's fresh
   * `useTeamPool` reads pre-cascade storage, then the next pool edit persists that
   * stale array over the cascade — no error, no toast. In local mode that is certain,
   * because `localStorage.ts` holds no `cloudSyncBus` reference and nothing tells the
   * stale hook to re-read.
   */
  const handleRenameRole = useCallback(
    async ({ index, oldRole, newRole, hourlyRate }: RoleRenameRequest): Promise<boolean> => {
      setRenameError(null);
      try {
        // ⚠️ STEP 1 — flush FIRST, and the precondition is measured, not assumed. A
        // pending debounced `saveSettings` carries the whole Settings object and its
        // mergeFields cover `laborRates` but NOT `teamPool`; landing after the atomic
        // write it reverts the rates only and orphans everyone.
        //
        // ⚠️ NEVER WRITE `updateSettings(...); await flush();` IN ONE HANDLER. `persist`
        // sits inside the `setState` updater, so a same-tick flush finds nothing pending
        // and returns a RESOLVED PROMISE having written nothing — a silent no-op that
        // reports success. The rule is "a completed render must have handed the value to
        // persist", not "synchronous vs unmount". This call site is safe because the
        // mutation it flushes came from an earlier event.
        await flush();

        const [storedSettings, storedPool] = await Promise.all([
          repository.getSettings(),
          repository.getTeamPool(),
        ]);

        // ⚠️ STEP 2 — verify against STORED state before writing anything. `RateTable`
        // is index-addressed and nothing resets its `editingIndex` when `rates` change
        // underneath it. PR A judged that window acceptable because the blast radius was
        // a single settings row; with a cascade it becomes every holder of a DIFFERENT
        // role, which is a different decision.
        if (storedSettings.laborRates[index]?.role !== oldRole) {
          setRenameError(
            'The labor rates changed while you were editing. Nothing was saved — reopen the row and try again.',
          );
          return false;
        }

        // ⚠️ STEP 3 — build BOTH next objects from the STORED values, never from hook
        // state. Building from `settings` here would reproduce the very stale-whole-array
        // mechanism this handler exists to remove, with a shorter window and an identical
        // shape.
        const nextSettings: Settings = {
          ...storedSettings,
          laborRates: storedSettings.laborRates.map((r, i) =>
            i === index ? { role: newRole, hourlyRate } : r,
          ),
        };
        const { pool: nextPool, renamed, archivedRenamed } =
          cascadeRoleRename(storedPool, oldRole, newRole);

        await repository.saveSettingsAndTeamPool(nextSettings, nextPool);

        // Only after BOTH halves are durable. The hook's state is now stale because this
        // write bypassed `updateSettings`; the settings emit is what refreshes the table.
        cloudSyncBus.emit('settings');
        cloudSyncBus.emit('teamPool');
        ensureOriginRef();
        appendToChangeLog({ op: 'update', entity: 'pool-member', count: renamed });
        addToast(
          renamed === 0
            ? `Renamed to "${newRole}". No team members held the old role.`
            : `Renamed to "${newRole}" for ${renamed} team member${renamed === 1 ? '' : 's'}` +
              `${archivedRenamed > 0 ? ` (${archivedRenamed} archived)` : ''}.`,
          'success',
        );
        return true;
      } catch (err) {
        console.error('[settings] role rename failed:', err);
        setRenameError('Could not save the rename. Nothing was changed — please try again.');
        addToast('Could not save the rename. Nothing was changed.', 'error');
        return false;
      }
    },
    [addToast, flush, repository],
  );

  /**
   * How many pool members would hold a role with no rate if row `index` were removed.
   *
   * ⚠️ NOT "members holding this name". Legacy data holds exact duplicate rate rows, so
   * deleting one twin leaves every holder with a rate and orphans nobody.
   */
  const countOrphansIfDeleted = useCallback(
    async (index: number): Promise<number> => {
      const [storedSettings, storedPool] = await Promise.all([
        repository.getSettings(),
        repository.getTeamPool(),
      ]);
      const remaining = storedSettings.laborRates.filter((_, i) => i !== index);
      return storedPool.filter((m) => !remaining.some((r) => r.role === m.role)).length;
    },
    [repository],
  );

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
        <RateTable
          rates={settings.laborRates}
          onUpdate={updateSettings}
          onRenameRole={handleRenameRole}
          countOrphansIfDeleted={countOrphansIfDeleted}
        />
        {renameError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {renameError}
          </p>
        )}
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
