'use client';

import { useCallback } from 'react';
import type { Project, TeamMember } from '@/types/domain';
import { generateId } from '@/lib/utils/id';

interface UseTeamOptions {
  project: Project | null;
  updateProject: (updater: (prev: Project) => Project) => void;
}

export function useTeam({ project, updateProject }: UseTeamOptions) {
  const addMember = useCallback(
    (name: string, role: string, type: 'Core' | 'Extended') => {
      const member: TeamMember = {
        id: generateId(),
        name,
        role,
        type,
      };
      updateProject((prev) => ({
        ...prev,
        teamMembers: [...prev.teamMembers, member],
      }));
      return member;
    },
    [updateProject]
  );

  const updateMember = useCallback(
    (id: string, updates: Partial<Omit<TeamMember, 'id'>>) => {
      updateProject((prev) => ({
        ...prev,
        teamMembers: prev.teamMembers.map((m) =>
          m.id === id ? { ...m, ...updates } : m
        ),
      }));
    },
    [updateProject]
  );

  const deleteMember = useCallback(
    (id: string) => {
      updateProject((prev) => ({
        ...prev,
        teamMembers: prev.teamMembers.filter((m) => m.id !== id),
        // Also remove allocations for this member from all reforecasts
        reforecasts: prev.reforecasts.map((rf) => ({
          ...rf,
          allocations: rf.allocations.filter((a) => a.memberId !== id),
        })),
      }));
    },
    [updateProject]
  );

  return {
    members: project?.teamMembers ?? [],
    addMember,
    updateMember,
    deleteMember,
  };
}
