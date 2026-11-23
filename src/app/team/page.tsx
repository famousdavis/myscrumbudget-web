// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect } from 'react';
import { useTeamPool } from '@/features/team/hooks/useTeamPool';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { PoolMemberTable } from '@/features/team/components/PoolMemberTable';
import { AddPoolMemberForm } from '@/features/team/components/AddPoolMemberForm';
import { Skeleton } from '@/components/Skeleton';
import { HeadingRow } from '@/components/HeadingRow';

export default function TeamPoolPage() {
  const {
    pool,
    loading,
    addPoolMember,
    updatePoolMember,
    archivePoolMember,
    unarchivePoolMember,
    deletePoolMember,
    flush,
  } = useTeamPool();
  const { settings } = useSettings();

  useEffect(() => () => { flush(); }, [flush]);

  // FRAME26 (v0.45.0): the frame's heading row in every state; only the body shows loading (contract §7). Until
  // v0.44.14 the loading skeleton drew a placeholder in place of the heading.
  if (loading) {
    return (
      <>
        <HeadingRow>Team Pool</HeadingRow>
        <div className="sf-below">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="mt-6 h-10 w-full max-w-md" />
          <Skeleton className="mt-6 h-48 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <HeadingRow>Team Pool</HeadingRow>
      <div className="sf-below">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Manage your organization&apos;s team members. Add members here, then assign them to projects.
        </p>

        {/* ⚠️ `settings?.laborRates`, deliberately NOT `?? []`. The `if (loading)` gate
            above is `useTeamPool`'s — `useSettings`' own loading flag is discarded — so
            this renders while `settings` is still null. Collapsing that to `[]` tells the
            role selects every role is rate-less, which is a claim, not an absence. */}
        <div className="mt-6">
          <AddPoolMemberForm
            laborRates={settings?.laborRates}
            pool={pool}
            onAdd={addPoolMember}
            onUnarchive={unarchivePoolMember}
          />
        </div>

        <div className="mt-6">
          <PoolMemberTable
            pool={pool}
            laborRates={settings?.laborRates}
            onUpdate={updatePoolMember}
            onArchive={archivePoolMember}
            onUnarchive={unarchivePoolMember}
            onDelete={deletePoolMember}
          />
        </div>
      </div>
    </>
  );
}
