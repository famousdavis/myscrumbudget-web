// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useMemo } from 'react';
import type { Project, PoolMember, TeamMember, Reforecast } from '@/types/domain';
import { resolveAssignments, getActiveReforecast } from '@/lib/utils/teamResolution';
import { generateId } from '@/lib/utils/id';

interface UseTeamOptions {
  project: Project | null;
  updateProject: (updater: (prev: Project) => Project) => void;
  pool: PoolMember[];
}

/**
 * Apply `fn` to the active reforecast, leaving sibling reforecasts unchanged.
 * Each reforecast owns its own roster — mutations never leak across snapshots.
 */
function withActiveReforecast(
  prev: Project,
  fn: (rf: Reforecast) => Reforecast,
): Project {
  return {
    ...prev,
    reforecasts: prev.reforecasts.map((rf) =>
      rf.id === prev.activeReforecastId ? fn(rf) : rf,
    ),
  };
}

export function useTeam({ project, updateProject, pool }: UseTeamOptions) {
  // Resolve the ACTIVE reforecast's assignments against the pool to produce TeamMember[]
  const members: TeamMember[] = useMemo(() => {
    if (!project) return [];
    const activeRf = getActiveReforecast(project);
    return resolveAssignments(activeRf?.assignments ?? [], pool);
  }, [project, pool]);

  const addAssignment = useCallback(
    (poolMemberId: string) => {
      const id = generateId();
      updateProject((prev) =>
        withActiveReforecast(prev, (rf) => ({
          ...rf,
          assignments: [...rf.assignments, { id, poolMemberId }],
        })),
      );
      return id;
    },
    [updateProject],
  );

  const removeAssignment = useCallback(
    (assignmentId: string) => {
      updateProject((prev) =>
        withActiveReforecast(prev, (rf) => ({
          ...rf,
          assignments: rf.assignments.filter((a) => a.id !== assignmentId),
          // Cascade scoped to the active reforecast only.
          allocations: rf.allocations.filter((a) => a.memberId !== assignmentId),
        })),
      );
    },
    [updateProject],
  );

  /** Reorder assignments to match the given ordered list of assignment IDs */
  const reorderAssignments = useCallback(
    (orderedIds: string[]) => {
      updateProject((prev) =>
        withActiveReforecast(prev, (rf) => ({
          ...rf,
          assignments: orderedIds
            .map((id) => rf.assignments.find((a) => a.id === id))
            .filter((a): a is NonNullable<typeof a> => a != null),
        })),
      );
    },
    [updateProject],
  );

  /** Sort assignments by name or role→name and persist the new order */
  const sortAssignments = useCallback(
    (mode: 'name' | 'role-name') => {
      const activeRf = project ? getActiveReforecast(project) : undefined;
      const resolved = resolveAssignments(activeRf?.assignments ?? [], pool);
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
    assignments: (project ? getActiveReforecast(project)?.assignments : undefined) ?? [],
    addAssignment,
    removeAssignment,
    reorderAssignments,
    sortAssignments,
  };
}
