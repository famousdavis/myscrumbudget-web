'use client';

import { useCallback, useMemo } from 'react';
import type { Project, Reforecast, MonthlyAllocation } from '@/types/domain';
import { generateId } from '@/lib/utils/id';
import { buildAllocationMap } from '@/lib/calc/allocationMap';

interface UseReforecastOptions {
  project: Project | null;
  updateProject: (updater: (prev: Project) => Project) => void;
}

function createDefaultReforecast(startDate: string): Reforecast {
  return {
    id: generateId(),
    name: 'Baseline',
    createdAt: new Date().toISOString(),
    startDate,
    allocations: [],
    productivityWindows: [],
  };
}

export function useReforecast({ project, updateProject }: UseReforecastOptions) {
  // Ensure a default reforecast exists
  const activeReforecast = useMemo(() => {
    if (!project) return null;

    if (project.reforecasts.length === 0) {
      return null; // Will be created on first allocation change
    }

    const active = project.activeReforecastId
      ? project.reforecasts.find((r) => r.id === project.activeReforecastId)
      : project.reforecasts[0];

    return active ?? project.reforecasts[0];
  }, [project]);

  const allocationMap = useMemo(() => {
    if (!activeReforecast) return buildAllocationMap([]);
    return buildAllocationMap(activeReforecast.allocations);
  }, [activeReforecast]);

  const ensureReforecast = useCallback(
    (prev: Project): { project: Project; reforecastId: string } => {
      if (prev.reforecasts.length > 0) {
        const id = prev.activeReforecastId ?? prev.reforecasts[0].id;
        return { project: prev, reforecastId: id };
      }

      const rf = createDefaultReforecast(prev.startDate);
      const updated = {
        ...prev,
        reforecasts: [rf],
        activeReforecastId: rf.id,
      };
      return { project: updated, reforecastId: rf.id };
    },
    []
  );

  const onAllocationChange = useCallback(
    (memberId: string, month: string, value: number) => {
      updateProject((prev) => {
        const { project: withRf, reforecastId } = ensureReforecast(prev);

        return {
          ...withRf,
          reforecasts: withRf.reforecasts.map((rf) => {
            if (rf.id !== reforecastId) return rf;

            const existing = rf.allocations.findIndex(
              (a) => a.memberId === memberId && a.month === month
            );

            let newAllocations: MonthlyAllocation[];
            if (value === 0) {
              // Remove zero allocations to keep data clean
              newAllocations = rf.allocations.filter(
                (a) => !(a.memberId === memberId && a.month === month)
              );
            } else if (existing >= 0) {
              newAllocations = rf.allocations.map((a, i) =>
                i === existing ? { ...a, allocation: value } : a
              );
            } else {
              newAllocations = [
                ...rf.allocations,
                { memberId, month, allocation: value },
              ];
            }

            return { ...rf, allocations: newAllocations };
          }),
        };
      });
    },
    [updateProject, ensureReforecast]
  );

  return {
    activeReforecast,
    allocationMap,
    onAllocationChange,
  };
}
