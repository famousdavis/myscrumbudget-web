// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AppState, Project, ProjectColor } from '@/types/domain';
import { repo } from '@/lib/storage/repo';
import { cloudSyncBus } from '@/lib/firebase/cloudSyncBus';
import { generateId } from '@/lib/utils/id';
import { createBaselineReforecast } from '@/lib/utils/reforecast';
import { ensureOriginRef, appendToChangeLog } from '@/lib/storage/fingerprint';
import { cancelByKey } from '@/lib/storage/pendingSaveRegistry';
import { nextCopyName, cloneProjectData } from '@/features/projects/lib/dashboardCard';
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

  /**
   * Set (or clear) a project's Dashboard tile tint (v0.33.0). Passing
   * `undefined` strips the field — keeping the optional-absent semantic so
   * round-trip exports stay clean. Reads the project fresh from the repo to
   * avoid clobbering concurrent edits from the detail page. Cosmetic — not
   * logged to the change log.
   */
  const setProjectColor = useCallback(
    async (id: string, color: ProjectColor | undefined) => {
      const target = await repo.getProject(id);
      if (!target) return;
      const next: Project = { ...target };
      if (color) {
        next.color = color;
      } else {
        delete next.color;
      }
      await repo.saveProject(next);
      await reload();
    },
    [reload]
  );

  /**
   * Clone a project (v0.33.0). Deep-copies the source, assigns a fresh project
   * id and a unique "<base> - Copy (N)" name, and persists via createProject so
   * the clone is owned by the current user in cloud mode. Internal ids are
   * preserved (project-scoped → no collision; keeps allocation linkage intact).
   * Structural op → logged to the change log.
   */
  const cloneProject = useCallback(
    async (id: string): Promise<Project | null> => {
      const source = await repo.getProject(id);
      if (!source) return null;
      const all = await repo.getProjects();
      const newName = nextCopyName(source.name, all.map((p) => p.name));
      const clone = cloneProjectData(source, newName);
      await repo.createProject(clone);
      ensureOriginRef();
      appendToChangeLog({ op: 'add', entity: 'project', id: clone.id });
      await reload();
      return clone;
    },
    [reload]
  );

  /**
   * Build a single-project export (v0.33.0): the standard `dataset` export shape
   * with `projects` filtered to one. Reuses `exportAll` so the file carries
   * settings, the full team pool (so the project is fully resolvable on import),
   * and the workspace reconciliation tokens — and stays importable by the
   * existing Dashboard import flow. Returns null if the project is absent.
   */
  const exportProject = useCallback(
    async (id: string): Promise<AppState | null> => {
      const data = await repo.exportAll();
      const one = data.projects.find((p) => p.id === id);
      if (!one) return null;
      return { ...data, projects: [one] };
    },
    []
  );

  return {
    projects,
    loading,
    createProject,
    deleteProject,
    reorderProjects,
    setProjectColor,
    cloneProject,
    exportProject,
  };
}
