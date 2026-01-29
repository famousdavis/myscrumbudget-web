'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project } from '@/types/domain';
import { repo } from '@/lib/storage/repo';
import { useDebouncedSave } from '@/hooks/useDebouncedSave';

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    repo.getProject(id).then((p) => {
      setProject(p);
      setLoading(false);
    });
  }, [id]);

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
