'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project } from '@/types/domain';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import { generateId } from '@/lib/utils/id';

const repo = createLocalStorageRepository();

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
    async (data: Omit<Project, 'id' | 'teamMembers' | 'reforecasts' | 'activeReforecastId'>) => {
      const project: Project = {
        ...data,
        id: generateId(),
        teamMembers: [],
        reforecasts: [],
        activeReforecastId: null,
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

  return { projects, loading, createProject, deleteProject };
}
