import { describe, it, expect } from 'vitest';
import type { Project, Reforecast } from '@/types/domain';

/**
 * Tests for reforecast data transformations.
 * These test the pure logic that the useReforecast hook applies
 * via updateProject updater functions.
 */

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj_1',
    name: 'Test Project',
    startDate: '2026-06-15',
    endDate: '2027-07-15',
    assignments: [
      { id: 'a_1', poolMemberId: 'pm_1' },
      { id: 'a_2', poolMemberId: 'pm_2' },
    ],
    reforecasts: [],
    activeReforecastId: null,
    ...overrides,
  };
}

function makeReforecast(overrides: Partial<Reforecast> = {}): Reforecast {
  return {
    id: 'rf_1',
    name: 'Baseline',
    createdAt: '2026-06-01T00:00:00Z',
    startDate: '2026-06',
    reforecastDate: '2026-06-01',
    allocations: [
      { memberId: 'a_1', month: '2026-06', allocation: 0.25 },
      { memberId: 'a_1', month: '2026-07', allocation: 0.5 },
      { memberId: 'a_2', month: '2026-06', allocation: 0.4 },
    ],
    productivityWindows: [
      { id: 'pw_1', startDate: '2026-12-01', endDate: '2026-12-31', factor: 0.5 },
    ],
    actualCost: 0,
    baselineBudget: 1000000,
    ...overrides,
  };
}

// Simulate the createReforecast updater logic from useReforecast
function createReforecastUpdater(
  name: string,
  copyFromId?: string,
) {
  return (prev: Project): Project => {
    const sourceReforecast = copyFromId
      ? prev.reforecasts.find((r) => r.id === copyFromId)
      : null;

    const newRf: Reforecast = {
      id: 'rf_new',
      name,
      createdAt: new Date().toISOString(),
      startDate: prev.startDate,
      reforecastDate: new Date().toISOString().slice(0, 10),
      allocations: sourceReforecast
        ? sourceReforecast.allocations.map((a) => ({ ...a }))
        : [],
      productivityWindows: sourceReforecast
        ? sourceReforecast.productivityWindows.map((w) => ({
            ...w,
            id: `pw_new_${w.id}`,
          }))
        : [],
      actualCost: sourceReforecast ? sourceReforecast.actualCost : 0,
      baselineBudget: sourceReforecast ? sourceReforecast.baselineBudget : 0,
    };

    return {
      ...prev,
      reforecasts: [...prev.reforecasts, newRf],
      activeReforecastId: newRf.id,
    };
  };
}

// Simulate switchReforecast logic
function switchReforecastUpdater(reforecastId: string) {
  return (prev: Project): Project => {
    const exists = prev.reforecasts.some((r) => r.id === reforecastId);
    if (!exists) return prev;
    return { ...prev, activeReforecastId: reforecastId };
  };
}

describe('Reforecast Management', () => {
  describe('createReforecast', () => {
    it('creates an empty reforecast', () => {
      const project = makeProject();
      const updated = createReforecastUpdater('Q3 Reforecast')(project);

      expect(updated.reforecasts).toHaveLength(1);
      expect(updated.reforecasts[0].name).toBe('Q3 Reforecast');
      expect(updated.reforecasts[0].allocations).toEqual([]);
      expect(updated.reforecasts[0].productivityWindows).toEqual([]);
      expect(updated.reforecasts[0].actualCost).toBe(0);
      expect(updated.activeReforecastId).toBe('rf_new');
    });

    it('copies allocations from an existing reforecast', () => {
      const rf = makeReforecast();
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = createReforecastUpdater('Copy', rf.id)(project);

      expect(updated.reforecasts).toHaveLength(2);
      const newRf = updated.reforecasts[1];
      expect(newRf.name).toBe('Copy');
      expect(newRf.allocations).toHaveLength(3);
      expect(newRf.allocations[0]).toEqual({
        memberId: 'a_1',
        month: '2026-06',
        allocation: 0.25,
      });
    });

    it('deep-clones allocations (mutations do not affect source)', () => {
      const rf = makeReforecast();
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = createReforecastUpdater('Copy', rf.id)(project);
      const newRf = updated.reforecasts[1];

      // Mutate the copy
      newRf.allocations[0].allocation = 0.99;

      // Source should be unchanged
      expect(updated.reforecasts[0].allocations[0].allocation).toBe(0.25);
    });

    it('copies productivity windows with new IDs', () => {
      const rf = makeReforecast();
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = createReforecastUpdater('Copy', rf.id)(project);
      const newRf = updated.reforecasts[1];

      expect(newRf.productivityWindows).toHaveLength(1);
      expect(newRf.productivityWindows[0].factor).toBe(0.5);
      expect(newRf.productivityWindows[0].id).not.toBe(rf.productivityWindows[0].id);
    });

    it('creates empty reforecast if copyFromId does not match', () => {
      const rf = makeReforecast();
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = createReforecastUpdater('New', 'nonexistent')(project);
      const newRf = updated.reforecasts[1];

      expect(newRf.allocations).toEqual([]);
      expect(newRf.productivityWindows).toEqual([]);
    });

    it('sets the new reforecast as active', () => {
      const rf = makeReforecast();
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = createReforecastUpdater('New')(project);

      expect(updated.activeReforecastId).toBe('rf_new');
    });
  });

  describe('switchReforecast', () => {
    it('switches to an existing reforecast', () => {
      const rf1 = makeReforecast({ id: 'rf_1' });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3' });
      const project = makeProject({
        reforecasts: [rf1, rf2],
        activeReforecastId: 'rf_1',
      });

      const updated = switchReforecastUpdater('rf_2')(project);
      expect(updated.activeReforecastId).toBe('rf_2');
    });

    it('no-ops if reforecast ID does not exist', () => {
      const rf = makeReforecast();
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = switchReforecastUpdater('nonexistent')(project);
      expect(updated.activeReforecastId).toBe(rf.id);
    });
  });

  describe('deleteReforecast', () => {
    // Simulate deleteReforecast logic from useReforecast (with guard)
    function deleteReforecastUpdater(reforecastId: string) {
      return (prev: Project): Project => {
        if (prev.reforecasts.length <= 1) return prev;
        const remaining = prev.reforecasts.filter((r) => r.id !== reforecastId);
        const wasActive = prev.activeReforecastId === reforecastId;
        return {
          ...prev,
          reforecasts: remaining,
          activeReforecastId: wasActive
            ? (remaining.length > 0 ? remaining[0].id : null)
            : prev.activeReforecastId,
        };
      };
    }

    it('removes the specified reforecast', () => {
      const rf1 = makeReforecast({ id: 'rf_1' });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3' });
      const project = makeProject({
        reforecasts: [rf1, rf2],
        activeReforecastId: 'rf_1',
      });

      const updated = deleteReforecastUpdater('rf_2')(project);
      expect(updated.reforecasts).toHaveLength(1);
      expect(updated.reforecasts[0].id).toBe('rf_1');
    });

    it('switches active to first remaining when active is deleted', () => {
      const rf1 = makeReforecast({ id: 'rf_1' });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3' });
      const project = makeProject({
        reforecasts: [rf1, rf2],
        activeReforecastId: 'rf_1',
      });

      const updated = deleteReforecastUpdater('rf_1')(project);
      expect(updated.reforecasts).toHaveLength(1);
      expect(updated.activeReforecastId).toBe('rf_2');
    });

    it('does not delete the last reforecast (guard)', () => {
      const rf = makeReforecast();
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = deleteReforecastUpdater(rf.id)(project);
      expect(updated.reforecasts).toHaveLength(1);
      expect(updated.activeReforecastId).toBe(rf.id);
    });

    it('preserves activeReforecastId when non-active is deleted', () => {
      const rf1 = makeReforecast({ id: 'rf_1' });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3' });
      const project = makeProject({
        reforecasts: [rf1, rf2],
        activeReforecastId: 'rf_1',
      });

      const updated = deleteReforecastUpdater('rf_2')(project);
      expect(updated.activeReforecastId).toBe('rf_1');
    });
  });

  describe('productivity window CRUD', () => {
    it('adds a productivity window to active reforecast', () => {
      const rf = makeReforecast({ productivityWindows: [] });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      // Simulate addProductivityWindow logic
      const updated: Project = {
        ...project,
        reforecasts: project.reforecasts.map((r) =>
          r.id === rf.id
            ? {
                ...r,
                productivityWindows: [
                  ...r.productivityWindows,
                  { id: 'pw_new', startDate: '2026-12-01', endDate: '2026-12-31', factor: 0.5 },
                ],
              }
            : r,
        ),
      };

      expect(updated.reforecasts[0].productivityWindows).toHaveLength(1);
      expect(updated.reforecasts[0].productivityWindows[0].factor).toBe(0.5);
    });

    it('updates a productivity window', () => {
      const rf = makeReforecast();
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      // Simulate updateProductivityWindow logic
      const updated: Project = {
        ...project,
        reforecasts: project.reforecasts.map((r) =>
          r.id === rf.id
            ? {
                ...r,
                productivityWindows: r.productivityWindows.map((w) =>
                  w.id === 'pw_1' ? { ...w, factor: 0.75 } : w,
                ),
              }
            : r,
        ),
      };

      expect(updated.reforecasts[0].productivityWindows[0].factor).toBe(0.75);
    });

    it('removes a productivity window', () => {
      const rf = makeReforecast();
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      // Simulate removeProductivityWindow logic
      const updated: Project = {
        ...project,
        reforecasts: project.reforecasts.map((r) =>
          r.id === rf.id
            ? {
                ...r,
                productivityWindows: r.productivityWindows.filter(
                  (w) => w.id !== 'pw_1',
                ),
              }
            : r,
        ),
      };

      expect(updated.reforecasts[0].productivityWindows).toHaveLength(0);
    });

    it('only affects the active reforecast', () => {
      const rf1 = makeReforecast({
        id: 'rf_1',
        productivityWindows: [
          { id: 'pw_1', startDate: '2026-12-01', endDate: '2026-12-31', factor: 0.5 },
        ],
      });
      const rf2 = makeReforecast({
        id: 'rf_2',
        name: 'Q3',
        productivityWindows: [
          { id: 'pw_2', startDate: '2027-01-01', endDate: '2027-01-31', factor: 0.75 },
        ],
      });
      const project = makeProject({
        reforecasts: [rf1, rf2],
        activeReforecastId: 'rf_1',
      });

      // Remove from rf_1 only
      const updated: Project = {
        ...project,
        reforecasts: project.reforecasts.map((r) =>
          r.id === 'rf_1'
            ? {
                ...r,
                productivityWindows: r.productivityWindows.filter(
                  (w) => w.id !== 'pw_1',
                ),
              }
            : r,
        ),
      };

      expect(updated.reforecasts[0].productivityWindows).toHaveLength(0);
      expect(updated.reforecasts[1].productivityWindows).toHaveLength(1);
    });
  });

  describe('actualCost per reforecast', () => {
    it('copies actualCost when creating from source reforecast', () => {
      const rf = makeReforecast({ actualCost: 50000 });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = createReforecastUpdater('Copy', rf.id)(project);
      expect(updated.reforecasts[1].actualCost).toBe(50000);
    });

    it('defaults actualCost to 0 when starting fresh', () => {
      const project = makeProject();
      const updated = createReforecastUpdater('New')(project);
      expect(updated.reforecasts[0].actualCost).toBe(0);
    });

    it('defaults actualCost to 0 when copyFromId does not match', () => {
      const rf = makeReforecast({ actualCost: 50000 });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = createReforecastUpdater('New', 'nonexistent')(project);
      expect(updated.reforecasts[1].actualCost).toBe(0);
    });

    it('reforecasts maintain independent actualCost values', () => {
      const rf1 = makeReforecast({ id: 'rf_1', actualCost: 50000 });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3', actualCost: 75000 });
      const project = makeProject({
        reforecasts: [rf1, rf2],
        activeReforecastId: 'rf_1',
      });

      // Each reforecast retains its own value
      expect(project.reforecasts[0].actualCost).toBe(50000);
      expect(project.reforecasts[1].actualCost).toBe(75000);

      // Switching active reforecast doesn't change either value
      const switched = switchReforecastUpdater('rf_2')(project);
      expect(switched.reforecasts[0].actualCost).toBe(50000);
      expect(switched.reforecasts[1].actualCost).toBe(75000);
    });
  });

  describe('updateActualCost sanitization', () => {
    // Simulate the updateActualCost updater logic from useReforecast
    function updateActualCostUpdater(value: number) {
      return (prev: Project): Project => {
        if (prev.reforecasts.length === 0) return prev;
        const reforecastId = prev.activeReforecastId ?? prev.reforecasts[0].id;
        const sanitized = Number.isFinite(value) ? Math.max(0, value) : 0;
        return {
          ...prev,
          reforecasts: prev.reforecasts.map((rf) =>
            rf.id === reforecastId
              ? { ...rf, actualCost: sanitized }
              : rf,
          ),
        };
      };
    }

    it('sets a valid positive value', () => {
      const rf = makeReforecast({ actualCost: 0 });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = updateActualCostUpdater(50000)(project);
      expect(updated.reforecasts[0].actualCost).toBe(50000);
    });

    it('clamps NaN to 0', () => {
      const rf = makeReforecast({ actualCost: 10000 });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = updateActualCostUpdater(NaN)(project);
      expect(updated.reforecasts[0].actualCost).toBe(0);
    });

    it('clamps Infinity to 0', () => {
      const rf = makeReforecast({ actualCost: 10000 });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = updateActualCostUpdater(Infinity)(project);
      expect(updated.reforecasts[0].actualCost).toBe(0);
    });

    it('clamps -Infinity to 0', () => {
      const rf = makeReforecast({ actualCost: 10000 });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = updateActualCostUpdater(-Infinity)(project);
      expect(updated.reforecasts[0].actualCost).toBe(0);
    });

    it('clamps negative values to 0', () => {
      const rf = makeReforecast({ actualCost: 10000 });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = updateActualCostUpdater(-500)(project);
      expect(updated.reforecasts[0].actualCost).toBe(0);
    });

    it('only updates the active reforecast', () => {
      const rf1 = makeReforecast({ id: 'rf_1', actualCost: 10000 });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3', actualCost: 20000 });
      const project = makeProject({
        reforecasts: [rf1, rf2],
        activeReforecastId: 'rf_1',
      });

      const updated = updateActualCostUpdater(99000)(project);
      expect(updated.reforecasts[0].actualCost).toBe(99000);
      expect(updated.reforecasts[1].actualCost).toBe(20000);
    });
  });

  describe('deleteReforecast and actualCost', () => {
    function deleteReforecastUpdater(reforecastId: string) {
      return (prev: Project): Project => {
        if (prev.reforecasts.length <= 1) return prev;
        const remaining = prev.reforecasts.filter((r) => r.id !== reforecastId);
        const wasActive = prev.activeReforecastId === reforecastId;
        return {
          ...prev,
          reforecasts: remaining,
          activeReforecastId: wasActive
            ? (remaining.length > 0 ? remaining[0].id : null)
            : prev.activeReforecastId,
        };
      };
    }

    it('preserves actualCost of remaining reforecasts after deletion', () => {
      const rf1 = makeReforecast({ id: 'rf_1', actualCost: 10000 });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3', actualCost: 25000 });
      const project = makeProject({
        reforecasts: [rf1, rf2],
        activeReforecastId: 'rf_1',
      });

      const updated = deleteReforecastUpdater('rf_1')(project);
      expect(updated.reforecasts).toHaveLength(1);
      expect(updated.reforecasts[0].actualCost).toBe(25000);
      expect(updated.activeReforecastId).toBe('rf_2');
    });
  });

  describe('updateReforecastDate', () => {
    // Simulate the updateReforecastDate updater logic from useReforecast
    function updateReforecastDateUpdater(date: string) {
      return (prev: Project): Project => {
        if (prev.reforecasts.length === 0) return prev;
        const reforecastId = prev.activeReforecastId ?? prev.reforecasts[0].id;
        return {
          ...prev,
          reforecasts: prev.reforecasts.map((rf) =>
            rf.id === reforecastId
              ? { ...rf, reforecastDate: date }
              : rf,
          ),
        };
      };
    }

    it('sets a valid date string', () => {
      const rf = makeReforecast({ reforecastDate: '2026-06-01' });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = updateReforecastDateUpdater('2026-09-15')(project);
      expect(updated.reforecasts[0].reforecastDate).toBe('2026-09-15');
    });

    it('only updates the active reforecast', () => {
      const rf1 = makeReforecast({ id: 'rf_1', reforecastDate: '2026-06-01' });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3', reforecastDate: '2026-09-01' });
      const project = makeProject({
        reforecasts: [rf1, rf2],
        activeReforecastId: 'rf_1',
      });

      const updated = updateReforecastDateUpdater('2026-12-01')(project);
      expect(updated.reforecasts[0].reforecastDate).toBe('2026-12-01');
      expect(updated.reforecasts[1].reforecastDate).toBe('2026-09-01');
    });

    it('handles empty string (cleared date input)', () => {
      const rf = makeReforecast({ reforecastDate: '2026-06-01' });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = updateReforecastDateUpdater('')(project);
      expect(updated.reforecasts[0].reforecastDate).toBe('');
    });

    it('no-ops when there are no reforecasts', () => {
      const project = makeProject({ reforecasts: [] });
      const updated = updateReforecastDateUpdater('2026-09-15')(project);
      expect(updated.reforecasts).toHaveLength(0);
    });
  });

  describe('baselineBudget per reforecast', () => {
    it('copies baselineBudget when creating from source reforecast', () => {
      const rf = makeReforecast({ baselineBudget: 500000 });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = createReforecastUpdater('Copy', rf.id)(project);
      expect(updated.reforecasts[1].baselineBudget).toBe(500000);
    });

    it('defaults baselineBudget to 0 when starting fresh', () => {
      const project = makeProject();
      const updated = createReforecastUpdater('New')(project);
      expect(updated.reforecasts[0].baselineBudget).toBe(0);
    });

    it('defaults baselineBudget to 0 when copyFromId does not match', () => {
      const rf = makeReforecast({ baselineBudget: 500000 });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = createReforecastUpdater('New', 'nonexistent')(project);
      expect(updated.reforecasts[1].baselineBudget).toBe(0);
    });

    it('reforecasts maintain independent baselineBudget values', () => {
      const rf1 = makeReforecast({ id: 'rf_1', baselineBudget: 500000 });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3', baselineBudget: 750000 });
      const project = makeProject({
        reforecasts: [rf1, rf2],
        activeReforecastId: 'rf_1',
      });

      expect(project.reforecasts[0].baselineBudget).toBe(500000);
      expect(project.reforecasts[1].baselineBudget).toBe(750000);

      const switched = switchReforecastUpdater('rf_2')(project);
      expect(switched.reforecasts[0].baselineBudget).toBe(500000);
      expect(switched.reforecasts[1].baselineBudget).toBe(750000);
    });
  });

  describe('updateBaselineBudget sanitization', () => {
    // Simulate the updateBaselineBudget updater logic (same pattern as actualCost)
    function updateBaselineBudgetUpdater(value: number) {
      return (prev: Project): Project => {
        if (prev.reforecasts.length === 0) return prev;
        const reforecastId = prev.activeReforecastId ?? prev.reforecasts[0].id;
        const sanitized = Number.isFinite(value) ? Math.max(0, value) : 0;
        return {
          ...prev,
          reforecasts: prev.reforecasts.map((rf) =>
            rf.id === reforecastId
              ? { ...rf, baselineBudget: sanitized }
              : rf,
          ),
        };
      };
    }

    it('sets a valid positive value', () => {
      const rf = makeReforecast({ baselineBudget: 0 });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = updateBaselineBudgetUpdater(750000)(project);
      expect(updated.reforecasts[0].baselineBudget).toBe(750000);
    });

    it('clamps NaN to 0', () => {
      const rf = makeReforecast({ baselineBudget: 500000 });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = updateBaselineBudgetUpdater(NaN)(project);
      expect(updated.reforecasts[0].baselineBudget).toBe(0);
    });

    it('clamps Infinity to 0', () => {
      const rf = makeReforecast({ baselineBudget: 500000 });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = updateBaselineBudgetUpdater(Infinity)(project);
      expect(updated.reforecasts[0].baselineBudget).toBe(0);
    });

    it('clamps -Infinity to 0', () => {
      const rf = makeReforecast({ baselineBudget: 500000 });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = updateBaselineBudgetUpdater(-Infinity)(project);
      expect(updated.reforecasts[0].baselineBudget).toBe(0);
    });

    it('clamps negative values to 0', () => {
      const rf = makeReforecast({ baselineBudget: 500000 });
      const project = makeProject({
        reforecasts: [rf],
        activeReforecastId: rf.id,
      });

      const updated = updateBaselineBudgetUpdater(-1000)(project);
      expect(updated.reforecasts[0].baselineBudget).toBe(0);
    });

    it('only updates the active reforecast', () => {
      const rf1 = makeReforecast({ id: 'rf_1', baselineBudget: 500000 });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3', baselineBudget: 750000 });
      const project = makeProject({
        reforecasts: [rf1, rf2],
        activeReforecastId: 'rf_1',
      });

      const updated = updateBaselineBudgetUpdater(999000)(project);
      expect(updated.reforecasts[0].baselineBudget).toBe(999000);
      expect(updated.reforecasts[1].baselineBudget).toBe(750000);
    });
  });
});
