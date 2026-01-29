import type { TeamMember } from '@/types/domain';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { getAllocation } from '@/lib/calc/allocationMap';

export interface CellCoord {
  row: number;
  col: number;
}

/** A rectangular selection defined by two corners (inclusive). */
export interface SelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface FillDragState {
  /** The selection range being filled from */
  source: SelectionRange;
  /** Current mouse position (cell coord) */
  current: CellCoord;
}

export function normalizeRange(range: SelectionRange): SelectionRange {
  return {
    startRow: Math.min(range.startRow, range.endRow),
    startCol: Math.min(range.startCol, range.endCol),
    endRow: Math.max(range.startRow, range.endRow),
    endCol: Math.max(range.startCol, range.endCol),
  };
}

export function isCellInRange(range: SelectionRange | null, row: number, col: number): boolean {
  if (!range) return false;
  const n = normalizeRange(range);
  return row >= n.startRow && row <= n.endRow && col >= n.startCol && col <= n.endCol;
}

export function getAllocationColor(value: number): string {
  if (value === 0) return '';
  if (value <= 0.25) return 'bg-blue-50 dark:bg-blue-950';
  if (value <= 0.5) return 'bg-blue-100 dark:bg-blue-900';
  if (value <= 0.75) return 'bg-blue-200 dark:bg-blue-800';
  if (value < 1) return 'bg-blue-300 dark:bg-blue-700';
  return 'bg-blue-400 dark:bg-blue-600';
}

/**
 * Given a fill drag, determine which cells will be filled and what values
 * they get. The source selection's values are tiled/repeated into the
 * fill region in the drag direction.
 */
export function computeFillRegion(
  drag: FillDragState,
  allocationMap: AllocationMap,
  teamMembers: TeamMember[],
  months: string[],
): { cells: CellCoord[]; values: number[] } {
  const src = normalizeRange(drag.source);
  const { current } = drag;
  const cells: CellCoord[] = [];
  const values: number[] = [];

  const distRight = current.col - src.endCol;
  const distLeft = src.startCol - current.col;
  const distDown = current.row - src.endRow;
  const distUp = src.startRow - current.row;

  const maxHoriz = Math.max(distRight, distLeft);
  const maxVert = Math.max(distDown, distUp);

  if (maxHoriz <= 0 && maxVert <= 0) {
    return { cells, values };
  }

  const srcRowCount = src.endRow - src.startRow + 1;
  const srcColCount = src.endCol - src.startCol + 1;

  if (maxHoriz >= maxVert) {
    const fillStartCol = distRight >= distLeft ? src.endCol + 1 : current.col;
    const fillEndCol = distRight >= distLeft ? current.col : src.startCol - 1;

    if (fillStartCol > fillEndCol) return { cells, values };

    for (let c = fillStartCol; c <= fillEndCol; c++) {
      const srcColOffset = (c - fillStartCol) % srcColCount;
      const srcCol = distRight >= distLeft
        ? src.startCol + srcColOffset
        : src.endCol - srcColOffset;

      for (let r = src.startRow; r <= src.endRow; r++) {
        const srcValue = getAllocation(allocationMap, months[srcCol], teamMembers[r].id);
        cells.push({ row: r, col: c });
        values.push(srcValue);
      }
    }
  } else {
    const fillStartRow = distDown >= distUp ? src.endRow + 1 : current.row;
    const fillEndRow = distDown >= distUp ? current.row : src.startRow - 1;

    if (fillStartRow > fillEndRow) return { cells, values };

    for (let r = fillStartRow; r <= fillEndRow; r++) {
      const srcRowOffset = (r - fillStartRow) % srcRowCount;
      const srcRow = distDown >= distUp
        ? src.startRow + srcRowOffset
        : src.endRow - srcRowOffset;

      for (let c = src.startCol; c <= src.endCol; c++) {
        const srcValue = getAllocation(allocationMap, months[c], teamMembers[srcRow].id);
        cells.push({ row: r, col: c });
        values.push(srcValue);
      }
    }
  }

  return { cells, values };
}

export function clampCell(
  cell: CellCoord,
  maxRow: number,
  maxCol: number,
): CellCoord {
  return {
    row: Math.max(0, Math.min(maxRow, cell.row)),
    col: Math.max(0, Math.min(maxCol, cell.col)),
  };
}

export function moveCellInDirection(
  cell: CellCoord,
  dRow: number,
  dCol: number,
  maxRow: number,
  maxCol: number,
): CellCoord {
  return clampCell(
    { row: cell.row + dRow, col: cell.col + dCol },
    maxRow,
    maxCol,
  );
}

export function isCellInFillPreview(
  drag: FillDragState | null,
  allocationMap: AllocationMap,
  teamMembers: TeamMember[],
  months: string[],
  row: number,
  col: number,
): boolean {
  if (!drag) return false;
  const { cells } = computeFillRegion(drag, allocationMap, teamMembers, months);
  return cells.some((c) => c.row === row && c.col === col);
}
