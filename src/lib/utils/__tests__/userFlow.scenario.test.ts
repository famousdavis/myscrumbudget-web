// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * End-to-end simulation of the user's reported workflow:
 *
 *   1. Have a March reforecast: actualCost=$20k, cutoff=Mar 28, no breakdown
 *   2. Create April reforecast by copying from March
 *   3. Change cutoff to Apr 4
 *   4. Bump actualCost to $25k
 *
 * Expected end state:
 *   - Mar = $20,000 (editable, stored)
 *   - Apr bucket = $5,000 (read-only)
 *   - Total = $25,000
 *
 * The workflow block below exercises the EXACT same pure functions the React
 * hook calls, with no mocking — proving (or disproving) the fix end-to-end.
 *
 * That was also the stated justification for re-implementing the hook's own
 * decision branch in the B1 block further down. It no longer applies there:
 * those tests now render the real `useReforecast`. Calling the same pure
 * functions is not the same as calling the code that calls them.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createNewReforecast } from '../reforecast';
import { useReforecast } from '@/features/reforecast/hooks/useReforecast';
import {
  buildHistoricalCostsView,
  materializeBucketOnAdvance,
} from '../historicalCostsView';
import type { Project, Reforecast } from '@/types/domain';

describe('User workflow: March → April reforecast with cutoff advance', () => {
  it('preserves March $20k and assigns $5k delta to April', () => {
    // ── Step 1: March reforecast as it sits in the user's data ────────────
    const march: Reforecast = {
      id: 'rf-march',
      name: 'March 30 Reforecast',
      createdAt: '2026-03-30T00:00:00Z',
      startDate: '2026-03-01',
      endDate: '2026-12-31',
      reforecastDate: '2026-03-30',
      allocations: [],          // user's project has allocations; not relevant here
      assignments: [],
      productivityWindows: [],
      actualCost: 20000,
      baselineBudget: 65000,
      actualsThroughDate: '2026-03-28',
      // historicalCosts is undefined — March was the cutoff bucket; nothing stored
    };

    // Project starts in March (matches the screenshots)
    const projectStartDate = '2026-03-01';

    // ── Step 2: Create April reforecast by copying from March ────────────
    let april = createNewReforecast('April 6 Reforecast', { startDate: projectStartDate, endDate: '2026-12-31' }, march);

    console.log('After copy:', JSON.stringify(april.historicalCosts));
    console.log('  actualCost:', april.actualCost, 'cutoff:', april.actualsThroughDate);

    // Sanity check: copy should have materialized March's $20k bucket
    expect(april.historicalCosts).toEqual([
      { month: '2026-03', cost: 20000, hours: 0 },
    ]);
    expect(april.actualCost).toBe(20000);
    expect(april.actualsThroughDate).toBe('2026-03-28');

    // ── Step 3: User changes "actuals through" to Apr 4 ───────────────────
    // (Hook calls materializeBucketOnAdvance, then writes new cutoff)
    const newHistorical = materializeBucketOnAdvance(
      april.historicalCosts,
      april.actualCost,
      april.actualsThroughDate,
      '2026-04-04',
    );
    april = {
      ...april,
      actualsThroughDate: '2026-04-04',
      ...(newHistorical.length > 0 ? { historicalCosts: newHistorical } : {}),
    };

    console.log('After cutoff advance:', JSON.stringify(april.historicalCosts));

    // Sanity: snapshot preserved (Mar already had entry → not overwritten)
    expect(april.historicalCosts).toEqual([
      { month: '2026-03', cost: 20000, hours: 0 },
    ]);
    expect(april.actualsThroughDate).toBe('2026-04-04');

    // ── Step 4: User bumps actualCost to $25,000 ─────────────────────────
    april = { ...april, actualCost: 25000 };

    console.log('After actualCost bump: actualCost =', april.actualCost);

    // ── Step 5: Build the display rows the table will render ─────────────
    const rows = buildHistoricalCostsView(
      april.historicalCosts,
      april.actualCost,
      april.actualsThroughDate,
      projectStartDate,
    );

    console.log('Display rows:', JSON.stringify(rows, null, 2));

    // ── ASSERTIONS: The user's expectation ───────────────────────────────
    expect(rows).toHaveLength(2);
    // March: editable, $20k preserved
    expect(rows[0]).toEqual({
      month: '2026-03',
      cost: 20000,
      hours: 0,
      isCutoffBucket: false,
    });
    // April: read-only bucket, $5k delta
    expect(rows[1]).toEqual({
      month: '2026-04',
      cost: 5000,
      hours: 0,
      isCutoffBucket: true,
    });
    // Total reads from actualCost in the footer
    expect(april.actualCost).toBe(25000);
  });

  it('reverse order (bump actualCost FIRST, then advance cutoff): Mar captures the bumped value at advance time', () => {
    // When the user bumps actualCost while the cutoff is still in March,
    // they're stating "my actuals through Mar 28 are now $25k." The advance
    // should capture that updated $25k as Mar's stored value. Then a
    // SUBSEQUENT bump after the advance flows into the new Apr bucket.
    const march: Reforecast = {
      id: 'rf-march',
      name: 'March',
      createdAt: '2026-03-30T00:00:00Z',
      startDate: '2026-03-01',
      endDate: '2026-12-31',
      reforecastDate: '2026-03-30',
      allocations: [],
      assignments: [],
      productivityWindows: [],
      actualCost: 20000,
      baselineBudget: 65000,
      actualsThroughDate: '2026-03-28',
    };
    const projectStartDate = '2026-03-01';

    let april = createNewReforecast('April', { startDate: projectStartDate, endDate: '2026-12-31' }, march);

    // Bump actualCost while cutoff is still Mar 28 → user is restating Mar's actuals
    april = { ...april, actualCost: 25000 };

    // Then advance cutoff → captures the CURRENT effective Mar bucket ($25k)
    const newHistorical = materializeBucketOnAdvance(
      april.historicalCosts,
      april.actualCost,
      april.actualsThroughDate,
      '2026-04-04',
    );
    april = {
      ...april,
      actualsThroughDate: '2026-04-04',
      ...(newHistorical.length > 0 ? { historicalCosts: newHistorical } : {}),
    };

    let rows = buildHistoricalCostsView(
      april.historicalCosts,
      april.actualCost,
      april.actualsThroughDate,
      projectStartDate,
    );

    // March = $25k (bumped value, captured at advance time)
    expect(rows[0]).toMatchObject({ month: '2026-03', cost: 25000, isCutoffBucket: false });
    // April bucket = $0 (no delta yet — actualCost unchanged since advance)
    expect(rows[1]).toMatchObject({ month: '2026-04', cost: 0, isCutoffBucket: true });

    // Now bump actualCost to $30k → the $5k delta goes to Apr (the new bucket)
    april = { ...april, actualCost: 30000 };
    rows = buildHistoricalCostsView(
      april.historicalCosts,
      april.actualCost,
      april.actualsThroughDate,
      projectStartDate,
    );
    expect(rows[0]).toMatchObject({ month: '2026-03', cost: 25000, isCutoffBucket: false });
    expect(rows[1]).toMatchObject({ month: '2026-04', cost: 5000, isCutoffBucket: true });
  });
});

/**
 * B1 regression coverage — these scenarios pin the contract that
 * `useReforecast.updateActualsThroughDate` implements when
 * `materializeBucketOnAdvance` returns an empty array: the hook treats the
 * return as authoritative — if non-empty, set; if empty AND a stale field
 * exists, strip it via `delete`.
 *
 * These now drive the REAL hook. They previously called a local
 * `applyCutoffAdvance` that re-implemented the hook's three-line decision
 * branch, which meant a test file headed "B1 regression coverage" pinned a
 * named, shipped regression against a copy of the code that regressed —
 * the hook could have lost the `delete` and every test here would still pass.
 */
function advanceCutoff(rf: Reforecast, newCutoff: string): Reforecast {
  const project: Project = {
    id: 'p_b1',
    name: 'B1',
    startDate: rf.startDate,
    endDate: rf.endDate,
    reforecasts: [rf],
    activeReforecastId: rf.id,
  };
  const box = { current: project };
  const view = renderHook(() =>
    useReforecast({
      project: box.current,
      updateProject: (u) => {
        box.current = u(box.current);
      },
    }),
  );
  act(() => {
    view.result.current.updateActualsThroughDate(newCutoff);
  });
  return box.current.reforecasts[0];
}

describe('B1 regression: stale historicalCosts after cutoff advance', () => {
  const projectStartDate = '2026-03-01';

  it('strips historicalCosts when prior bucket is 0 and only that stale entry was stored', () => {
    // Setup: a reforecast with only the cutoff-bucket entry stored (typical
    // post-materialization state), then the user reduces actualCost to 0 so
    // the bucket evaluates to 0 on the next advance.
    const rf: Reforecast = {
      id: 'rf-edge',
      name: 'Edge case',
      createdAt: '2026-03-15T00:00:00Z',
      startDate: '2026-03-01',
      endDate: '2026-12-31',
      reforecastDate: '2026-03-15',
      allocations: [],
      assignments: [],
      productivityWindows: [],
      actualCost: 0,
      baselineBudget: 0,
      actualsThroughDate: '2026-03-15',
      historicalCosts: [{ month: '2026-03', cost: 50000, hours: 0 }],
    };

    // Confirm the trigger condition: materialize returns []
    const nextHistorical = materializeBucketOnAdvance(
      rf.historicalCosts,
      rf.actualCost,
      rf.actualsThroughDate,
      '2026-04-15',
      projectStartDate,
    );
    expect(nextHistorical).toEqual([]);

    // Apply the hook's update logic. The stale field MUST be deleted, not
    // inherited via spread. Use 'in' check (not undefined check) to prove
    // the key is actually absent.
    const next = advanceCutoff(rf, '2026-04-15');
    expect('historicalCosts' in next).toBe(false);
    expect(next.actualsThroughDate).toBe('2026-04-15');
  });

  it('does not introduce a phantom historicalCosts key when none existed before', () => {
    // Setup: a fresh reforecast with no historicalCosts at all (the common
    // case before any materialization has ever happened).
    const rf: Reforecast = {
      id: 'rf-fresh',
      name: 'Fresh',
      createdAt: '2026-03-15T00:00:00Z',
      startDate: '2026-03-01',
      endDate: '2026-12-31',
      reforecastDate: '2026-03-15',
      allocations: [],
      assignments: [],
      productivityWindows: [],
      actualCost: 0,
      baselineBudget: 0,
      actualsThroughDate: '2026-03-15',
    };
    expect('historicalCosts' in rf).toBe(false);

    // Advance the cutoff. materialize returns [] (nothing to preserve), and
    // the hook's else-if guard MUST short-circuit — `delete` should not run
    // on a key that was never present.
    const next = advanceCutoff(rf, '2026-04-15');
    expect('historicalCosts' in next).toBe(false);
    expect(next.actualsThroughDate).toBe('2026-04-15');
  });
});
