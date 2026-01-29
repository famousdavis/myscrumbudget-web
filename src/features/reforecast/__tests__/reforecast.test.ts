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
    baselineBudget: 1000000,
    actualCost: 200000,
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
    allocations: [
      { memberId: 'a_1', month: '2026-06', allocation: 0.25 },
      { memberId: 'a_1', month: '2026-07', allocation: 0.5 },
      { memberId: 'a_2', month: '2026-06', allocation: 0.4 },
    ],
    productivityWindows: [
      { id: 'pw_1', startDate: '2026-12-01', endDate: '2026-12-31', factor: 0.5 },
    ],
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
      allocations: sourceReforecast
        ? sourceReforecast.allocations.map((a) => ({ ...a }))
        : [],
      productivityWindows: sourceReforecast
        ? sourceReforecast.productivityWindows.map((w) => ({
            ...w,
            id: `pw_new_${w.id}`,
          }))
        : [],
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
});
