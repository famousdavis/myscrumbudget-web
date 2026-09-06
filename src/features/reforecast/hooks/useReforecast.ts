// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useMemo } from 'react';
import type {
  Project,
  Reforecast,
  MonthlyAllocation,
  ProductivityWindow,
  HistoricalCostEntry,
  CharterBudget,
} from '@/types/domain';
import { generateId } from '@/lib/utils/id';
import { sanitizeCurrency } from '@/lib/utils/format';
import { REFORECAST_NOTES_MAX_LENGTH } from '@/lib/constants';
import { buildAllocationMap } from '@/lib/calc/allocationMap';
import { getActiveReforecast } from '@/lib/utils/teamResolution';
import { createBaselineReforecast, createNewReforecast } from '@/lib/utils/reforecast';
import { materializeBucketOnAdvance } from '@/lib/utils/historicalCostsView';
import {
  applyTimelineChangeToSingleReforecast,
  computeClampedReforecastDate,
} from '@/features/projects/lib/timelineChange';
import { ensureOriginRef, appendToChangeLog } from '@/lib/storage/fingerprint';

/**
 * The add / update / remove rule for one allocation cell, in one place.
 *
 * ⚠️ EXTRACTED BECAUSE IT WAS ABOUT TO EXIST TWICE. `onAllocationChange` and
 * `onAllocationsChange` apply the identical rule; two copies of it is the drift
 * hazard, and the zero branch in particular is a silent data-shape rule (a zero
 * allocation is REMOVED, not stored as 0) that nothing else in the codebase
 * restates. A second copy that "helpfully" stored the zero would round-trip
 * through export/import as a different document with no test naming the change.
 *
 * Pure: `filter` / `map` / spread only. It throws for no input shape, which is
 * why criterion 7b drives its throw from a getter on the CALLER's array rather
 * than from anything in here.
 */
export function applyAllocation(
  allocations: MonthlyAllocation[],
  memberId: string,
  month: string,
  value: number,
): MonthlyAllocation[] {
  if (value === 0) {
    // Remove zero allocations to keep data clean
    return allocations.filter(
      (a) => !(a.memberId === memberId && a.month === month),
    );
  }
  const existing = allocations.findIndex(
    (a) => a.memberId === memberId && a.month === month,
  );
  if (existing >= 0) {
    return allocations.map((a, i) =>
      i === existing ? { ...a, allocation: value } : a,
    );
  }
  return [...allocations, { memberId, month, allocation: value }];
}

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

      const rf = createBaselineReforecast(prev.startDate, prev.endDate);
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
      updateActiveRf((rf) => ({
        ...rf,
        allocations: applyAllocation(rf.allocations, memberId, month, value),
      }));
    },
    [updateActiveRf],
  );

  /**
   * Apply MANY allocation changes inside ONE `updateProject`, so a multi-cell
   * gesture costs exactly one undo entry.
   *
   * ⚠️ THE ARGUMENT IS THE UNDO STACK, NOT KEYSTROKE COUNT OR EXCEL PARITY.
   * `UNDO_STACK_LIMIT` is 50 and `pushBounded` slices from the FRONT, so a
   * 2-row x 25-month fill - ordinary in a 36-month plan - pushed 50 snapshots
   * and evicted every earlier entry. Measured at v0.37.23: after three edits
   * plus that fill, 50 undos exhausted the stack and the state before the first
   * edit was UNREACHABLE. The fill stayed undoable; the user's earlier work did
   * not. Per-cell undo does not merely cost keypresses, it deletes the safety
   * net for unrelated work.
   *
   * ⚠️⚠️ THE EMPTY GUARD IS REQUIRED AND IS NOT TIDINESS. `computeFillRegion`
   * returns ZERO cells when the handle is released on the source cell, which is
   * the commonest aborted fill: grab it, change your mind, let go. At HEAD that
   * wrote nothing and pushed nothing. Without this line it would push ONE
   * phantom entry - Ctrl+Z, nothing visibly changes (the snapshot differs by
   * identity, not content), Ctrl+Z again, a real edit is lost.
   *
   * ⚠️ THE GUARD LIVES HERE, NOT AT THE CALL SITE, so a future third caller
   * inherits it - and deliberately so: with a call-site guard the grid would
   * never pass `[]`, deleting this line would break nothing at the grid level,
   * and the only test standing would be the hook-level one. The grid is
   * REQUIRED to pass `[]` through; `AllocationGridPointer.test.tsx` pins that.
   *
   * ⚠️ HONEST BOUND, stated because the flattering version is one word away:
   * this makes Delete over already-empty cells 3 entries -> 1, NOT 3 -> 0.
   * `updateProject` snapshots regardless of content, so an inert write is still
   * an entry. Suppressing no-op writes is a different change and is out of
   * scope. This is not "no phantom entries".
   */
  const onAllocationsChange = useCallback(
    (changes: { memberId: string; month: string; value: number }[]) => {
      if (changes.length === 0) return;
      updateActiveRf((rf) => ({
        ...rf,
        /*
         * Folded in ARRAY ORDER - the same order the per-cell loops applied
         * them. That makes this equivalent to the old N calls whether or not
         * the coordinates are disjoint, so disjointness never has to be proved.
         */
        allocations: changes.reduce(
          (acc, c) => applyAllocation(acc, c.memberId, c.month, c.value),
          rf.allocations,
        ),
      }));
    },
    [updateActiveRf],
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
      let newRfId = '';
      updateProject((prev) => {
        const source = copyFromId
          ? prev.reforecasts.find((r) => r.id === copyFromId)
          : undefined;

        // v0.29.1: a blank new reforecast inherits the baseline reforecast's
        // window (not the project's). Baseline = reforecast named 'Baseline'
        // if present, else the earliest by createdAt. Falls back to project
        // dates only when no reforecasts exist (project-creation edge case
        // that should not occur in normal use).
        const baseline =
          prev.reforecasts.find((r) => r.name === 'Baseline') ??
          [...prev.reforecasts].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
        const defaults = baseline
          ? { startDate: baseline.startDate, endDate: baseline.endDate }
          : { startDate: prev.startDate, endDate: prev.endDate };

        const newRf = createNewReforecast(name, defaults, source);
        newRfId = newRf.id;

        return {
          ...prev,
          reforecasts: [...prev.reforecasts, newRf],
          activeReforecastId: newRf.id,
        };
      });
      ensureOriginRef();
      appendToChangeLog({ op: 'add', entity: 'reforecast', id: newRfId });
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
      ensureOriginRef();
      appendToChangeLog({ op: 'add', entity: 'productivity-window', id: newWindow.id });
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
      appendToChangeLog({ op: 'delete', entity: 'reforecast', id: reforecastId });
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
      appendToChangeLog({ op: 'delete', entity: 'productivity-window', id: windowId });
    },
    [updateActiveRf],
  );

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
      // No-op guard BEFORE updateActiveRf (mirrors updateName). Load-bearing:
      // InlineEditableField.save() fires on blur as well as Enter with no
      // unchanged-value short-circuit, so tabbing through the Baseline field
      // would otherwise clear the charter on every blur. Guarding here — not
      // inside the updater — makes it a TRUE no-op: updateActiveRf always builds
      // a fresh project via .map, and updateProject has no next===prev guard, so
      // an inside-the-updater guard would still push a spurious undo snapshot +
      // redundant persist on every unchanged blur.
      if (activeReforecast && sanitized === activeReforecast.baselineBudget) return;
      // A real manual change clears any charter — the new baseline is a typed
      // value, no longer the charter-derived number. Clear by destructure-rest
      // OMISSION, never `charterBudget: undefined`: stripUndefined is one-deep
      // and Firestore has no ignoreUndefinedProperties, so a nested undefined
      // would throw on setDoc. Mirrors the actualsThroughDate/historicalCosts
      // clear idiom above.
      updateActiveRf((rf) => {
        const { charterBudget: _charterBudget, ...rest } = rf;
        void _charterBudget;
        return { ...rest, baselineBudget: sanitized };
      });
    },
    [updateActiveRf, activeReforecast],
  );

  /**
   * Apply a fully-assembled charter budget: set baselineBudget to the charter
   * amount AND store the charter snapshot, in ONE updateProject call (via
   * updateActiveRf) → a single undo entry and an atomic Firestore doc write.
   * The panel owns the field mapping (engine result + form inputs + calculatedAt
   * → CharterBudget) so the hook stays ignorant of the model. A fully-populated
   * object has no nested undefined, so it serializes cleanly.
   *
   * Distinct from updateBaselineBudget on purpose: routing Apply through the
   * manual-edit path would clear the charter it just set.
   */
  const applyCharterBudget = useCallback(
    (charterBudget: CharterBudget) => {
      updateActiveRf((rf) => ({
        ...rf,
        baselineBudget: charterBudget.charterBudgetAmount,
        charterBudget,
      }));
    },
    [updateActiveRf],
  );

  const updateReforecastDate = useCallback(
    (date: string) => {
      updateActiveRf((rf) => ({ ...rf, reforecastDate: date }));
    },
    [updateActiveRf],
  );

  const updateNotes = useCallback(
    (value: string) => {
      const trimmed = value.slice(0, REFORECAST_NOTES_MAX_LENGTH);
      updateActiveRf((rf) => ({ ...rf, notes: trimmed }));
    },
    [updateActiveRf],
  );

  const updateName = useCallback(
    (value: string) => {
      if (!activeReforecast) return;
      const trimmed = value.trim().slice(0, 50);
      if (trimmed.length === 0) return;
      if (trimmed === activeReforecast.name) return;
      const id = activeReforecast.id;
      updateActiveRf((rf) => ({ ...rf, name: trimmed }));
      ensureOriginRef();
      appendToChangeLog({ op: 'update', entity: 'reforecast', id });
    },
    [activeReforecast, updateActiveRf],
  );

  const updateActualsThroughDate = useCallback(
    (date: string | undefined) => {
      updateActiveRf((rf) => {
        if (date === undefined || date === '') {
          // Intentionally strip actualsThroughDate from the Reforecast shape.
          const { actualsThroughDate: _actualsThroughDate, ...rest } = rf;
          void _actualsThroughDate;
          return rest as Reforecast;
        }
        // When advancing the cutoff to a later month, materialize the prior
        // bucket value so the previously-derived total isn't lost. Pass the
        // project start date so out-of-range cutoffs (e.g. user typed Feb
        // then corrected to March) don't materialize phantom entries.
        // Use the reforecast's own window for the range guard now that
        // reforecast.startDate is the runtime driver (v0.29.0).
        const nextHistorical = materializeBucketOnAdvance(
          rf.historicalCosts,
          rf.actualCost,
          rf.actualsThroughDate,
          date,
          rf.startDate,
        );
        const next: Reforecast = { ...rf, actualsThroughDate: date };
        if (nextHistorical.length > 0) {
          next.historicalCosts = nextHistorical;
        } else if (rf.historicalCosts !== undefined) {
          // materializeBucketOnAdvance returned empty — strip the stale field
          // that was inherited via spread. delete (rather than assigning [])
          // preserves the optional-field "absent" semantic.
          delete next.historicalCosts;
        }
        return next;
      });
    },
    [updateActiveRf],
  );

  /**
   * Commit a new startDate to the active reforecast. Applies the window
   * change (allocations / historicalCosts / actualsThroughDate clamping)
   * and conditionally clamps `reforecastDate` forward when needed.
   *
   * `today` is taken from the toolbar (frozen at dialog-open time per D20)
   * to keep the clamp consistent with the summary the user confirmed.
   */
  const commitReforecastStartDate = useCallback(
    (newStart: string, today: string) => {
      updateActiveRf((rf) => {
        const updated = applyTimelineChangeToSingleReforecast(rf, newStart, rf.endDate);
        const nextReforecastDate = computeClampedReforecastDate(
          rf.reforecastDate,
          newStart,
          today,
        );
        return { ...updated, reforecastDate: nextReforecastDate };
      });
    },
    [updateActiveRf],
  );

  /**
   * Commit a new endDate to the active reforecast. `reforecastDate` is
   * intentionally not touched — a `reforecastDate` past `endDate` is
   * permitted (you can document a forecast in December for a project
   * that ended in June).
   */
  const commitReforecastEndDate = useCallback(
    (newEnd: string) => {
      updateActiveRf((rf) => applyTimelineChangeToSingleReforecast(rf, rf.startDate, newEnd));
    },
    [updateActiveRf],
  );

  const updateHistoricalCosts = useCallback(
    (entries: HistoricalCostEntry[]) => {
      if (!activeReforecast) return;
      const id = activeReforecast.id;
      updateActiveRf((rf) => {
        if (entries.length === 0) {
          // Strip historicalCosts entirely rather than storing an empty array.
          const { historicalCosts: _historicalCosts, ...rest } = rf;
          void _historicalCosts;
          return rest as Reforecast;
        }
        return { ...rf, historicalCosts: entries };
      });
      ensureOriginRef();
      appendToChangeLog({ op: 'update', entity: 'reforecast', id });
    },
    [activeReforecast, updateActiveRf],
  );

  return {
    reforecasts,
    activeReforecast,
    allocationMap,
    productivityWindows,
    onAllocationChange,
    onAllocationsChange,
    switchReforecast,
    createReforecast,
    deleteReforecast,
    addProductivityWindow,
    updateProductivityWindow,
    removeProductivityWindow,
    updateActualCost,
    updateBaselineBudget,
    applyCharterBudget,
    updateReforecastDate,
    updateActualsThroughDate,
    updateHistoricalCosts,
    updateNotes,
    updateName,
    commitReforecastStartDate,
    commitReforecastEndDate,
  };
}
