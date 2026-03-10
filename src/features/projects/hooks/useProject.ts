'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project } from '@/types/domain';
import { repo } from '@/lib/storage/repo';
import { useDebouncedSave } from '@/hooks/useDebouncedSave';
import { cloudSyncBus } from '@/lib/firebase/cloudSyncBus';

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const p = await repo.getProject(id);
    setProject(p);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Subscribe to cloud sync events for projects
  useEffect(() => {
    return cloudSyncBus.subscribe((event) => {
      if (event === 'projects') reload();
    });
  }, [reload]);

  const { save: persistProject, flush } = useDebouncedSave<Project>((p) => repo.saveProject(p));

  const updateProject = useCallback(
    (updater: (prev: Project) => Project) => {
      setProject((prev) => {
        if (!prev) return prev;
        const updated = updater(prev);
        persistProject(updated);
        return updated;
      });
    },
    [persistProject]
  );

  return { project, loading, updateProject, flush };
}
