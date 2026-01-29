'use client';

import { useCallback, useMemo } from 'react';
import type {
  Project,
  Reforecast,
  MonthlyAllocation,
  ProductivityWindow,
} from '@/types/domain';
import { generateId } from '@/lib/utils/id';
import { buildAllocationMap } from '@/lib/calc/allocationMap';
import { getActiveReforecast } from '@/lib/utils/teamResolution';

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
  const reforecasts = useMemo(
    () => project?.reforecasts ?? [],
    [project],
  );

  const activeReforecast = useMemo(() => {
    if (!project || project.reforecasts.length === 0) return null;
    return getActiveReforecast(project) ?? project.reforecasts[0];
  }, [project]);

  const allocationMap = useMemo(() => {
    if (!activeReforecast) return buildAllocationMap([]);
    return buildAllocationMap(activeReforecast.allocations);
  }, [activeReforecast]);

  const productivityWindows = useMemo(
    () => activeReforecast?.productivityWindows ?? [],
    [activeReforecast],
  );

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
    [],
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
              (a) => a.memberId === memberId && a.month === month,
            );

            let newAllocations: MonthlyAllocation[];
            if (value === 0) {
              // Remove zero allocations to keep data clean
              newAllocations = rf.allocations.filter(
                (a) => !(a.memberId === memberId && a.month === month),
              );
            } else if (existing >= 0) {
              newAllocations = rf.allocations.map((a, i) =>
                i === existing ? { ...a, allocation: value } : a,
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
    [updateProject, ensureReforecast],
  );

  const switchReforecast = useCallback(
    (reforecastId: string) => {
      updateProject((prev) => {
        // Only switch if the ID exists
        const exists = prev.reforecasts.some((r) => r.id === reforecastId);
        if (!exists) return prev;
        return {
          ...prev,
          activeReforecastId: reforecastId,
        };
      });
    },
    [updateProject],
  );

  const createReforecast = useCallback(
    (name: string, copyFromId?: string) => {
      updateProject((prev) => {
        const sourceReforecast = copyFromId
          ? prev.reforecasts.find((r) => r.id === copyFromId)
          : null;

        const newRf: Reforecast = {
          id: generateId(),
          name,
          createdAt: new Date().toISOString(),
          startDate: prev.startDate,
          allocations: sourceReforecast
            ? sourceReforecast.allocations.map((a) => ({ ...a }))
            : [],
          productivityWindows: sourceReforecast
            ? sourceReforecast.productivityWindows.map((w) => ({
                ...w,
                id: generateId(),
              }))
            : [],
        };

        return {
          ...prev,
          reforecasts: [...prev.reforecasts, newRf],
          activeReforecastId: newRf.id,
        };
      });
    },
    [updateProject],
  );

  const addProductivityWindow = useCallback(
    (startDate: string, endDate: string, factor: number) => {
      updateProject((prev) => {
        const { project: withRf, reforecastId } = ensureReforecast(prev);
        const newWindow: ProductivityWindow = {
          id: generateId(),
          startDate,
          endDate,
          factor,
        };
        return {
          ...withRf,
          reforecasts: withRf.reforecasts.map((rf) =>
            rf.id === reforecastId
              ? {
                  ...rf,
                  productivityWindows: [...rf.productivityWindows, newWindow],
                }
              : rf,
          ),
        };
      });
    },
    [updateProject, ensureReforecast],
  );

  const updateProductivityWindow = useCallback(
    (
      windowId: string,
      updates: Partial<Omit<ProductivityWindow, 'id'>>,
    ) => {
      updateProject((prev) => {
        const { project: withRf, reforecastId } = ensureReforecast(prev);
        return {
          ...withRf,
          reforecasts: withRf.reforecasts.map((rf) =>
            rf.id === reforecastId
              ? {
                  ...rf,
                  productivityWindows: rf.productivityWindows.map((w) =>
                    w.id === windowId ? { ...w, ...updates } : w,
                  ),
                }
              : rf,
          ),
        };
      });
    },
    [updateProject, ensureReforecast],
  );

  const deleteReforecast = useCallback(
    (reforecastId: string) => {
      updateProject((prev) => {
        const remaining = prev.reforecasts.filter((r) => r.id !== reforecastId);
        const wasActive = prev.activeReforecastId === reforecastId;
        return {
          ...prev,
          reforecasts: remaining,
          activeReforecastId: wasActive
            ? (remaining.length > 0 ? remaining[0].id : null)
            : prev.activeReforecastId,
        };
      });
    },
    [updateProject],
  );

  const removeProductivityWindow = useCallback(
    (windowId: string) => {
      updateProject((prev) => {
        const { project: withRf, reforecastId } = ensureReforecast(prev);
        return {
          ...withRf,
          reforecasts: withRf.reforecasts.map((rf) =>
            rf.id === reforecastId
              ? {
                  ...rf,
                  productivityWindows: rf.productivityWindows.filter(
                    (w) => w.id !== windowId,
                  ),
                }
              : rf,
          ),
        };
      });
    },
    [updateProject, ensureReforecast],
  );

  return {
    reforecasts,
    activeReforecast,
    allocationMap,
    productivityWindows,
    onAllocationChange,
    switchReforecast,
    createReforecast,
    deleteReforecast,
    addProductivityWindow,
    updateProductivityWindow,
    removeProductivityWindow,
  };
}
