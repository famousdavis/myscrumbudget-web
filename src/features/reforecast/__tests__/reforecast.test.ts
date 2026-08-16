// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Project, Reforecast } from '@/types/domain';
import { REFORECAST_NOTES_MAX_LENGTH } from '@/lib/constants';
import { useReforecast } from '../hooks/useReforecast';

/**
 * Tests for the useReforecast hook, driven through the real hook.
 *
 * This file previously carried eleven hand-written copies of the hook's
 * updaters and asserted against those — 54 of the 58 tests bearing the hook's
 * name exercised a re-implementation, while useReforecast.ts itself measured
 * 29.87% of statements and 13 of 54 functions.
 *
 * The copies were not merely separate, they had DRIFTED. The old
 * createReforecastUpdater took its window from the PROJECT (`prev.startDate`),
 * which the real hook stopped doing at v0.29.1 — a copy now inherits the
 * SOURCE reforecast's window — and it copied neither `actualsThroughDate` nor
 * `historicalCosts`, both of which the real one carries forward. Tests written
 * against it pinned behaviour the shipped app has not had for ten releases.
 *
 * Expected values here are literals or built independently of the hook's own
 * expression shape. Where an old assertion encoded a simulator artefact — the
 * hard-coded id 'rf_new', for instance — the intent is kept and the value is
 * rewritten against the real output.
 */

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj_1',
    name: 'Test Project',
    startDate: '2026-06-15',
    endDate: '2027-07-15',
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
    startDate: '2026-06-15',
    endDate: '2027-07-15',
    reforecastDate: '2026-06-01',
    assignments: [
      { id: 'a_1', poolMemberId: 'pm_1' },
      { id: 'a_2', poolMemberId: 'pm_2' },
    ],
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

/**
 * Renders the REAL useReforecast with an updateProject that actually applies
 * the updater, so the hook's own reducers run. `box.current` is the project
 * after each operation; `run` re-renders so the next call sees fresh state
 * (several operations read `activeReforecast` from the render closure).
 */
function hook(initial: Project) {
  const box = { current: initial };
  const view = renderHook(
    ({ p }) =>
      useReforecast({
        project: p,
        updateProject: (u) => {
          box.current = u(box.current);
        },
      }),
    { initialProps: { p: box.current } },
  );
  const run = (fn: (api: ReturnType<typeof useReforecast>) => void) => {
    act(() => {
      fn(view.result.current);
    });
    view.rerender({ p: box.current });
  };
  return { box, view, run };
}

/** The reforecast added by the operation under test (the last one appended). */
function newest(p: Project): Reforecast {
  return p.reforecasts[p.reforecasts.length - 1];
}

describe('Reforecast Management', () => {
  describe('createReforecast', () => {
    it('creates an empty reforecast', () => {
      const h = hook(makeProject());
      h.run((a) => a.createReforecast('Q3 Reforecast'));
      const updated = h.box.current;

      expect(updated.reforecasts).toHaveLength(1);
      expect(updated.reforecasts[0].name).toBe('Q3 Reforecast');
      expect(updated.reforecasts[0].allocations).toEqual([]);
      expect(updated.reforecasts[0].productivityWindows).toEqual([]);
      expect(updated.reforecasts[0].actualCost).toBe(0);
      // Was `toBe('rf_new')` — the old simulator hard-coded that id. The real
      // hook generates one, so the intent ("the new reforecast becomes active")
      // is asserted against the reforecast actually stored.
      expect(updated.activeReforecastId).toBe(updated.reforecasts[0].id);
    });

    it('copies allocations from an existing reforecast', () => {
      const rf = makeReforecast();
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.createReforecast('Copy', rf.id));
      const updated = h.box.current;

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
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.createReforecast('Copy', rf.id));
      const updated = h.box.current;
      const newRf = updated.reforecasts[1];

      // Mutate the copy
      newRf.allocations[0].allocation = 0.99;

      // Source should be unchanged
      expect(updated.reforecasts[0].allocations[0].allocation).toBe(0.25);
    });

    it('copies productivity windows with new IDs', () => {
      const rf = makeReforecast();
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.createReforecast('Copy', rf.id));
      const newRf = h.box.current.reforecasts[1];

      expect(newRf.productivityWindows).toHaveLength(1);
      expect(newRf.productivityWindows[0].factor).toBe(0.5);
      expect(newRf.productivityWindows[0].id).not.toBe(rf.productivityWindows[0].id);
    });

    it('creates empty reforecast if copyFromId does not match', () => {
      const rf = makeReforecast();
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.createReforecast('New', 'nonexistent'));
      const newRf = h.box.current.reforecasts[1];

      expect(newRf.allocations).toEqual([]);
      expect(newRf.productivityWindows).toEqual([]);
    });

    it('clones assignments from source preserving IDs', () => {
      const rf = makeReforecast();
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.createReforecast('Copy', rf.id));
      const newRf = h.box.current.reforecasts[1];
      expect(newRf.assignments).toHaveLength(2);
      expect(newRf.assignments.map((a) => a.id)).toEqual(['a_1', 'a_2']);
      // Allocations key on assignment.id and must continue to resolve. Asserted
      // as the literal id set rather than a cross-check between the two arrays:
      // an `every/some` over the copy's own fields holds even if BOTH were
      // regenerated together, which is the exact bug this test exists to catch.
      expect(newRf.allocations.map((a) => a.memberId)).toEqual(['a_1', 'a_1', 'a_2']);
    });

    it('mutating cloned assignments does not affect source', () => {
      const rf = makeReforecast();
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.createReforecast('Copy', rf.id));
      const updated = h.box.current;
      updated.reforecasts[1].assignments.push({ id: 'a_3', poolMemberId: 'pm_3' });
      expect(updated.reforecasts[0].assignments).toHaveLength(2);
    });

    it('sets the new reforecast as active', () => {
      const rf = makeReforecast();
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.createReforecast('New'));
      const updated = h.box.current;

      // Was `toBe('rf_new')` (simulator artefact). Same intent, real id.
      expect(updated.activeReforecastId).toBe(newest(updated).id);
      expect(updated.activeReforecastId).not.toBe(rf.id);
    });

    it('a copy inherits the SOURCE window, not the project window (v0.29.1)', () => {
      // Not in the old file, and it could not have been: the simulator took the
      // window from `prev.startDate`/`prev.endDate`, so this assertion would
      // have failed against it. It is the drift that motivated the conversion.
      const rf = makeReforecast({ startDate: '2026-08-01', endDate: '2026-09-30' });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.createReforecast('Copy', rf.id));
      const newRf = h.box.current.reforecasts[1];

      expect(newRf.startDate).toBe('2026-08-01');
      expect(newRf.endDate).toBe('2026-09-30');
      // The project's own window is deliberately NOT what a copy inherits.
      expect(newRf.startDate).not.toBe('2026-06-15');
    });

    it('a blank reforecast inherits the Baseline reforecast window (v0.29.1)', () => {
      const base = makeReforecast({ id: 'rf_base', name: 'Baseline', startDate: '2026-08-01', endDate: '2026-09-30' });
      const h = hook(makeProject({ reforecasts: [base], activeReforecastId: 'rf_base' }));
      h.run((a) => a.createReforecast('Blank'));
      const newRf = newest(h.box.current);

      expect(newRf.startDate).toBe('2026-08-01');
      expect(newRf.endDate).toBe('2026-09-30');
      expect(newRf.allocations).toEqual([]);
    });
  });

  describe('switchReforecast', () => {
    it('switches to an existing reforecast', () => {
      const rf1 = makeReforecast({ id: 'rf_1' });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3' });
      const h = hook(makeProject({ reforecasts: [rf1, rf2], activeReforecastId: 'rf_1' }));

      h.run((a) => a.switchReforecast('rf_2'));
      expect(h.box.current.activeReforecastId).toBe('rf_2');
    });

    it('no-ops if reforecast ID does not exist', () => {
      const rf = makeReforecast();
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));

      h.run((a) => a.switchReforecast('nonexistent'));
      expect(h.box.current.activeReforecastId).toBe(rf.id);
    });
  });

  describe('deleteReforecast', () => {
    it('removes the specified reforecast', () => {
      const rf1 = makeReforecast({ id: 'rf_1' });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3' });
      const h = hook(makeProject({ reforecasts: [rf1, rf2], activeReforecastId: 'rf_1' }));
      h.run((a) => a.deleteReforecast('rf_2'));
      const updated = h.box.current;
      expect(updated.reforecasts).toHaveLength(1);
      expect(updated.reforecasts[0].id).toBe('rf_1');
    });

    it('switches active to first remaining when active is deleted', () => {
      const rf1 = makeReforecast({ id: 'rf_1' });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3' });
      const h = hook(makeProject({ reforecasts: [rf1, rf2], activeReforecastId: 'rf_1' }));
      h.run((a) => a.deleteReforecast('rf_1'));
      const updated = h.box.current;
      expect(updated.reforecasts).toHaveLength(1);
      expect(updated.activeReforecastId).toBe('rf_2');
    });

    it('does not delete the last reforecast (guard)', () => {
      const rf = makeReforecast();
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.deleteReforecast(rf.id));
      const updated = h.box.current;
      expect(updated.reforecasts).toHaveLength(1);
      expect(updated.activeReforecastId).toBe(rf.id);
    });

    it('preserves activeReforecastId when non-active is deleted', () => {
      const rf1 = makeReforecast({ id: 'rf_1' });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3' });
      const h = hook(makeProject({ reforecasts: [rf1, rf2], activeReforecastId: 'rf_1' }));
      h.run((a) => a.deleteReforecast('rf_2'));
      const updated = h.box.current;
      expect(updated.activeReforecastId).toBe('rf_1');
    });
  });

  describe('productivity window CRUD', () => {
    it('adds a productivity window to active reforecast', () => {
      const rf = makeReforecast({ productivityWindows: [] });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.addProductivityWindow('2026-12-01', '2026-12-31', 0.5));
      const updated = h.box.current;

      expect(updated.reforecasts[0].productivityWindows).toHaveLength(1);
      expect(updated.reforecasts[0].productivityWindows[0].factor).toBe(0.5);
    });

    it('updates a productivity window', () => {
      const rf = makeReforecast();
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.updateProductivityWindow('pw_1', { factor: 0.75 }));
      const updated = h.box.current;

      expect(updated.reforecasts[0].productivityWindows[0].factor).toBe(0.75);
    });

    it('removes a productivity window', () => {
      const rf = makeReforecast();
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.removeProductivityWindow('pw_1'));
      const updated = h.box.current;

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
      const h = hook(makeProject({ reforecasts: [rf1, rf2], activeReforecastId: 'rf_1' }));
      h.run((a) => a.removeProductivityWindow('pw_1'));
      const updated = h.box.current;

      expect(updated.reforecasts[0].productivityWindows).toHaveLength(0);
      expect(updated.reforecasts[1].productivityWindows).toHaveLength(1);
    });
  });

  describe('actualCost per reforecast', () => {
    it('copies actualCost when creating from source reforecast', () => {
      const rf = makeReforecast({ actualCost: 50000 });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.createReforecast('Copy', rf.id));
      const updated = h.box.current;
      expect(updated.reforecasts[1].actualCost).toBe(50000);
    });

    it('defaults actualCost to 0 when starting fresh', () => {
      const h = hook(makeProject());
      h.run((a) => a.createReforecast('New'));
      const updated = h.box.current;
      expect(updated.reforecasts[0].actualCost).toBe(0);
    });

    it('defaults actualCost to 0 when copyFromId does not match', () => {
      const rf = makeReforecast({ actualCost: 50000 });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.createReforecast('New', 'nonexistent'));
      const updated = h.box.current;
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
      const sh = hook(project);
      sh.run((a) => a.switchReforecast('rf_2'));
      const switched = sh.box.current;
      expect(switched.reforecasts[0].actualCost).toBe(50000);
      expect(switched.reforecasts[1].actualCost).toBe(75000);
    });
  });

  describe('updateActualCost sanitization', () => {

    it('sets a valid positive value', () => {
      const rf = makeReforecast({ actualCost: 0 });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateActualCost(50000));
      const updated = h.box.current;
      expect(updated.reforecasts[0].actualCost).toBe(50000);
    });

    it('clamps NaN to 0', () => {
      const rf = makeReforecast({ actualCost: 10000 });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateActualCost(NaN));
      const updated = h.box.current;
      expect(updated.reforecasts[0].actualCost).toBe(0);
    });

    it('clamps Infinity to 0', () => {
      const rf = makeReforecast({ actualCost: 10000 });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateActualCost(Infinity));
      const updated = h.box.current;
      expect(updated.reforecasts[0].actualCost).toBe(0);
    });

    it('clamps -Infinity to 0', () => {
      const rf = makeReforecast({ actualCost: 10000 });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateActualCost(-Infinity));
      const updated = h.box.current;
      expect(updated.reforecasts[0].actualCost).toBe(0);
    });

    it('clamps negative values to 0', () => {
      const rf = makeReforecast({ actualCost: 10000 });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateActualCost(-500));
      const updated = h.box.current;
      expect(updated.reforecasts[0].actualCost).toBe(0);
    });

    it('only updates the active reforecast', () => {
      const rf1 = makeReforecast({ id: 'rf_1', actualCost: 10000 });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3', actualCost: 20000 });
      const h = hook(makeProject({ reforecasts: [rf1, rf2], activeReforecastId: 'rf_1', }));
      h.run((a) => a.updateActualCost(99000));
      const updated = h.box.current;
      expect(updated.reforecasts[0].actualCost).toBe(99000);
      expect(updated.reforecasts[1].actualCost).toBe(20000);
    });
  });

  describe('deleteReforecast and actualCost', () => {
    it('preserves actualCost of remaining reforecasts after deletion', () => {
      const rf1 = makeReforecast({ id: 'rf_1', actualCost: 10000 });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3', actualCost: 25000 });
      const h = hook(makeProject({ reforecasts: [rf1, rf2], activeReforecastId: 'rf_1' }));
      h.run((a) => a.deleteReforecast('rf_1'));
      const updated = h.box.current;
      expect(updated.reforecasts).toHaveLength(1);
      expect(updated.reforecasts[0].actualCost).toBe(25000);
      expect(updated.activeReforecastId).toBe('rf_2');
    });
  });

  describe('updateReforecastDate', () => {

    it('sets a valid date string', () => {
      const rf = makeReforecast({ reforecastDate: '2026-06-01' });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateReforecastDate('2026-09-15'));
      const updated = h.box.current;
      expect(updated.reforecasts[0].reforecastDate).toBe('2026-09-15');
    });

    it('only updates the active reforecast', () => {
      const rf1 = makeReforecast({ id: 'rf_1', reforecastDate: '2026-06-01' });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3', reforecastDate: '2026-09-01' });
      const h = hook(makeProject({ reforecasts: [rf1, rf2], activeReforecastId: 'rf_1', }));
      h.run((a) => a.updateReforecastDate('2026-12-01'));
      const updated = h.box.current;
      expect(updated.reforecasts[0].reforecastDate).toBe('2026-12-01');
      expect(updated.reforecasts[1].reforecastDate).toBe('2026-09-01');
    });

    it('handles empty string (cleared date input)', () => {
      const rf = makeReforecast({ reforecastDate: '2026-06-01' });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateReforecastDate(''));
      const updated = h.box.current;
      expect(updated.reforecasts[0].reforecastDate).toBe('');
    });

    it('creates a Baseline reforecast when there are none, then dates it', () => {
      // The old simulator no-opped on an empty list. The real hook routes
      // through ensureReforecast, which CREATES a Baseline first — a defensive
      // invariant the copy never modelled. Characterised, not asserted away.
      const h = hook(makeProject({ reforecasts: [] }));
      h.run((a) => a.updateReforecastDate('2026-09-15'));
      const updated = h.box.current;
      expect(updated.reforecasts).toHaveLength(1);
      expect(updated.reforecasts[0].name).toBe('Baseline');
      expect(updated.reforecasts[0].reforecastDate).toBe('2026-09-15');
      expect(updated.activeReforecastId).toBe(updated.reforecasts[0].id);
    });
  });

  describe('baselineBudget per reforecast', () => {
    it('copies baselineBudget when creating from source reforecast', () => {
      const rf = makeReforecast({ baselineBudget: 500000 });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.createReforecast('Copy', rf.id));
      const updated = h.box.current;
      expect(updated.reforecasts[1].baselineBudget).toBe(500000);
    });

    it('defaults baselineBudget to 0 when starting fresh', () => {
      const h = hook(makeProject());
      h.run((a) => a.createReforecast('New'));
      const updated = h.box.current;
      expect(updated.reforecasts[0].baselineBudget).toBe(0);
    });

    it('defaults baselineBudget to 0 when copyFromId does not match', () => {
      const rf = makeReforecast({ baselineBudget: 500000 });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.createReforecast('New', 'nonexistent'));
      const updated = h.box.current;
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

      const sh = hook(project);
      sh.run((a) => a.switchReforecast('rf_2'));
      const switched = sh.box.current;
      expect(switched.reforecasts[0].baselineBudget).toBe(500000);
      expect(switched.reforecasts[1].baselineBudget).toBe(750000);
    });
  });

  describe('updateBaselineBudget sanitization', () => {

    it('sets a valid positive value', () => {
      const rf = makeReforecast({ baselineBudget: 0 });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateBaselineBudget(750000));
      const updated = h.box.current;
      expect(updated.reforecasts[0].baselineBudget).toBe(750000);
    });

    it('clamps NaN to 0', () => {
      const rf = makeReforecast({ baselineBudget: 500000 });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateBaselineBudget(NaN));
      const updated = h.box.current;
      expect(updated.reforecasts[0].baselineBudget).toBe(0);
    });

    it('clamps Infinity to 0', () => {
      const rf = makeReforecast({ baselineBudget: 500000 });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateBaselineBudget(Infinity));
      const updated = h.box.current;
      expect(updated.reforecasts[0].baselineBudget).toBe(0);
    });

    it('clamps -Infinity to 0', () => {
      const rf = makeReforecast({ baselineBudget: 500000 });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateBaselineBudget(-Infinity));
      const updated = h.box.current;
      expect(updated.reforecasts[0].baselineBudget).toBe(0);
    });

    it('clamps negative values to 0', () => {
      const rf = makeReforecast({ baselineBudget: 500000 });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateBaselineBudget(-1000));
      const updated = h.box.current;
      expect(updated.reforecasts[0].baselineBudget).toBe(0);
    });

    it('only updates the active reforecast', () => {
      const rf1 = makeReforecast({ id: 'rf_1', baselineBudget: 500000 });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3', baselineBudget: 750000 });
      const h = hook(makeProject({ reforecasts: [rf1, rf2], activeReforecastId: 'rf_1', }));
      h.run((a) => a.updateBaselineBudget(999000));
      const updated = h.box.current;
      expect(updated.reforecasts[0].baselineBudget).toBe(999000);
      expect(updated.reforecasts[1].baselineBudget).toBe(750000);
    });
  });

  describe('updateNotes', () => {

    it('sets notes on the active reforecast', () => {
      const rf = makeReforecast();
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateNotes('Scope expanded to include API work.'));
      const updated = h.box.current;
      expect(updated.reforecasts[0].notes).toBe('Scope expanded to include API work.');
    });

    it('truncates input over the max length', () => {
      const rf = makeReforecast();
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.updateNotes('x'.repeat(REFORECAST_NOTES_MAX_LENGTH + 500)));
      const updated = h.box.current;
      expect(updated.reforecasts[0].notes?.length).toBe(REFORECAST_NOTES_MAX_LENGTH);
    });

    it('allows empty string (clearing)', () => {
      const rf = makeReforecast({ notes: 'previous content' });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateNotes(''));
      const updated = h.box.current;
      expect(updated.reforecasts[0].notes).toBe('');
    });

    it('only updates the active reforecast', () => {
      const rf1 = makeReforecast({ id: 'rf_1', notes: 'first' });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3', notes: 'second' });
      const h = hook(makeProject({ reforecasts: [rf1, rf2], activeReforecastId: 'rf_1', }));
      h.run((a) => a.updateNotes('first — updated'));
      const updated = h.box.current;
      expect(updated.reforecasts[0].notes).toBe('first — updated');
      expect(updated.reforecasts[1].notes).toBe('second');
    });

    it('switching reforecasts preserves independent notes', () => {
      const rf1 = makeReforecast({ id: 'rf_1', notes: 'baseline context' });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3', notes: 'Q3 scope change' });
      const project = makeProject({
        reforecasts: [rf1, rf2],
        activeReforecastId: 'rf_1',
      });

      const sh = hook(project);
      sh.run((a) => a.switchReforecast('rf_2'));
      const switched = sh.box.current;
      expect(switched.reforecasts[0].notes).toBe('baseline context');
      expect(switched.reforecasts[1].notes).toBe('Q3 scope change');
    });
  });

  describe('updateName', () => {

    it('sets the name on the active reforecast (trimmed)', () => {
      const rf = makeReforecast({ name: 'Baseline' });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateName('  Q3 final  '));
      const updated = h.box.current;
      expect(updated.reforecasts[0].name).toBe('Q3 final');
    });

    it('clamps input over 50 chars', () => {
      const rf = makeReforecast({ name: 'Baseline' });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.updateName('x'.repeat(75)));
      const updated = h.box.current;
      // The literal clamped VALUE, not `.length <= 50`: a length assertion
      // passes whether the clamp is at 50 or at 30.
      expect(updated.reforecasts[0].name).toBe('x'.repeat(50));
    });

    it('rejects empty string — name unchanged', () => {
      const rf = makeReforecast({ name: 'Baseline' });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateName(''));
      const updated = h.box.current;
      expect(updated.reforecasts[0].name).toBe('Baseline');
    });

    it('rejects whitespace-only input — name unchanged', () => {
      const rf = makeReforecast({ name: 'Baseline' });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id, }));
      h.run((a) => a.updateName('   \t\n  '));
      const updated = h.box.current;
      expect(updated.reforecasts[0].name).toBe('Baseline');
    });

    it('no-op when typed value equals current name (after trim)', () => {
      const rf = makeReforecast({ name: 'Baseline' });
      const initial = makeProject({ reforecasts: [rf], activeReforecastId: rf.id });
      const h = hook(initial);
      h.run((a) => a.updateName('  Baseline  '));
      // Reference identity: the guard returns BEFORE updateActiveRf, so no new
      // project object is ever built. This is load-bearing — updateActiveRf
      // always rebuilds via .map, so an inside-the-updater guard would still
      // push an undo snapshot and a redundant save on every unchanged blur.
      expect(h.box.current).toBe(initial);
    });

    it('only updates the active reforecast', () => {
      const rf1 = makeReforecast({ id: 'rf_1', name: 'Baseline' });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q2 Reforecast' });
      const h = hook(makeProject({ reforecasts: [rf1, rf2], activeReforecastId: 'rf_2', }));
      h.run((a) => a.updateName('Q3 final'));
      const updated = h.box.current;
      expect(updated.reforecasts[0].name).toBe('Baseline');
      expect(updated.reforecasts[1].name).toBe('Q3 final');
    });
  });
});

/**
 * Operations the old file never touched at all — not simulations, simply
 * untested. onAllocationChange is the allocation grid's write path and the
 * most-exercised mutation in the app; the two timeline commits and
 * updateHistoricalCosts are the data-integrity paths behind the Timeline
 * Change dialog and the historical-costs table.
 */
describe('useReforecast — operations with no prior coverage', () => {
  describe('onAllocationChange', () => {
    it('appends a new allocation', () => {
      const rf = makeReforecast({ allocations: [] });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.onAllocationChange('a_1', '2026-08', 0.6));
      expect(h.box.current.reforecasts[0].allocations).toEqual([
        { memberId: 'a_1', month: '2026-08', allocation: 0.6 },
      ]);
    });

    it('replaces the value of an existing allocation in place', () => {
      const rf = makeReforecast();
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.onAllocationChange('a_1', '2026-06', 0.9));
      const allocs = h.box.current.reforecasts[0].allocations;
      // Order preserved and no duplicate added — the whole array asserted.
      expect(allocs).toEqual([
        { memberId: 'a_1', month: '2026-06', allocation: 0.9 },
        { memberId: 'a_1', month: '2026-07', allocation: 0.5 },
        { memberId: 'a_2', month: '2026-06', allocation: 0.4 },
      ]);
    });

    it('removes the entry when the value is 0 rather than storing a zero', () => {
      const rf = makeReforecast();
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.onAllocationChange('a_1', '2026-06', 0));
      expect(h.box.current.reforecasts[0].allocations).toEqual([
        { memberId: 'a_1', month: '2026-07', allocation: 0.5 },
        { memberId: 'a_2', month: '2026-06', allocation: 0.4 },
      ]);
    });

    it('touches the active reforecast only', () => {
      const rf1 = makeReforecast({ id: 'rf_1' });
      const rf2 = makeReforecast({ id: 'rf_2', name: 'Q3' });
      const h = hook(makeProject({ reforecasts: [rf1, rf2], activeReforecastId: 'rf_2' }));
      h.run((a) => a.onAllocationChange('a_1', '2026-06', 0));
      expect(h.box.current.reforecasts[0].allocations).toHaveLength(3);
      expect(h.box.current.reforecasts[1].allocations).toHaveLength(2);
    });
  });

  describe('timeline commits', () => {
    it('commitReforecastStartDate drops out-of-window allocations and clamps reforecastDate', () => {
      const rf = makeReforecast({ reforecastDate: '2026-06-01' });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.commitReforecastStartDate('2026-07-01', '2026-08-01'));
      const next = h.box.current.reforecasts[0];

      expect(next.startDate).toBe('2026-07-01');
      // 2026-06 allocations fall outside the new window; 2026-07 survives.
      expect(next.allocations).toEqual([
        { memberId: 'a_1', month: '2026-07', allocation: 0.5 },
      ]);
      // reforecastDate was before the new start, and the new start is not in
      // the future, so it clamps forward to the new start (not to today).
      expect(next.reforecastDate).toBe('2026-07-01');
    });

    it('commitReforecastEndDate trims the window but leaves reforecastDate alone', () => {
      const rf = makeReforecast({ reforecastDate: '2026-06-01' });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.commitReforecastEndDate('2026-06-30'));
      const next = h.box.current.reforecasts[0];

      expect(next.endDate).toBe('2026-06-30');
      expect(next.allocations).toEqual([
        { memberId: 'a_1', month: '2026-06', allocation: 0.25 },
        { memberId: 'a_2', month: '2026-06', allocation: 0.4 },
      ]);
      // Deliberately untouched: a reforecast dated after its own end is
      // permitted (you can document a December forecast for a June project).
      expect(next.reforecastDate).toBe('2026-06-01');
    });
  });

  describe('updateHistoricalCosts', () => {
    it('stores entries, then STRIPS the key when handed an empty array', () => {
      const rf = makeReforecast();
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));

      h.run((a) => a.updateHistoricalCosts([{ month: '2026-06', cost: 1000, hours: 8 }]));
      expect(h.box.current.reforecasts[0].historicalCosts).toEqual([
        { month: '2026-06', cost: 1000, hours: 8 },
      ]);

      h.run((a) => a.updateHistoricalCosts([]));
      // `in`, not `=== undefined`: the field must be ABSENT, so the optional
      // round-trips cleanly rather than serialising an empty array.
      expect('historicalCosts' in h.box.current.reforecasts[0]).toBe(false);
    });
  });

  describe('updateActualsThroughDate', () => {
    it('carries the prior bucket forward when the cutoff advances', () => {
      // The non-empty half of the B1 contract. userFlow.scenario.test.ts pins
      // the empty half (strip); this is the branch that PRESERVES the
      // previously-derived total so advancing the cutoff does not lose it.
      const rf = makeReforecast({ actualCost: 20000, actualsThroughDate: '2026-06-20' });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.updateActualsThroughDate('2026-07-20'));
      const next = h.box.current.reforecasts[0];

      expect(next.actualsThroughDate).toBe('2026-07-20');
      expect(next.historicalCosts).toEqual([{ month: '2026-06', cost: 20000, hours: 0 }]);
    });

    it('strips the cutoff entirely when cleared', () => {
      const rf = makeReforecast({ actualsThroughDate: '2026-06-20' });
      const h = hook(makeProject({ reforecasts: [rf], activeReforecastId: rf.id }));
      h.run((a) => a.updateActualsThroughDate(undefined));
      // Absent, not undefined — the optional must round-trip cleanly.
      expect('actualsThroughDate' in h.box.current.reforecasts[0]).toBe(false);
    });
  });

  describe('createReforecast baseline resolution', () => {
    it('falls back to the EARLIEST reforecast when none is named Baseline', () => {
      const later = makeReforecast({ id: 'rf_b', name: 'Beta', createdAt: '2026-03-01T00:00:00Z', startDate: '2026-03-01', endDate: '2026-03-31' });
      const earlier = makeReforecast({ id: 'rf_a', name: 'Alpha', createdAt: '2026-01-01T00:00:00Z', startDate: '2026-01-01', endDate: '2026-01-31' });
      const h = hook(makeProject({ reforecasts: [later, earlier], activeReforecastId: 'rf_b' }));
      h.run((a) => a.createReforecast('Blank'));

      // Earliest by createdAt wins — NOT array order, which is reversed here
      // on purpose so the two cannot be confused.
      expect(newest(h.box.current).startDate).toBe('2026-01-01');
      expect(newest(h.box.current).endDate).toBe('2026-01-31');
    });
  });
});
