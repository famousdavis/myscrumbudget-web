// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import {
  buildHistoricalCostsView,
  commitHistoricalCostEdit,
  materializeBucketOnAdvance,
  sumEarlierEntries,
} from '../historicalCostsView';
import type { HistoricalCostEntry } from '@/types/domain';

describe('buildHistoricalCostsView', () => {
  it('returns [] when actualsThroughDate is absent', () => {
    const result = buildHistoricalCostsView([], 50000, undefined, '2026-01-15');
    expect(result).toEqual([]);
  });

  it('returns [] when actualsThroughDate is empty string', () => {
    const result = buildHistoricalCostsView([], 50000, '', '2026-01-15');
    expect(result).toEqual([]);
  });

  it('with no stored entries, project Jan 2026, cutoff Mar 2026 → 3 rows (Jan $0, Feb $0, Mar $50k bucket)', () => {
    const result = buildHistoricalCostsView(undefined, 50000, '2026-03-15', '2026-01-15');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ month: '2026-01', cost: 0, hours: 0, isCutoffBucket: false });
    expect(result[1]).toEqual({ month: '2026-02', cost: 0, hours: 0, isCutoffBucket: false });
    expect(result[2]).toEqual({ month: '2026-03', cost: 50000, hours: 0, isCutoffBucket: true });
  });

  it('with one stored entry (Feb $20k) and actualCost $50k → Jan $0, Feb $20k, Mar $30k bucket', () => {
    const entries: HistoricalCostEntry[] = [
      { month: '2026-02', cost: 20000, hours: 0 },
    ];
    const result = buildHistoricalCostsView(entries, 50000, '2026-03-15', '2026-01-15');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ month: '2026-01', cost: 0, hours: 0, isCutoffBucket: false });
    expect(result[1]).toEqual({ month: '2026-02', cost: 20000, hours: 0, isCutoffBucket: false });
    expect(result[2]).toEqual({ month: '2026-03', cost: 30000, hours: 0, isCutoffBucket: true });
  });

  it('over-allocation (stored sums to $60k, actualCost $50k) → cutoff row clamped to 0', () => {
    const entries: HistoricalCostEntry[] = [
      { month: '2026-01', cost: 30000, hours: 0 },
      { month: '2026-02', cost: 30000, hours: 0 },
    ];
    const result = buildHistoricalCostsView(entries, 50000, '2026-03-15', '2026-01-15');
    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({ month: '2026-03', cost: 0, hours: 0, isCutoffBucket: true });
  });

  it('cutoff row always has isCutoffBucket: true; all other rows false', () => {
    const entries: HistoricalCostEntry[] = [
      { month: '2026-02', cost: 5000, hours: 0 },
    ];
    const result = buildHistoricalCostsView(entries, 50000, '2026-04-15', '2026-01-15');
    expect(result.filter((r) => r.isCutoffBucket)).toHaveLength(1);
    expect(result[result.length - 1].isCutoffBucket).toBe(true);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].isCutoffBucket).toBe(false);
    }
  });

  it('result is sorted ascending by month', () => {
    const entries: HistoricalCostEntry[] = [
      { month: '2026-04', cost: 1000, hours: 0 },
      { month: '2026-02', cost: 2000, hours: 0 },
      { month: '2026-03', cost: 3000, hours: 0 },
    ];
    const result = buildHistoricalCostsView(entries, 20000, '2026-06-30', '2026-01-15');
    const months = result.map((r) => r.month);
    expect(months).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
  });

  it('preserves hours from stored entries on non-cutoff rows', () => {
    const entries: HistoricalCostEntry[] = [
      { month: '2026-02', cost: 10000, hours: 80 },
    ];
    const result = buildHistoricalCostsView(entries, 30000, '2026-03-15', '2026-01-15');
    expect(result[1].hours).toBe(80);
    expect(result[2].hours).toBe(0); // cutoff bucket hours always 0 in v0.22.0
  });

  it('ignores stored entries at or after the cutoff month (defensive)', () => {
    // Entries at/after cutoff shouldn't exist by construction; if they do,
    // they're ignored and the cutoff bucket reflects actualCost only.
    const entries: HistoricalCostEntry[] = [
      { month: '2026-03', cost: 99999, hours: 0 }, // at cutoff — ignored
      { month: '2026-04', cost: 99999, hours: 0 }, // after cutoff — ignored
    ];
    const result = buildHistoricalCostsView(entries, 50000, '2026-03-15', '2026-01-15');
    expect(result[2]).toEqual({ month: '2026-03', cost: 50000, hours: 0, isCutoffBucket: true });
  });

  it('cutoff before project start → only the cutoff-bucket row', () => {
    // Edge case: project starts after the cutoff. Range collapses to just cutoff.
    const result = buildHistoricalCostsView(undefined, 50000, '2025-12-15', '2026-01-15');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ month: '2025-12', cost: 50000, hours: 0, isCutoffBucket: true });
  });

  it('cutoff equals project start month → single cutoff-bucket row', () => {
    const result = buildHistoricalCostsView(undefined, 50000, '2026-01-31', '2026-01-15');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ month: '2026-01', cost: 50000, hours: 0, isCutoffBucket: true });
  });
});

describe('materializeBucketOnAdvance', () => {
  it('returns input unchanged when prev cutoff is undefined', () => {
    const stored: HistoricalCostEntry[] = [{ month: '2026-01', cost: 1000, hours: 0 }];
    const result = materializeBucketOnAdvance(stored, 50000, undefined, '2026-04-15');
    expect(result).toEqual(stored);
  });

  it('returns input unchanged when new month equals prev month', () => {
    const stored: HistoricalCostEntry[] = [{ month: '2026-01', cost: 1000, hours: 0 }];
    // Same month, different day
    const result = materializeBucketOnAdvance(stored, 50000, '2026-03-10', '2026-03-25');
    expect(result).toEqual(stored);
  });

  it('returns input unchanged when new month is BEFORE prev month (backward correction)', () => {
    const stored: HistoricalCostEntry[] = [{ month: '2026-01', cost: 1000, hours: 0 }];
    const result = materializeBucketOnAdvance(stored, 50000, '2026-04-15', '2026-02-15');
    expect(result).toEqual(stored);
  });

  it('materializes prior bucket value when advancing cutoff to a later month', () => {
    // Reproduces the user-reported scenario:
    //   prev: cutoff Mar 28, actualCost $20k, no stored entries → bucket Mar = $20k
    //   advance to Apr 4 → Mar should be stored as $20k
    const result = materializeBucketOnAdvance(undefined, 20000, '2026-03-28', '2026-04-04');
    expect(result).toEqual([{ month: '2026-03', cost: 20000, hours: 0 }]);
  });

  it('does not materialize when prior bucket value is 0 (actualCost == sum of earlier)', () => {
    const stored: HistoricalCostEntry[] = [
      { month: '2026-01', cost: 30000, hours: 0 },
      { month: '2026-02', cost: 20000, hours: 0 },
    ];
    // earlierSum (before March) = 50000; actualCost = 50000 → bucket = 0 → skip
    const result = materializeBucketOnAdvance(stored, 50000, '2026-03-15', '2026-04-15');
    expect(result).toEqual(stored);
  });

  it('overwrites a stale prev-cutoff-month entry with the current effective bucket value', () => {
    // The stored {Mar: $20k} entry can only come from a prior materialization
    // (the cutoff row is never user-editable). Since actualCost has since
    // moved to $25k, the current effective Mar bucket is $25k. The advance
    // must capture $25k, not preserve the stale $20k snapshot.
    const stored: HistoricalCostEntry[] = [{ month: '2026-03', cost: 20000, hours: 0 }];
    const result = materializeBucketOnAdvance(stored, 25000, '2026-03-28', '2026-04-04');
    expect(result).toEqual([{ month: '2026-03', cost: 25000, hours: 0 }]);
  });

  it('preserves existing entries when materializing the prior bucket', () => {
    const stored: HistoricalCostEntry[] = [
      { month: '2026-01', cost: 10000, hours: 0 },
      { month: '2026-02', cost: 15000, hours: 0 },
    ];
    const result = materializeBucketOnAdvance(stored, 50000, '2026-03-15', '2026-04-15');
    // Bucket = 50000 - (10000 + 15000) = 25000 → append Mar entry, keep Jan/Feb
    expect(result).toHaveLength(3);
    expect(result).toEqual(
      expect.arrayContaining([
        { month: '2026-01', cost: 10000, hours: 0 },
        { month: '2026-02', cost: 15000, hours: 0 },
        { month: '2026-03', cost: 25000, hours: 0 },
      ]),
    );
  });
});

describe('sumEarlierEntries', () => {
  it('returns 0 for undefined entries', () => {
    expect(sumEarlierEntries(undefined, '2026-03')).toBe(0);
  });

  it('returns 0 for empty entries', () => {
    expect(sumEarlierEntries([], '2026-03')).toBe(0);
  });

  it('sums only entries strictly before the cutoff month', () => {
    const entries: HistoricalCostEntry[] = [
      { month: '2026-01', cost: 10000, hours: 0 },
      { month: '2026-02', cost: 20000, hours: 0 },
      { month: '2026-03', cost: 99999, hours: 0 }, // at cutoff — excluded
      { month: '2026-04', cost: 99999, hours: 0 }, // after — excluded
    ];
    expect(sumEarlierEntries(entries, '2026-03')).toBe(30000);
  });
});

describe('commitHistoricalCostEdit', () => {
  const cutoffMonth = '2026-04';
  const actualCost = 50000;

  it('happy path: typed value within ceiling → upserts and reports no clamping', () => {
    const stored: HistoricalCostEntry[] = [
      { month: '2026-02', cost: 10000, hours: 0 },
    ];
    const result = commitHistoricalCostEdit(stored, '2026-03', '15000', actualCost, cutoffMonth);
    expect(result.cappedAt).toBeNull();
    expect(result.next).toEqual([
      { month: '2026-02', cost: 10000, hours: 0 },
      { month: '2026-03', cost: 15000, hours: 0 },
    ]);
  });

  it('over-allocation: typed value exceeds ceiling → clamps to ceiling and reports cap', () => {
    // Ceiling = actualCost (50k) − sum(other earlier entries) = 50k − 20k = 30k
    const stored: HistoricalCostEntry[] = [
      { month: '2026-02', cost: 20000, hours: 0 },
    ];
    const result = commitHistoricalCostEdit(stored, '2026-03', '40000', actualCost, cutoffMonth);
    expect(result.cappedAt).toBe(30000);
    expect(result.next).toEqual([
      { month: '2026-02', cost: 20000, hours: 0 },
      { month: '2026-03', cost: 30000, hours: 0 },
    ]);
  });

  it('zero entry on existing row → removes the entry', () => {
    const stored: HistoricalCostEntry[] = [
      { month: '2026-02', cost: 10000, hours: 0 },
      { month: '2026-03', cost: 5000, hours: 0 },
    ];
    const result = commitHistoricalCostEdit(stored, '2026-03', '0', actualCost, cutoffMonth);
    expect(result.cappedAt).toBeNull();
    expect(result.next).toEqual([{ month: '2026-02', cost: 10000, hours: 0 }]);
  });

  it('zero entry on absent row → no-op (next is null)', () => {
    const stored: HistoricalCostEntry[] = [
      { month: '2026-02', cost: 10000, hours: 0 },
    ];
    const result = commitHistoricalCostEdit(stored, '2026-03', '0', actualCost, cutoffMonth);
    expect(result.cappedAt).toBeNull();
    expect(result.next).toBeNull();
  });

  it('typed value equals existing → no-op (next is null)', () => {
    const stored: HistoricalCostEntry[] = [
      { month: '2026-03', cost: 7500, hours: 0 },
    ];
    const result = commitHistoricalCostEdit(stored, '2026-03', '7500', actualCost, cutoffMonth);
    expect(result.cappedAt).toBeNull();
    expect(result.next).toBeNull();
  });

  it('invalid input (NaN) → coerces to 0; if no existing entry, no-op', () => {
    const stored: HistoricalCostEntry[] = [];
    const result = commitHistoricalCostEdit(stored, '2026-03', 'not a number', actualCost, cutoffMonth);
    expect(result.cappedAt).toBeNull();
    expect(result.next).toBeNull();
  });

  it('negative input coerces to 0; existing entry is removed', () => {
    const stored: HistoricalCostEntry[] = [
      { month: '2026-03', cost: 5000, hours: 0 },
    ];
    const result = commitHistoricalCostEdit(stored, '2026-03', '-100', actualCost, cutoffMonth);
    expect(result.cappedAt).toBeNull();
    expect(result.next).toEqual([]);
  });
});
