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

  /** Reorder assignments to match the given ordered list of assignment IDs */
  const reorderAssignments = useCallback(
    (orderedIds: string[]) => {
      updateProject((prev) => ({
        ...prev,
        assignments: orderedIds.map(
          (id) => prev.assignments.find((a) => a.id === id)!,
        ),
      }));
    },
    [updateProject],
  );

  /** Sort assignments by name or role→name and persist the new order */
  const sortAssignments = useCallback(
    (mode: 'name' | 'role-name') => {
      const resolved = resolveAssignments(
        project?.assignments ?? [],
        pool,
      );
      const sorted = [...resolved].sort((a, b) => {
        if (mode === 'role-name') {
          const roleCmp = a.role.localeCompare(b.role);
          if (roleCmp !== 0) return roleCmp;
        }
        return a.name.localeCompare(b.name);
      });
      reorderAssignments(sorted.map((m) => m.id));
    },
    [project, pool, reorderAssignments],
  );

  return {
    members,
    assignments: project?.assignments ?? [],
    addAssignment,
    removeAssignment,
    reorderAssignments,
    sortAssignments,
  };
}
