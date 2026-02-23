'use client';

import { useEffect } from 'react';
import { useTeamPool } from '@/features/team/hooks/useTeamPool';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { PoolMemberTable } from '@/features/team/components/PoolMemberTable';
import { AddPoolMemberForm } from '@/features/team/components/AddPoolMemberForm';
import { Skeleton } from '@/components/Skeleton';

export default function TeamPoolPage() {
  const { pool, loading, addPoolMember, updatePoolMember, deletePoolMember, flush } =
    useTeamPool();
  const { settings } = useSettings();

  useEffect(() => () => { flush(); }, [flush]);

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
        <Skeleton className="mt-6 h-10 w-full max-w-md" />
        <Skeleton className="mt-6 h-48 w-full" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Team Pool</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Manage your organization&apos;s team members. Add members here, then assign them to projects.
      </p>

      <div className="mt-6">
        <AddPoolMemberForm
          laborRates={settings?.laborRates ?? []}
          onAdd={addPoolMember}
        />
      </div>

      <div className="mt-6">
        <PoolMemberTable
          pool={pool}
          laborRates={settings?.laborRates ?? []}
          onUpdate={updatePoolMember}
          onDelete={deletePoolMember}
        />
      </div>
    </div>
  );
}
