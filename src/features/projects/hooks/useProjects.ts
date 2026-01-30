'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project } from '@/types/domain';
import { repo } from '@/lib/storage/repo';
import { generateId } from '@/lib/utils/id';
import { createBaselineReforecast } from '@/lib/utils/reforecast';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const all = await repo.getProjects();
    setProjects(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const createProject = useCallback(
    async (data: { name: string; startDate: string; endDate: string; baselineBudget: number }) => {
      const { baselineBudget, ...projectData } = data;
      const baseline = createBaselineReforecast(projectData.startDate, baselineBudget);
      const project: Project = {
        ...projectData,
        id: generateId(),
        assignments: [],
        reforecasts: [baseline],
        activeReforecastId: baseline.id,
      };
      await repo.saveProject(project);
      await reload();
      return project;
    },
    [reload]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await repo.deleteProject(id);
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
