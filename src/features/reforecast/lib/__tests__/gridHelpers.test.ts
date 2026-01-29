import { describe, it, expect } from 'vitest';
import { clampCell, moveCellInDirection } from '../gridHelpers';

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
