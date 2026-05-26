// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project } from '@/types/domain';
import { repo } from '@/lib/storage/repo';
import { cloudSyncBus } from '@/lib/firebase/cloudSyncBus';
import { generateId } from '@/lib/utils/id';
import { createBaselineReforecast } from '@/lib/utils/reforecast';
import { ensureOriginRef, appendToChangeLog } from '@/lib/storage/fingerprint';
import { cancelByKey } from '@/lib/storage/pendingSaveRegistry';
import { addToastGlobal } from '@/components/Toast';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const all = await repo.getProjects();
      setProjects(all);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'permission-denied') {
        // v0.31.0 (I2): silent eviction of inaccessible projects. Listener
        // emitted a bus event that brought us here; user notification is
        // suppressed end-to-end (sign-out cascade, role revocation —
        // the user typically already knows).
        setProjects([]);
      } else {
        addToastGlobal('Failed to load projects. Please check your connection.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch-on-mount + cloudSyncBus subscription — externally driven, not cascading.
  useEffect(() => {
    reload();
  }, [reload]);

  // Subscribe to cloud sync events for projects
  useEffect(() => {
    return cloudSyncBus.subscribe((event) => {
      if (event === 'projects') reload();
    });
  }, [reload]);

  const createProject = useCallback(
    async (data: { name: string; startDate: string; endDate: string; baselineBudget: number }) => {
      const { baselineBudget, ...projectData } = data;
      const baseline = createBaselineReforecast(projectData.startDate, projectData.endDate, baselineBudget);
      const project: Project = {
        ...projectData,
        id: generateId(),
        reforecasts: [baseline],
        activeReforecastId: baseline.id,
      };
      await repo.createProject(project);
      ensureOriginRef();
      appendToChangeLog({ op: 'add', entity: 'project', id: project.id });
      await reload();
      return project;
    },
    [reload]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      // Cancel pending debounced save before deleting. Closes the race where
      // a pending timer fires after deleteDoc and re-creates the document via
      // setDoc(merge:true). Limitation: cancels the timer only; a setDoc
      // already in-flight over the network is not aborted (~200ms residual).
      cancelByKey(id);
      await repo.deleteProject(id);
      appendToChangeLog({ op: 'delete', entity: 'project', id });
      await reload();
    },
    [reload]
  );

  const reorderProjects = useCallback(
    async (orderedIds: string[]) => {
      // Optimistic update
      setProjects((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        return orderedIds
          .map((id) => byId.get(id))
          .filter((p): p is Project => p !== undefined);
      });
      await repo.reorderProjects(orderedIds);
    },
    []
  );

  return { projects, loading, createProject, deleteProject, reorderProjects };
}
