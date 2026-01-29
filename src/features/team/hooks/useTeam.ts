'use client';

import { useCallback, useMemo } from 'react';
import type { Project, PoolMember, TeamMember } from '@/types/domain';
import { resolveAssignments } from '@/lib/utils/teamResolution';
import { generateId } from '@/lib/utils/id';

interface UseTeamOptions {
  project: Project | null;
  updateProject: (updater: (prev: Project) => Project) => void;
  pool: PoolMember[];
}

export function useTeam({ project, updateProject, pool }: UseTeamOptions) {
  // Resolve assignments against the pool to produce TeamMember[]
  const members: TeamMember[] = useMemo(() => {
    if (!project) return [];
    return resolveAssignments(project.assignments ?? [], pool);
  }, [project, pool]);

  const addAssignment = useCallback(
    (poolMemberId: string) => {
      const id = generateId();
      updateProject((prev) => ({
        ...prev,
        assignments: [...(prev.assignments ?? []), { id, poolMemberId }],
      }));
      return id;
    },
    [updateProject],
  );

  const removeAssignment = useCallback(
    (assignmentId: string) => {
      updateProject((prev) => ({
        ...prev,
        assignments: (prev.assignments ?? []).filter((a) => a.id !== assignmentId),
        // Cascade: remove allocations referencing this assignment
        reforecasts: prev.reforecasts.map((rf) => ({
          ...rf,
          allocations: rf.allocations.filter(
            (a) => a.memberId !== assignmentId,
          ),
        })),
      }));
    },
    [updateProject],
  );

  return {
    members,
    assignments: project?.assignments ?? [],
    addAssignment,
    removeAssignment,
  };
}
