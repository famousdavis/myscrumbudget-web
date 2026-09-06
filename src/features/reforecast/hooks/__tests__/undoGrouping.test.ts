// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/*
 * v0.37.24 (WI-5c) — a multi-cell gesture costs ONE undo entry.
 *
 * ⚠️ WHY THIS FILE EXISTS AND WHERE IT SITS. The four AllocationGrid component
 * test files spy `onAllocationChange`/`onAllocationsChange` with bare vi.fn()s
 * and have NO undo stack, so "one Ctrl+Z reverts all three cells" is not
 * observable there - asserting "called once" is a PROXY for the semantics, not
 * the semantics. This host composes the REAL useProject (real reducer, real
 * bounded undo stack, real localStorage repository) with the REAL useReforecast,
 * so the undo assertions here are the property itself.
 *
 * ⚠️ WHAT THIS FILE CANNOT PROVE: that the GRID calls the batch. Nothing here
 * renders AllocationGrid. The wiring is pinned in
 * components/__tests__/AllocationGridPointer.test.tsx (fill) and
 * hooks/__tests__/useGridKeyboard.test.ts (Delete). Both levels are required
 * and neither substitutes for the other.
 *
 * ⚠️ TWO PRECONDITIONS THAT MAKE THE DIFFERENCE BETWEEN A TEST AND A GREEN
 * NO-OP, both learned by measurement rather than reading:
 *   1. `await waitFor(loading === false)` before ANY write. `project` starts
 *      null and updateProject early-returns on null, so a write before load is
 *      a silent no-op that reads as a pass.
 *   2. `await flush()` before reading persisted bytes. useProject persists
 *      through useDebouncedSave (500 ms), so immediately after act() the stored
 *      allocations are `[]`. Measured here: beforeFlush=[], afterFlush=[{...}].
 *      A byte assertion without the flush fails against a CORRECT build.
 *
 * ⚠️ ONE SHARED REPOSITORY INSTANCE, following useProject.test.ts:13-20: two
 * instances read the same localStorage and so look equivalent, but a spy on one
 * never sees calls made on the other.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProject } from '@/features/projects/hooks/useProject';
import { useReforecast } from '../useReforecast';
import { UNDO_STACK_LIMIT } from '@/lib/constants';
import type { Project, MonthlyAllocation } from '@/types/domain';

const { repo } = await vi.hoisted(async () => {
  const { createLocalStorageRepository } = await import('@/lib/storage/localStorage');
  return { repo: createLocalStorageRepository() };
});
vi.mock('@/components/RepositoryProvider', () => {
  const value = { repository: repo, mode: 'local' as const, isCloud: false, switchMode: vi.fn() };
  return { useRepository: () => value };
});

function makeProject(): Project {
  return {
    id: 'p-undo-group',
    name: 'Undo grouping',
    startDate: '2026-01-01',
    endDate: '2028-12-31',
    reforecasts: [
      {
        id: 'rf-1',
        name: 'Baseline',
        createdAt: '2026-01-01T00:00:00Z',
        startDate: '2026-01-01',
        endDate: '2028-12-31',
        reforecastDate: '2026-01-01',
        assignments: [],
        allocations: [],
        productivityWindows: [],
        actualCost: 0,
        baselineBudget: 100000,
      },
    ],
    activeReforecastId: 'rf-1',
  };
}

/** The real useProject + the real useReforecast, composed as the page composes them. */
function useComposed() {
  const p = useProject('p-undo-group');
  const rf = useReforecast({ project: p.project, updateProject: p.updateProject });
  return { ...p, ...rf };
}

async function loadComposed() {
  const hook = renderHook(() => useComposed());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

async function storedAllocations(): Promise<MonthlyAllocation[]> {
  const p = await repo.getProject('p-undo-group');
  return p!.reforecasts[0].allocations;
}

/** Sorted, so an assertion is about CONTENT and not about array order. */
function sortedBytes(a: MonthlyAllocation[]): string {
  return JSON.stringify(
    [...a].sort((x, y) => `${x.memberId}${x.month}`.localeCompare(`${y.memberId}${y.month}`)),
  );
}

const FILL_3 = [
  { memberId: 'tm-a', month: '2026-01', value: 0.5 },
  { memberId: 'tm-a', month: '2026-02', value: 0.5 },
  { memberId: 'tm-a', month: '2026-03', value: 0.5 },
];

describe('v0.37.24 — a multi-cell gesture is ONE undo entry', () => {
  beforeEach(async () => {
    await repo.clear();
    await repo.saveProject(makeProject());
  });

  /*
   * ⚠️ SELF-CHECK, AND IT RUNS FIRST ON PURPOSE (the v0.36.5 discipline).
   * A host that silently fails to wire produces "1 undo entry" for a fill too,
   * and that reads as a pass. Read this test's result before believing any
   * number below it.
   */
  it('[SELF-CHECK] one single-cell write = exactly 1 undo entry AND a real byte change after flush()', async () => {
    const { result } = await loadComposed();

    expect(await storedAllocations(), 'precondition: nothing stored yet').toEqual([]);
    expect(result.current.canUndo, 'precondition: nothing undoable yet').toBe(false);

    await act(async () => {
      result.current.onAllocationChange('tm-a', '2026-01', 0.5);
    });

    // Both sides of the debounce, so the flush is evidence rather than ritual.
    expect(await storedAllocations(), 'BEFORE flush the write is still debounced').toEqual([]);
    await act(async () => {
      await result.current.flush();
    });
    expect(await storedAllocations(), 'AFTER flush the bytes really changed').toEqual([
      { memberId: 'tm-a', month: '2026-01', allocation: 0.5 },
    ]);

    expect(result.current.canUndo, 'the write pushed an entry').toBe(true);
    await act(async () => {
      result.current.undo();
    });
    expect(result.current.canUndo, 'it pushed exactly ONE entry').toBe(false);
    expect(await storedAllocations(), 'and undo restored the pre-write bytes').toEqual([]);
  });

  it('[CRITERION 1] a 3-cell fill is undone by ONE press, back to the pre-fill bytes', async () => {
    const { result } = await loadComposed();
    await act(async () => {
      result.current.onAllocationChange('tm-z', '2026-06', 0.25);
    });
    await act(async () => {
      await result.current.flush();
    });
    const preFill = sortedBytes(await storedAllocations());
    expect(preFill.length, 'gate: the pre-fill snapshot is non-empty').toBeGreaterThan(20);

    await act(async () => {
      result.current.onAllocationsChange(FILL_3);
    });
    await act(async () => {
      await result.current.flush();
    });
    // PRECONDITION: a fill that silently wrote nothing would also be undone by
    // one press. Assert the write happened before asserting how it is undone.
    expect(await storedAllocations(), 'precondition: the fill really wrote 3 cells').toHaveLength(4);

    await act(async () => {
      result.current.undo();
    });
    expect(sortedBytes(await storedAllocations()), 'ONE undo reverted all three cells').toBe(preFill);
  });

  it('[CRITERION 2] a 3-cell range Delete is undone by ONE press', async () => {
    const { result } = await loadComposed();
    await act(async () => {
      result.current.onAllocationsChange(FILL_3);
    });
    await act(async () => {
      await result.current.flush();
    });
    const preDelete = sortedBytes(await storedAllocations());
    expect(await storedAllocations(), 'precondition: 3 cells to clear').toHaveLength(3);

    await act(async () => {
      result.current.onAllocationsChange(FILL_3.map((c) => ({ ...c, value: 0 })));
    });
    await act(async () => {
      await result.current.flush();
    });
    expect(await storedAllocations(), 'precondition: the Delete really cleared them').toHaveLength(0);

    await act(async () => {
      result.current.undo();
    });
    expect(sortedBytes(await storedAllocations()), 'ONE undo restored all three').toBe(preDelete);
  });

  /*
   * ⚠️ [CRITERION 3a] passes at HEAD by construction (an empty batch cannot
   * exist there), so on its own it is not evidence. It is evidence PAIRED with
   * criteria 1 and 2: they force the batch to exist, and this refuses the
   * obvious implementation of it. Removing `if (changes.length === 0) return;`
   * fails exactly this test.
   */
  it('[CRITERION 3a] an EMPTY batch pushes no undo entry — no phantom press', async () => {
    const { result } = await loadComposed();
    await act(async () => {
      result.current.onAllocationChange('tm-a', '2026-01', 0.5);
    });
    await act(async () => {
      await result.current.flush();
    });
    const bytes = sortedBytes(await storedAllocations());
    expect(result.current.canUndo, 'precondition: exactly one entry on the stack').toBe(true);

    await act(async () => {
      result.current.onAllocationsChange([]);
    });

    // If the empty batch pushed, this first undo would consume the phantom and
    // leave canUndo true with the bytes unchanged - the exact user-visible
    // symptom: press Ctrl+Z, see nothing happen.
    await act(async () => {
      result.current.undo();
    });
    expect(result.current.canUndo, 'the empty batch must not have pushed an entry').toBe(false);
    expect(sortedBytes(await storedAllocations()), 'and one press undid the REAL edit').not.toBe(bytes);
  });

  it('[CRITERION 4, REGRESSION] a single editor commit still costs exactly one undo entry', async () => {
    const { result } = await loadComposed();
    await act(async () => {
      result.current.onAllocationChange('tm-a', '2026-01', 0.75);
    });
    await act(async () => {
      await result.current.flush();
    });
    expect(await storedAllocations(), 'precondition: the commit wrote').toHaveLength(1);

    let undos = 0;
    while (result.current.canUndo && undos < 10) {
      await act(async () => {
        result.current.undo();
      });
      undos++;
    }
    expect(undos, 'the single-cell path is untouched by the batch').toBe(1);
  });

  /*
   * ⚠️ [CRITERION 6] IS THE ONLY TEST THAT MEASURES THE HARM THIS RELEASE EXISTS
   * FOR, and it needs 50 cells, not 25. Criteria 1 and 2 pass under ANY grouping
   * implementation, including one that pushes two content-identical snapshots.
   *
   * UNDO_STACK_LIMIT is 50 and pushBounded slices from the FRONT. At HEAD, three
   * edits followed by a 2-row x 25-month fill pushed 3 + 50 = 53 entries, the
   * first 3 were evicted, and the state before the first edit became
   * unreachable at any depth - measured at v0.37.23: 50 undos exhausted the
   * stack with 3 allocations still stored.
   *
   * ⚠️ At 25 cells nothing is evicted (3 + 25 = 28 < 50) and this test would be
   * TRUE AT HEAD. Do not "simplify" the fixture.
   *
   * ⚠️ The claim asserted is the true, weaker one: the three edits CANNOT BE
   * UNDONE. The stronger "the three edits are unreachable at any depth" is
   * false - the pre-fill state (after the third edit) IS reachable at depth 50.
   */
  it('[CRITERION 6] three edits survive a 50-cell fill: 4 undos reach the pristine state, and the stack is then empty', async () => {
    const { result } = await loadComposed();

    await act(async () => {
      result.current.onAllocationChange('tm-keep', '2026-01', 0.1);
    });
    await act(async () => {
      result.current.onAllocationChange('tm-keep', '2026-02', 0.2);
    });
    await act(async () => {
      result.current.onAllocationChange('tm-keep', '2026-03', 0.3);
    });
    await act(async () => {
      await result.current.flush();
    });
    expect(await storedAllocations(), 'precondition: three real edits landed').toHaveLength(3);

    // 2 rows x 25 months = 50 cells — §1's own example, and the size at which
    // the per-cell implementation caps the stack.
    const bigFill: { memberId: string; month: string; value: number }[] = [];
    for (let c = 0; c < 25; c++) {
      for (let r = 0; r < 2; r++) {
        bigFill.push({
          memberId: `tm-fill-${r}`,
          month: `2027-${String(c + 1).padStart(2, '0')}`,
          value: 0.75,
        });
      }
    }
    expect(bigFill.length, 'the fill must exceed UNDO_STACK_LIMIT to measure eviction')
      .toBeGreaterThan(UNDO_STACK_LIMIT - 3);

    await act(async () => {
      result.current.onAllocationsChange(bigFill);
    });
    await act(async () => {
      await result.current.flush();
    });
    expect(await storedAllocations(), 'precondition: 3 edits + 50 filled cells all written').toHaveLength(53);

    // 4 undos: one for the fill, three for the edits -> the pristine state.
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        result.current.undo();
      });
    }
    await act(async () => {
      await result.current.flush();
    });
    expect(await storedAllocations(), 'the three edits ARE undoable — nothing was evicted').toHaveLength(0);
    expect(result.current.canUndo, 'and the stack held exactly those 4 entries').toBe(false);
  });

  /*
   * ⚠️ [CRITERION 7b] cannot run at HEAD — onAllocationsChange does not exist
   * there, so it fails with `TypeError: not a function`, an uninformative red.
   * It is [FALSIFY-AFTER], verified by breaking the finished build, and is
   * DELIBERATELY NOT collapsed with 7a in useProject.test.ts, which runs and
   * passes at HEAD and is therefore [REGRESSION].
   *
   * ⚠️ THE THROW IS DRIVEN FROM A GETTER ON THE CALLER'S ARRAY, because nothing
   * inside the updater can throw: applyAllocation is pure filter/map/spread and
   * throws for no input shape. Change 1 folds into the accumulator, the getter
   * on change 2 throws, updateProject's `updater(prev)` never returns — so the
   * snapshot push and projectRef assignment below it never run.
   *
   * ⚠️ This is NOT the mechanism that closes v0.37.14's partial write. That one
   * threw at `teamMembers[cells[i].row].id`, which under the batch is in the
   * array-building loop OUTSIDE the updater — the throw happens before
   * onAllocationsChange is ever called. Both are closed; by different means.
   */
  it('[CRITERION 7b] a throw mid-batch writes nothing and pushes nothing', async () => {
    const { result } = await loadComposed();
    await act(async () => {
      result.current.onAllocationChange('tm-a', '2026-01', 0.5);
    });
    await act(async () => {
      await result.current.flush();
    });
    const before = sortedBytes(await storedAllocations());
    expect(before.length, 'gate: the baseline is non-empty').toBeGreaterThan(20);

    const poisoned = [
      { memberId: 'tm-b', month: '2026-02', value: 0.5 },
      {
        get memberId(): string {
          throw new Error('mid-batch failure');
        },
        month: '2026-03',
        value: 0.5,
      },
    ] as { memberId: string; month: string; value: number }[];

    expect(() => {
      result.current.onAllocationsChange(poisoned);
    }, 'the throw propagates rather than being swallowed').toThrow('mid-batch failure');

    await act(async () => {
      await result.current.flush();
    });
    expect(sortedBytes(await storedAllocations()), 'NOTHING was written — not even the first change').toBe(before);

    await act(async () => {
      result.current.undo();
    });
    expect(result.current.canUndo, 'and NOTHING was pushed — one undo still empties the stack').toBe(false);
    expect(await storedAllocations(), 'that one undo reached the pre-edit state').toEqual([]);
  });
});
