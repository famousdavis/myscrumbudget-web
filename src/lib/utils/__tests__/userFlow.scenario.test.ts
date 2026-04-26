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
 * This test exercises the EXACT same pure functions the React hook calls,
 * with no mocking — proving (or disproving) the fix end-to-end.
 */

import { describe, it, expect } from 'vitest';
import { createNewReforecast } from '../reforecast';
import {
  buildHistoricalCostsView,
  materializeBucketOnAdvance,
} from '../historicalCostsView';
import type { Reforecast } from '@/types/domain';

describe('User workflow: March → April reforecast with cutoff advance', () => {
  it('preserves March $20k and assigns $5k delta to April', () => {
    // ── Step 1: March reforecast as it sits in the user's data ────────────
    const march: Reforecast = {
      id: 'rf-march',
      name: 'March 30 Reforecast',
      createdAt: '2026-03-30T00:00:00Z',
      startDate: '2026-03',
      reforecastDate: '2026-03-30',
      allocations: [],          // user's project has allocations; not relevant here
      productivityWindows: [],
      actualCost: 20000,
      baselineBudget: 65000,
      actualsThroughDate: '2026-03-28',
      // historicalCosts is undefined — March was the cutoff bucket; nothing stored
    };

    // Project starts in March (matches the screenshots)
    const projectStartDate = '2026-03-01';

    // ── Step 2: Create April reforecast by copying from March ────────────
    let april = createNewReforecast('April 6 Reforecast', projectStartDate, march);

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
      startDate: '2026-03',
      reforecastDate: '2026-03-30',
      allocations: [],
      productivityWindows: [],
      actualCost: 20000,
      baselineBudget: 65000,
      actualsThroughDate: '2026-03-28',
    };
    const projectStartDate = '2026-03-01';

    let april = createNewReforecast('April', projectStartDate, march);

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
