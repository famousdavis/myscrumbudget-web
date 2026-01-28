'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Project } from '@/types/domain';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';

const repo = createLocalStorageRepository();
const DEBOUNCE_MS = 500;

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    repo.getProject(id).then((p) => {
      setProject(p);
      setLoading(false);
    });
  }, [id]);

  const persistProject = useCallback((updated: Project) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      repo.saveProject(updated);
    }, DEBOUNCE_MS);
  }, []);

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

  return { project, loading, updateProject };
}
