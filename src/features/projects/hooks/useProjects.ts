// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AppState, Project, ProjectColor } from '@/types/domain';
import { useRepository } from '@/components/RepositoryProvider';
import { cloudSyncBus } from '@/lib/firebase/cloudSyncBus';
import { generateId } from '@/lib/utils/id';
import { createBaselineReforecast } from '@/lib/utils/reforecast';
import { ensureOriginRef, appendToChangeLog } from '@/lib/storage/fingerprint';
import { cancelByKey } from '@/lib/storage/pendingSaveRegistry';
import { nextCopyName, cloneProjectData } from '@/features/projects/lib/dashboardCard';
import { addToastGlobal } from '@/components/Toast';
import { describeStorageError } from '@/lib/storage/localStorage';

export function useProjects() {
  const { repository } = useRepository();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const all = await repository.getProjects();
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
  }, [repository]);

  // Fetch-on-mount + cloudSyncBus subscription — externally driven, not cascading.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      try {
        await repository.createProject(project);
      } catch (err) {
        addToastGlobal(
          describeStorageError(err, 'Failed to create project. Please check your connection.'),
          'error',
        );
        throw err;
      }
      ensureOriginRef();
      appendToChangeLog({ op: 'add', entity: 'project', id: project.id });
      await reload();
      return project;
    },
    [reload, repository]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      // Cancel pending debounced save before deleting. Closes the race where
      // a pending timer fires after deleteDoc and re-creates the document via
      // setDoc(merge:true). Limitation: cancels the timer only; a setDoc
      // already in-flight over the network is not aborted (~200ms residual).
      cancelByKey(id);
      try {
        await repository.deleteProject(id);
      } catch (err) {
        addToastGlobal(
          describeStorageError(err, 'Failed to delete project. Please check your connection.'),
          'error',
        );
        return;
      }
      appendToChangeLog({ op: 'delete', entity: 'project', id });
      await reload();
    },
    [reload, repository]
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
      try {
        await repository.reorderProjects(orderedIds);
      } catch (err) {
        addToastGlobal(
          describeStorageError(err, 'Failed to reorder projects. Please check your connection.'),
          'error',
        );
        // ⚠️ The optimistic update above already moved the tiles. Re-read so the
        // screen goes back to what is actually stored — otherwise the user is
        // looking at an order that was never written.
        await reload();
        return;
      }
      // ⚠️ A RELOAD, not a second append inside the optimistic update above.
      // In the two-tab case `prev` NEVER held the foreign project — it was
      // created in another tab and this tab never loaded it — so there is
      // nothing here to append and a hook-side merge is measurably a no-op
      // (2026-09-03: storage AND DOM identical with and without it). The
      // repository fix keeps the project in STORAGE; only a re-read puts it on
      // SCREEN. This is also the house pattern — createProject, deleteProject,
      // setProjectColor, archiveProject, unarchiveProject and cloneProject all
      // reload already; reorderProjects was the sole exception. Cost is one
      // extra read per drag (a getDocs round trip in cloud mode), which is what
      // every sibling mutation already pays.
      await reload();
    },
    [reload, repository]
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
      try {
        const target = await repository.getProject(id);
        if (!target) return;
        const next: Project = { ...target };
        if (color) {
          next.color = color;
        } else {
          delete next.color;
        }
        await repository.saveProject(next);
      } catch (err) {
        addToastGlobal(
          describeStorageError(err, 'Failed to update project colour. Please check your connection.'),
          'error',
        );
        return;
      }
      await reload();
    },
    [reload, repository]
  );

  /**
   * Archive a project (v0.34.0) — a visibility flag, not deletion. Reads fresh
   * from the repo (matching setProjectColor) so a concurrent detail-page edit
   * isn't clobbered, then persists archived: true. Logged to the change log
   * (unlike the cosmetic color flag) because archiving changes what's visible
   * and exportable by default. Does NOT call ensureOriginRef — it mutates an
   * existing project rather than creating new identity (same category as
   * deleteProject).
   */
  const archiveProject = useCallback(
    async (id: string) => {
      try {
        const target = await repository.getProject(id);
        if (!target) return;
        await repository.saveProject({ ...target, archived: true });
      } catch (err) {
        addToastGlobal(
          describeStorageError(err, 'Failed to archive project. Please check your connection.'),
          'error',
        );
        return;
      }
      appendToChangeLog({ op: 'archive', entity: 'project', id });
      await reload();
    },
    [reload, repository]
  );

  /**
   * Unarchive a project (v0.34.0). Strips the archived field (rather than
   * setting false) so round-trip exports stay clean — mirrors the PoolMember
   * unarchive idiom. Same re-fetch + change-log + no-ensureOriginRef shape as
   * archiveProject.
   */
  const unarchiveProject = useCallback(
    async (id: string) => {
      try {
        const target = await repository.getProject(id);
        if (!target) return;
        const next: Project = { ...target };
        delete next.archived;
        await repository.saveProject(next);
      } catch (err) {
        addToastGlobal(
          describeStorageError(err, 'Failed to unarchive project. Please check your connection.'),
          'error',
        );
        return;
      }
      appendToChangeLog({ op: 'unarchive', entity: 'project', id });
      await reload();
    },
    [reload, repository]
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
      let clone: Project;
      try {
        const source = await repository.getProject(id);
        if (!source) return null;
        const all = await repository.getProjects();
        const newName = nextCopyName(source.name, all.map((p) => p.name));
        clone = cloneProjectData(source, newName);
        await repository.createProject(clone);
      } catch (err) {
        addToastGlobal(
          describeStorageError(err, 'Failed to clone project. Please check your connection.'),
          'error',
        );
        return null;
      }
      ensureOriginRef();
      appendToChangeLog({ op: 'add', entity: 'project', id: clone.id });
      await reload();
      return clone;
    },
    [reload, repository]
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
      let data: AppState;
      try {
        data = await repository.exportAll();
      } catch (err) {
        addToastGlobal(
          describeStorageError(err, 'Failed to export project. Please check your connection.'),
          'error',
        );
        return null;
      }
      const one = data.projects.find((p) => p.id === id);
      if (!one) return null;
      return { ...data, projects: [one] };
    },
    [repository]
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
    archiveProject,
    unarchiveProject,
  };
}
