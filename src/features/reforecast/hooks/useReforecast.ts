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
import { createBaselineReforecast, createNewReforecast } from '@/lib/utils/reforecast';

interface UseReforecastOptions {
  project: Project | null;
  updateProject: (updater: (prev: Project) => Project) => void;
}

export function useReforecast({ project, updateProject }: UseReforecastOptions) {
  const reforecasts = useMemo(
    () => project?.reforecasts ?? [],
    [project],
  );

  const activeReforecast = useMemo(() => {
    if (!project || project.reforecasts.length === 0) return null;
    return getActiveReforecast(project);
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

      const rf = createBaselineReforecast(prev.startDate);
      const updated = {
        ...prev,
        reforecasts: [rf],
        activeReforecastId: rf.id,
      };
      return { project: updated, reforecastId: rf.id };
    },
    [],
  );

  /** Apply an updater to the active reforecast only. */
  const updateActiveRf = useCallback(
    (rfUpdater: (rf: Reforecast) => Reforecast) => {
      updateProject((prev) => {
        const { project: withRf, reforecastId } = ensureReforecast(prev);
        return {
          ...withRf,
          reforecasts: withRf.reforecasts.map((rf) =>
            rf.id === reforecastId ? rfUpdater(rf) : rf,
          ),
        };
      });
    },
    [updateProject, ensureReforecast],
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
        const source = copyFromId
          ? prev.reforecasts.find((r) => r.id === copyFromId)
          : undefined;

        const newRf = createNewReforecast(name, prev.startDate, source);

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
      const newWindow: ProductivityWindow = {
        id: generateId(),
        startDate,
        endDate,
        factor,
      };
      updateActiveRf((rf) => ({
        ...rf,
        productivityWindows: [...rf.productivityWindows, newWindow],
      }));
    },
    [updateActiveRf],
  );

  const updateProductivityWindow = useCallback(
    (
      windowId: string,
      updates: Partial<Omit<ProductivityWindow, 'id'>>,
    ) => {
      updateActiveRf((rf) => ({
        ...rf,
        productivityWindows: rf.productivityWindows.map((w) =>
          w.id === windowId ? { ...w, ...updates } : w,
        ),
      }));
    },
    [updateActiveRf],
  );

  const deleteReforecast = useCallback(
    (reforecastId: string) => {
      updateProject((prev) => {
        // Guard: never delete the last reforecast
        if (prev.reforecasts.length <= 1) return prev;

        const remaining = prev.reforecasts.filter((r) => r.id !== reforecastId);
        const wasActive = prev.activeReforecastId === reforecastId;
        return {
          ...prev,
          reforecasts: remaining,
          activeReforecastId: wasActive
            ? remaining[0].id
            : prev.activeReforecastId,
        };
      });
    },
    [updateProject],
  );

  const removeProductivityWindow = useCallback(
    (windowId: string) => {
      updateActiveRf((rf) => ({
        ...rf,
        productivityWindows: rf.productivityWindows.filter(
          (w) => w.id !== windowId,
        ),
      }));
    },
    [updateActiveRf],
  );

  /** Sanitize a currency value: clamp NaN/Infinity to 0, enforce >= 0. */
  const sanitizeCurrency = (value: number): number =>
    Number.isFinite(value) ? Math.max(0, value) : 0;

  const updateActualCost = useCallback(
    (value: number) => {
      const sanitized = sanitizeCurrency(value);
      updateActiveRf((rf) => ({ ...rf, actualCost: sanitized }));
    },
    [updateActiveRf],
  );

  const updateBaselineBudget = useCallback(
    (value: number) => {
      const sanitized = sanitizeCurrency(value);
      updateActiveRf((rf) => ({ ...rf, baselineBudget: sanitized }));
    },
    [updateActiveRf],
  );

  const updateReforecastDate = useCallback(
    (date: string) => {
      updateActiveRf((rf) => ({ ...rf, reforecastDate: date }));
    },
    [updateActiveRf],
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
    updateActualCost,
    updateBaselineBudget,
    updateReforecastDate,
  };
}
