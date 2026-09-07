// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PoolMember, Project } from '@/types/domain';
import { useRepository } from '@/components/RepositoryProvider';
import { useDebouncedSave } from '@/hooks/useDebouncedSave';
import { generateId } from '@/lib/utils/id';
import { ensureOriginRef, appendToChangeLog } from '@/lib/storage/fingerprint';
import { cloudSyncBus } from '@/lib/firebase/cloudSyncBus';
import { addToastGlobal } from '@/components/Toast';
import { describeStorageError } from '@/lib/storage/localStorage';

export function useTeamPool() {
  const { repository } = useRepository();
  const [pool, setPool] = useState<PoolMember[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const p = await repository.getTeamPool();
      setPool(p);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== 'permission-denied') {
        // v0.31.0 (I2): see useSettings.reload for rationale. Silent on
        // permission-denied to avoid double-toasting with useSettings,
        // since both react to the same settings-listener bus emit.
        addToastGlobal(
          describeStorageError(err, 'Failed to load team pool. Please check your connection.'),
          'error',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [repository]);

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

  const persistFn = useCallback(async (p: PoolMember[]) => {
    try {
      await repository.saveTeamPool(p);
    } catch (err) {
      addToastGlobal(
        describeStorageError(err, 'Failed to save team pool. Please check your connection.'),
        'error',
      );
      throw err;
    }
  }, [repository]);
  const { save: persist, flush } = useDebouncedSave<PoolMember[]>(persistFn);

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

  const archivePoolMember = useCallback(
    (id: string) => {
      setPool((prev) => {
        const updated = prev.map((m) =>
          m.id === id ? { ...m, archived: true } : m,
        );
        persist(updated);
        return updated;
      });
      ensureOriginRef();
      appendToChangeLog({ op: 'update', entity: 'pool-member', id });
    },
    [persist],
  );

  const unarchivePoolMember = useCallback(
    (id: string) => {
      setPool((prev) => {
        const updated = prev.map((m) => {
          if (m.id !== id) return m;
          // Strip the archived field rather than setting false — keeps round-trip
          // exports clean (no `archived: false` noise).
          const { archived: _drop, ...rest } = m;
          void _drop;
          return rest;
        });
        persist(updated);
        return updated;
      });
      ensureOriginRef();
      appendToChangeLog({ op: 'update', entity: 'pool-member', id });
    },
    [persist],
  );

  const deletePoolMember = useCallback(
    async (id: string): Promise<{ ok: boolean; reason?: string; canArchive?: boolean }> => {
      // ⚠️ v0.38.0: this read decides whether a member is safe to delete. If it
      // throws, the honest answer is REFUSE, not "not in use" — an unreadable
      // project could be the one holding this member, and deleting on a failed
      // check is exactly the class of mistake this release exists to remove.
      let projects: Project[];
      try {
        projects = await repository.getProjects();
      } catch (err) {
        return {
          ok: false,
          reason: describeStorageError(
            err,
            'Could not check whether this member is in use. Please try again.',
          ),
          canArchive: false,
        };
      }
      const inUse = projects.some((p) =>
        (p.reforecasts ?? []).some((rf) =>
          (rf.assignments ?? []).some((a) => a.poolMemberId === id),
        ),
      );
      if (inUse) {
        // Reading from the same hook closure as the inUse check above — both share
        // the same staleness window. Do NOT "fix" this by reading from setPool's
        // prev parameter without also moving the inUse check, or the two lookups
        // will diverge.
        const member = pool.find((m) => m.id === id);
        if (member?.archived === true) {
          return {
            ok: false,
            reason:
              'This member appears in one or more reforecast scenarios and cannot be deleted. They are already archived and will not appear in future staffing.',
            canArchive: false,
          };
        }
        return {
          ok: false,
          reason:
            'This member appears in one or more reforecast scenarios. Because reforecasts preserve their own team snapshots, tracking down every assignment would be impractical. Archive this member instead to keep historical records intact while removing them from future staffing.',
          canArchive: true,
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
    [persist, pool, repository],
  );

  return {
    pool,
    loading,
    addPoolMember,
    updatePoolMember,
    archivePoolMember,
    unarchivePoolMember,
    deletePoolMember,
    flush,
  };
}
