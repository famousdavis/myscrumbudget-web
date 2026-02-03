import { describe, it, expect } from 'vitest';
import {
  clampCell,
  moveCellInDirection,
  moveCellDown,
  normalizeRange,
  isCellInRange,
  getAllocationColor,
  computeFillRegion,
  isCellInFillPreview,
} from '../gridHelpers';
import type { SelectionRange, FillDragState } from '../gridHelpers';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import type { TeamMember } from '@/types/domain';

/* ── helpers ───────────────────────────────────────────────────────── */

function makeAllocationMap(
  entries: { month: string; memberId: string; allocation: number }[],
): AllocationMap {
  const map: AllocationMap = new Map();
  for (const { month, memberId, allocation } of entries) {
    if (!map.has(month)) map.set(month, new Map());
    map.get(month)!.set(memberId, allocation);
  }
  return map;
}

const TEAM: TeamMember[] = [
  { id: 'm1', name: 'Alice', role: 'Dev' },
  { id: 'm2', name: 'Bob', role: 'QA' },
];

const MONTHS = ['2026-06', '2026-07', '2026-08', '2026-09'];

/* ── normalizeRange ────────────────────────────────────────────────── */

describe('normalizeRange', () => {
  it('returns the same range when already normalized', () => {
    const r: SelectionRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 3 };
    expect(normalizeRange(r)).toEqual(r);
  });

  it('swaps start/end when inverted', () => {
    const r: SelectionRange = { startRow: 3, startCol: 4, endRow: 1, endCol: 2 };
    expect(normalizeRange(r)).toEqual({
      startRow: 1, startCol: 2, endRow: 3, endCol: 4,
    });
  });

  it('handles single-cell range', () => {
    const r: SelectionRange = { startRow: 2, startCol: 3, endRow: 2, endCol: 3 };
    expect(normalizeRange(r)).toEqual(r);
  });
});

/* ── isCellInRange ─────────────────────────────────────────────────── */

describe('isCellInRange', () => {
  const range: SelectionRange = { startRow: 1, startCol: 1, endRow: 3, endCol: 4 };

  it('returns true for a cell inside the range', () => {
    expect(isCellInRange(range, 2, 2)).toBe(true);
  });

  it('returns true for cells on the boundary', () => {
    expect(isCellInRange(range, 1, 1)).toBe(true);
    expect(isCellInRange(range, 3, 4)).toBe(true);
  });

  it('returns false for a cell outside the range', () => {
    expect(isCellInRange(range, 0, 0)).toBe(false);
    expect(isCellInRange(range, 4, 2)).toBe(false);
  });

  it('returns false when range is null', () => {
    expect(isCellInRange(null, 2, 2)).toBe(false);
  });

  it('normalizes an inverted range before checking', () => {
    const inverted: SelectionRange = { startRow: 3, startCol: 4, endRow: 1, endCol: 1 };
    expect(isCellInRange(inverted, 2, 2)).toBe(true);
  });
});

/* ── getAllocationColor ────────────────────────────────────────────── */

describe('getAllocationColor', () => {
  it('returns empty string for 0 allocation', () => {
    expect(getAllocationColor(0)).toBe('');
  });

  it('returns lightest shade for low allocation (0.1)', () => {
    expect(getAllocationColor(0.1)).toContain('bg-blue-50');
  });

  it('returns light shade for 0.25', () => {
    expect(getAllocationColor(0.25)).toContain('bg-blue-50');
  });

  it('returns medium-light shade for 0.5', () => {
    expect(getAllocationColor(0.5)).toContain('bg-blue-100');
  });

  it('returns medium shade for 0.75', () => {
    expect(getAllocationColor(0.75)).toContain('bg-blue-200');
  });

  it('returns medium-dark shade for 0.9', () => {
    expect(getAllocationColor(0.9)).toContain('bg-blue-300');
  });

  it('returns darkest shade for 1.0 (full allocation)', () => {
    expect(getAllocationColor(1.0)).toContain('bg-blue-400');
  });

  it('returns darkest shade for over-allocation (1.5)', () => {
    expect(getAllocationColor(1.5)).toContain('bg-blue-400');
  });
});

/* ── computeFillRegion ─────────────────────────────────────────────── */

describe('computeFillRegion', () => {
  it('returns empty when current is inside the source range', () => {
    const drag: FillDragState = {
      source: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      current: { row: 0, col: 0 },
    };
    const alloc = makeAllocationMap([
      { month: '2026-06', memberId: 'm1', allocation: 0.5 },
    ]);
    const result = computeFillRegion(drag, alloc, TEAM, MONTHS);
    expect(result.cells).toHaveLength(0);
    expect(result.values).toHaveLength(0);
  });

  it('fills right from source', () => {
    const drag: FillDragState = {
      source: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      current: { row: 0, col: 2 },
    };
    const alloc = makeAllocationMap([
      { month: '2026-06', memberId: 'm1', allocation: 0.75 },
    ]);
    const result = computeFillRegion(drag, alloc, TEAM, MONTHS);
    // Should fill cols 1 and 2 for row 0
    expect(result.cells).toHaveLength(2);
    expect(result.cells[0]).toEqual({ row: 0, col: 1 });
    expect(result.cells[1]).toEqual({ row: 0, col: 2 });
    // Values tiled from source
    expect(result.values[0]).toBe(0.75);
    expect(result.values[1]).toBe(0.75);
  });

  it('fills down from source', () => {
    const drag: FillDragState = {
      source: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      current: { row: 1, col: 0 },
    };
    const alloc = makeAllocationMap([
      { month: '2026-06', memberId: 'm1', allocation: 0.5 },
    ]);
    const result = computeFillRegion(drag, alloc, TEAM, MONTHS);
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]).toEqual({ row: 1, col: 0 });
    expect(result.values[0]).toBe(0.5);
  });
});

/* ── isCellInFillPreview ───────────────────────────────────────────── */

describe('isCellInFillPreview', () => {
  it('returns false when drag is null', () => {
    const alloc = makeAllocationMap([]);
    expect(isCellInFillPreview(null, alloc, TEAM, MONTHS, 0, 0)).toBe(false);
  });

  it('returns true for a cell in the computed fill region', () => {
    const drag: FillDragState = {
      source: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      current: { row: 0, col: 2 },
    };
    const alloc = makeAllocationMap([
      { month: '2026-06', memberId: 'm1', allocation: 0.5 },
    ]);
    expect(isCellInFillPreview(drag, alloc, TEAM, MONTHS, 0, 1)).toBe(true);
    expect(isCellInFillPreview(drag, alloc, TEAM, MONTHS, 0, 2)).toBe(true);
  });

  it('returns false for a cell outside the fill region', () => {
    const drag: FillDragState = {
      source: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      current: { row: 0, col: 2 },
    };
    const alloc = makeAllocationMap([
      { month: '2026-06', memberId: 'm1', allocation: 0.5 },
    ]);
    expect(isCellInFillPreview(drag, alloc, TEAM, MONTHS, 1, 1)).toBe(false);
  });
});

/* ── clampCell ─────────────────────────────────────────────────────── */

describe('clampCell', () => {
  it('returns the cell unchanged when within bounds', () => {
    expect(clampCell({ row: 2, col: 3 }, 5, 10)).toEqual({ row: 2, col: 3 });
  });

  it('clamps row to 0 when negative', () => {
    expect(clampCell({ row: -1, col: 3 }, 5, 10)).toEqual({ row: 0, col: 3 });
  });

  it('clamps row to maxRow when above', () => {
    expect(clampCell({ row: 8, col: 3 }, 5, 10)).toEqual({ row: 5, col: 3 });
  });

  it('clamps col to 0 when negative', () => {
    expect(clampCell({ row: 2, col: -5 }, 5, 10)).toEqual({ row: 2, col: 0 });
  });

  it('clamps col to maxCol when above', () => {
    expect(clampCell({ row: 2, col: 15 }, 5, 10)).toEqual({ row: 2, col: 10 });
  });

  it('clamps both row and col simultaneously', () => {
    expect(clampCell({ row: -1, col: 20 }, 5, 10)).toEqual({ row: 0, col: 10 });
  });
});

/* ── moveCellInDirection ───────────────────────────────────────────── */

describe('moveCellInDirection', () => {
  it('moves down by 1', () => {
    expect(moveCellInDirection({ row: 2, col: 3 }, 1, 0, 5, 10)).toEqual({
      row: 3,
      col: 3,
    });
  });

  it('moves up by 1', () => {
    expect(moveCellInDirection({ row: 2, col: 3 }, -1, 0, 5, 10)).toEqual({
      row: 1,
      col: 3,
    });
  });

  it('moves right by 1', () => {
    expect(moveCellInDirection({ row: 2, col: 3 }, 0, 1, 5, 10)).toEqual({
      row: 2,
      col: 4,
    });
  });

  it('moves left by 1', () => {
    expect(moveCellInDirection({ row: 2, col: 3 }, 0, -1, 5, 10)).toEqual({
      row: 2,
      col: 2,
    });
  });

  it('clamps at top edge', () => {
    expect(moveCellInDirection({ row: 0, col: 3 }, -1, 0, 5, 10)).toEqual({
      row: 0,
      col: 3,
    });
  });

  it('clamps at bottom edge', () => {
    expect(moveCellInDirection({ row: 5, col: 3 }, 1, 0, 5, 10)).toEqual({
      row: 5,
      col: 3,
    });
  });

  it('clamps at left edge', () => {
    expect(moveCellInDirection({ row: 2, col: 0 }, 0, -1, 5, 10)).toEqual({
      row: 2,
      col: 0,
    });
  });

  it('clamps at right edge', () => {
    expect(moveCellInDirection({ row: 2, col: 10 }, 0, 1, 5, 10)).toEqual({
      row: 2,
      col: 10,
    });
  });
});

/* ── moveCellDown ──────────────────────────────────────────────────── */

describe('moveCellDown', () => {
  it('moves down by one row', () => {
    expect(moveCellDown({ row: 0, col: 3 }, 5)).toEqual({ row: 1, col: 3 });
  });

  it('wraps to row 0 when at the last row', () => {
    expect(moveCellDown({ row: 5, col: 3 }, 5)).toEqual({ row: 0, col: 3 });
  });

  it('preserves the column', () => {
    expect(moveCellDown({ row: 2, col: 7 }, 10)).toEqual({ row: 3, col: 7 });
  });

  it('wraps correctly with maxRow of 0 (single row)', () => {
    expect(moveCellDown({ row: 0, col: 2 }, 0)).toEqual({ row: 0, col: 2 });
  });
});
