// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PoolMember } from '@/types/domain';
import { repo } from '@/lib/storage/repo';
import { useDebouncedSave } from '@/hooks/useDebouncedSave';
import { generateId } from '@/lib/utils/id';
import { ensureOriginRef, appendToChangeLog } from '@/lib/storage/fingerprint';
import { cloudSyncBus } from '@/lib/firebase/cloudSyncBus';

export function useTeamPool() {
  const [pool, setPool] = useState<PoolMember[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const p = await repo.getTeamPool();
    setPool(p);
    setLoading(false);
  }, []);

  // Fetch-on-mount + cloudSyncBus subscription — externally driven, not cascading.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  // Subscribe to cloud sync events for team pool
  useEffect(() => {
    return cloudSyncBus.subscribe((event) => {
      if (event === 'teamPool') reload();
    });
  }, [reload]);

  const { save: persist, flush } = useDebouncedSave<PoolMember[]>((p) => repo.saveTeamPool(p));

  const addPoolMember = useCallback(
    (name: string, role: string) => {
      const member: PoolMember = { id: generateId(), name, role };
      setPool((prev) => {
        const updated = [...prev, member];
        persist(updated);
        return updated;
      });
      ensureOriginRef();
      appendToChangeLog({ op: 'add', entity: 'pool-member', id: member.id });
      return member;
    },
    [persist],
  );

  const updatePoolMember = useCallback(
    (id: string, updates: Partial<Omit<PoolMember, 'id'>>) => {
      setPool((prev) => {
        const updated = prev.map((m) =>
          m.id === id ? { ...m, ...updates } : m,
        );
        persist(updated);
        return updated;
      });
    },
    [persist],
  );

  const deletePoolMember = useCallback(
    async (id: string): Promise<{ ok: boolean; reason?: string }> => {
      const projects = await repo.getProjects();
      const inUse = projects.some((p) =>
        (p.reforecasts ?? []).some((rf) =>
          (rf.assignments ?? []).some((a) => a.poolMemberId === id),
        ),
      );
      if (inUse) {
        return {
          ok: false,
          reason: 'This team member is assigned to one or more projects. Remove them from all projects first.',
        };
      }
      setPool((prev) => {
        const updated = prev.filter((m) => m.id !== id);
        persist(updated);
        return updated;
      });
      appendToChangeLog({ op: 'delete', entity: 'pool-member', id });
      return { ok: true };
    },
    [persist],
  );

  return { pool, loading, addPoolMember, updatePoolMember, deletePoolMember, flush };
}
