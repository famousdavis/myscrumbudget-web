// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { TeamMember, PoolMember, MonthlyCalculation, ProductivityWindow, LaborRate } from '@/types/domain';
import { ConfirmDialog } from '@/components/BaseDialog';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { useDragReorder } from '@/hooks/useDragReorder';
import { getEtcStartDate } from '@/lib/utils/dates';
import type { CellCoord, SelectionRange, FillDragState } from '../lib/gridHelpers';
import {
  normalizeRange,
  computeFillRegion,
} from '../lib/gridHelpers';
import { useGridKeyboard } from '../hooks/useGridKeyboard';
import { AllocationGridHeader } from './AllocationGridHeader';
import { AllocationGridRow } from './AllocationGridRow';
import { AllocationGridSummaryRows } from './AllocationGridSummaryRows';
import { AllocationGridAddRow } from './AllocationGridAddRow';

type SortMode = 'none' | 'name' | 'role-name';

interface AllocationGridProps {
  months: string[];
  teamMembers: TeamMember[];
  allocationMap: AllocationMap;
  onAllocationChange: (memberId: string, month: string, value: number) => void;
  onMemberDelete?: (id: string) => void;
  onMemberAdd?: (poolMemberId: string) => void;
  onReorder?: (orderedIds: string[]) => void;
  onSort?: (mode: 'name' | 'role-name') => void;
  pool?: PoolMember[];
  readonly?: boolean;
  monthlyData?: MonthlyCalculation[];
  productivityWindows?: ProductivityWindow[];
  actualsThroughDate?: string;
  /**
   * Forwarded to each row to flag a member whose role has no labor rate.
   * ⚠️ Optional, and `undefined` (settings not loaded) is NOT an empty list — see
   * the prop's note on AllocationGridRow. Never default it to `[]` here.
   */
  laborRates?: LaborRate[];
}

export function AllocationGrid({
  months,
  teamMembers,
  allocationMap,
  onAllocationChange,
  onMemberDelete,
  onMemberAdd,
  onReorder,
  onSort,
  pool = [],
  readonly = false,
  monthlyData,
  productivityWindows,
  actualsThroughDate,
  laborRates,
}: AllocationGridProps) {
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [editingCell, setEditingCell] = useState<CellCoord | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [fillDrag, setFillDrag] = useState<FillDragState | null>(null);
  const [isRangeSelecting, setIsRangeSelecting] = useState(false);
  const [addingRow, setAddingRow] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [focusedCell, setFocusedCell] = useState<CellCoord | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('none');
  const rowReorderCallback = useMemo(
    () => onReorder
      ? (ids: string[]) => { onReorder(ids); setSortMode('none'); }
      : () => {},
    [onReorder],
  );
  const rowDrag = useDragReorder(teamMembers, 'id', rowReorderCallback);
  const mutedMonths = useMemo(() => {
    if (!actualsThroughDate) return new Set<string>();
    const etcMonth = getEtcStartDate(actualsThroughDate).slice(0, 7);
    return new Set(months.filter(m => m < etcMonth));
  }, [actualsThroughDate, months]);

  /*
   * WI-4 — positional selection state is remapped whenever either axis changes.
   *
   * ⚠️ THIS RUNS DURING RENDER, NOT IN AN EFFECT, AND THAT IS LOAD-BEARING.
   * Two of the six roster-indexed dereferences happen while rendering
   * (AllocationGridRow -> isCellInFillPreview -> gridHelpers computeFillRegion), so
   * an effect would run AFTER the render that already threw. Measured 2026-09-04:
   * with a fill drag in flight and the roster shrinking by prop, an effect-based
   * version throws from render and React tears the grid down — byte-identical to
   * having no fix at all, while passing every gate. React's documented
   * "adjust state when a prop changes" pattern is what actually works here.
   *
   * ⚠️ BOTH AXES. Rows keyed by member id, columns by month string. A row-only
   * remap leaves `col` stale, and a stale col does NOT throw — it writes
   * { memberId, month: undefined } into rf.allocations (useReforecast, the
   * append branch), which validateAllocation later rejects, so the user's own
   * export silently stops importing. Reachable by ordinary use: a cloned
   * reforecast preserves assignment ids but carries its own window.
   *
   * ⚠️ CONTENT-KEYED, never reference-keyed. useTeam memoises `members` on
   * [project, pool], so every allocation edit yields a NEW array with identical
   * content; a reference compare would clear the selection on every keystroke.
   *
   * ⚠️ ALL FIVE POSITIONAL STATES ARE HANDLED HERE — focusedCell, editingCell,
   * selection, fillDrag, isRangeSelecting — and nothing enforces that. If you add
   * another piece of state holding a row/col, ADD IT HERE TOO.
   *
   * ⚠️ `setFillDrag(null)` is NOT redundant with the remap; do not drop it as
   * dead. It closes a path the render-time argument above does not reach:
   * computeFillRegion's vertical branch dereferences rows src.startRow..src.endRow
   * but EMITS rows src.endRow+1..current.row, so the fill-commit loop in the
   * mouseup effect below can throw on a row render never touched. Measured at
   * HEAD 2026-09-04: render survives, mouseup throws, and the loop had already
   * PERSISTED part of the fill before aborting.
   */
  const rowIds = teamMembers.map((m) => m.id);
  const gridKey = `${rowIds.join('|')}#${months.join('|')}`;
  const [prevGridKey, setPrevGridKey] = useState(gridKey);
  const [prevAxes, setPrevAxes] = useState<{ rowIds: string[]; months: string[] }>({ rowIds, months });
  if (prevGridKey !== gridKey) {
    setPrevGridKey(gridKey);
    setPrevAxes({ rowIds, months });

    // -1 means "this row/column no longer exists". Returning the raw index instead
    // is what makes the whole remap a no-op: teamMembers[-1] is undefined and the
    // dereferences throw exactly as they did before.
    const remapRow = (row: number) => {
      const id = prevAxes.rowIds[row];
      return id === undefined ? -1 : rowIds.indexOf(id);
    };
    const remapCol = (col: number) => {
      const month = prevAxes.months[col];
      return month === undefined ? -1 : months.indexOf(month);
    };
    const remapCell = (cell: CellCoord | null): CellCoord | null => {
      if (!cell) return cell;
      const row = remapRow(cell.row);
      const col = remapCol(cell.col);
      return row < 0 || col < 0 ? null : { row, col };
    };

    setFocusedCell(remapCell);
    setEditingCell(remapCell);
    // A range survives only while it is still a contiguous block on both axes.
    // Clearing every multi-cell range instead would lose a VALID selection on an
    // unrelated removal, which is its own silent selection-loss surface.
    setSelection((sel) => {
      if (!sel) return sel;
      const n = normalizeRange(sel);
      const rows: number[] = [];
      for (let r = n.startRow; r <= n.endRow; r++) {
        const next = remapRow(r);
        if (next < 0) return null;
        rows.push(next);
      }
      const cols: number[] = [];
      for (let c = n.startCol; c <= n.endCol; c++) {
        const next = remapCol(c);
        if (next < 0) return null;
        cols.push(next);
      }
      const rowLo = Math.min(...rows);
      const rowHi = Math.max(...rows);
      const colLo = Math.min(...cols);
      const colHi = Math.max(...cols);
      if (rowHi - rowLo + 1 !== rows.length) return null;
      if (colHi - colLo + 1 !== cols.length) return null;
      return { startRow: rowLo, startCol: colLo, endRow: rowHi, endCol: colHi };
    });
    setFillDrag(null);
    setIsRangeSelecting(false);
  }

  const gridRef = useRef<HTMLTableElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // --- Sort column header handler ---
  const handleSortClick = useCallback(() => {
    if (!onSort) return;
    if (sortMode === 'none') {
      onSort('name');
      setSortMode('name');
    } else if (sortMode === 'name') {
      onSort('role-name');
      setSortMode('role-name');
    } else {
      setSortMode('none');
    }
  }, [sortMode, onSort]);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    const raw = parseFloat(inputValue);
    if (Number.isFinite(raw)) {
      const clamped = Math.max(0, Math.min(100, raw));
      const memberId = teamMembers[editingCell.row].id;
      const month = months[editingCell.col];
      onAllocationChange(memberId, month, clamped / 100);
    }
    setEditingCell(null);
  }, [editingCell, inputValue, teamMembers, months, onAllocationChange]);

  // Global mouseup to end fill-drag or range-selection
  useEffect(() => {
    if (!fillDrag && !isRangeSelecting) return;

    const handleMouseUp = () => {
      if (fillDrag) {
        const { cells, values } = computeFillRegion(
          fillDrag,
          allocationMap,
          teamMembers,
          months,
        );
        for (let i = 0; i < cells.length; i++) {
          const memberId = teamMembers[cells[i].row].id;
          const month = months[cells[i].col];
          onAllocationChange(memberId, month, values[i]);
        }
        setFillDrag(null);
      }
      if (isRangeSelecting) {
        setIsRangeSelecting(false);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [fillDrag, isRangeSelecting, allocationMap, teamMembers, months, onAllocationChange]);

  // Prevent text selection during drag
  useEffect(() => {
    if (!fillDrag && !isRangeSelecting) return;
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('selectstart', prevent);
    return () => document.removeEventListener('selectstart', prevent);
  }, [fillDrag, isRangeSelecting]);

  // Auto-scroll the container when dragging near edges
  useEffect(() => {
    if (!fillDrag && !isRangeSelecting) return;

    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);

    const EDGE_ZONE = 40;
    const SCROLL_SPEED = 8;

    const scrollInterval = setInterval(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const { x } = mousePositionRef.current;

      if (x > rect.right - EDGE_ZONE && x <= rect.right) {
        container.scrollLeft += SCROLL_SPEED;
      } else if (x < rect.left + EDGE_ZONE && x >= rect.left) {
        container.scrollLeft -= SCROLL_SPEED;
      }
    }, 16);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(scrollInterval);
    };
  }, [fillDrag, isRangeSelecting]);

  /*
   * Clear selection when clicking outside the grid.
   *
   * ⚠️ Scoped to the SCROLL CONTAINER, not the <table>. `createPortal` appears
   * nowhere in src/, so the ConfirmDialog below renders in place as a sibling of
   * the table but INSIDE this container, while BaseDialog's root is a
   * full-viewport `fixed inset-0` backdrop. Measured against the table:
   * table.contains(backdrop) is false and scrollContainer.contains(backdrop) is
   * true, so the mousedown that opened or confirmed that dialog counted as
   * "outside" and cleared the selection by accident.
   *
   * ⚠️ That accident was LOAD-BEARING — it was the only thing making row removal
   * safe under positional selection. On its own this change is a REGRESSION:
   * measured 2026-09-04, removing a member through the dialog and then pressing
   * Delete wrote to a member the user never selected. It is safe only alongside
   * the remap above and the pendingDeleteId gate below; do not split them.
   *
   * ⚠️ User-visible consequence: Cancel on the Remove dialog no longer deselects.
   */
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (scrollContainerRef.current && !scrollContainerRef.current.contains(e.target as Node)) {
        commitEdit();
        setSelection(null);
        setEditingCell(null);
        setFocusedCell(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [commitEdit]);

  // Keyboard navigation (arrow keys, Enter, Escape, Tab, Delete, digit entry)
  useGridKeyboard({
    readonly,
    /*
     * WI-4 — suppress grid keyboard handling while the Remove dialog is open.
     * Passing null trips the hook's own `if (!focusedCell) return`, so this needs
     * no new hook input and covers Escape as well as Delete/Backspace (that guard
     * sits above the editingCell branch).
     *
     * ⚠️ It does NOT strand an in-flight edit, and that was measured rather than
     * reasoned (2026-09-04). BaseDialog focus-traps on mount, which blurs the cell
     * <input>, whose onBlur runs commitEdit. Checkpointed at the moment the dialog
     * appears: the input is already out of the DOM, editingCell is already null,
     * and the pending value has already been written. There is no open editor for
     * this gate to make inert.
     */
    focusedCell: pendingDeleteId ? null : focusedCell,
    editingCell,
    selection,
    teamMembers,
    months,
    allocationMap,
    onAllocationChange,
    commitEdit,
    setFocusedCell,
    setSelection,
    setEditingCell,
    setInputValue,
  });

  // --- Cell interaction callbacks ---
  const handleCellMouseDown = useCallback((rowIdx: number, colIdx: number, shiftKey: boolean) => {
    commitEdit();
    setFocusedCell({ row: rowIdx, col: colIdx });

    if (shiftKey && selection) {
      setSelection((prev) =>
        prev
          ? { startRow: prev.startRow, startCol: prev.startCol, endRow: rowIdx, endCol: colIdx }
          : { startRow: rowIdx, startCol: colIdx, endRow: rowIdx, endCol: colIdx },
      );
    } else {
      setSelection({ startRow: rowIdx, startCol: colIdx, endRow: rowIdx, endCol: colIdx });
      setIsRangeSelecting(true);
    }
  }, [commitEdit, selection]);

  const handleCellMouseEnter = useCallback((rowIdx: number, colIdx: number) => {
    if (fillDrag) {
      setFillDrag((prev) =>
        prev ? { ...prev, current: { row: rowIdx, col: colIdx } } : null,
      );
    } else if (isRangeSelecting) {
      setSelection((prev) =>
        prev ? { ...prev, endRow: rowIdx, endCol: colIdx } : null,
      );
    }
  }, [fillDrag, isRangeSelecting]);

  const handleCellDoubleClick = useCallback((rowIdx: number, colIdx: number, pctValue: number) => {
    setSelection({ startRow: rowIdx, startCol: colIdx, endRow: rowIdx, endCol: colIdx });
    setFocusedCell({ row: rowIdx, col: colIdx });
    setEditingCell({ row: rowIdx, col: colIdx });
    setInputValue(pctValue > 0 ? String(pctValue) : '');
  }, []);

  const handleFillHandleMouseDown = useCallback((_rowIdx: number, _colIdx: number, sel: SelectionRange) => {
    setFillDrag({
      source: sel,
      current: { row: _rowIdx, col: _colIdx },
    });
  }, []);

  // --- Empty states ---
  if (months.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No months in project date range.
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Check the project start and end dates.
        </p>
      </div>
    );
  }

  const hasRowControls = !readonly && !!onMemberDelete && !!onMemberAdd;

  if (teamMembers.length === 0 && pool.filter((m) => !m.archived).length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No team members assigned to this project.
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          <Link
            href="/team"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Go to Team Pool
          </Link>{' '}
          to add team members, then return here to assign them.
        </p>
      </div>
    );
  }

  const normalizedSel = selection ? normalizeRange(selection) : null;
  const fillHandleRow = normalizedSel?.endRow ?? null;
  const fillHandleCol = normalizedSel?.endCol ?? null;

  return (
    <div ref={scrollContainerRef} className="max-w-full overflow-x-auto">
      <table
        ref={gridRef}
        className="border-collapse text-base select-none"
        tabIndex={0}
        onFocus={() => {
          if (!focusedCell && teamMembers.length > 0 && months.length > 0) {
            setFocusedCell({ row: 0, col: 0 });
            setSelection({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
          }
        }}
      >
        <AllocationGridHeader
          months={months}
          productivityWindows={productivityWindows}
          sortMode={sortMode}
          onSortClick={handleSortClick}
          hasRowControls={hasRowControls}
          sortable={!!onSort}
        />
        <tbody>
          {teamMembers.map((member, rowIdx) => (
            <AllocationGridRow
              key={member.id}
              member={member}
              laborRates={laborRates}
              rowIdx={rowIdx}
              months={months}
              allocationMap={allocationMap}
              readonly={readonly}
              hasRowControls={hasRowControls}
              normalizedSel={normalizedSel}
              editingCell={editingCell}
              focusedCell={focusedCell}
              fillDrag={fillDrag}
              fillHandleRow={fillHandleRow}
              fillHandleCol={fillHandleCol}
              inputValue={inputValue}
              teamMembers={teamMembers}
              onInputChange={setInputValue}
              onCellCommitEdit={commitEdit}
              onCellMouseDown={handleCellMouseDown}
              onCellMouseEnter={handleCellMouseEnter}
              onCellDoubleClick={handleCellDoubleClick}
              onFillHandleMouseDown={handleFillHandleMouseDown}
              onDeleteClick={setPendingDeleteId}
              isDragging={rowDrag.isDragging(member.id)}
              isDragOver={rowDrag.isDragOver(member.id)}
              dragHandlers={
                hasRowControls && onReorder
                  ? {
                      onDragOver: rowDrag.handleDragOver,
                      onDragEnter: () => rowDrag.handleDragEnter(member.id),
                      onDragLeave: () => rowDrag.handleDragLeave(member.id),
                      onDrop: (e: React.DragEvent) => rowDrag.handleDrop(member.id, e),
                      onDragStart: (e: React.DragEvent) => rowDrag.handleDragStart(member.id, e),
                      onDragEnd: rowDrag.handleDragEnd,
                    }
                  : {}
              }
              canReorder={!!onReorder}
              mutedMonths={mutedMonths}
            />
          ))}
          {monthlyData && monthlyData.length > 0 && (
            <AllocationGridSummaryRows
              months={months}
              monthlyData={monthlyData}
              hasRowControls={hasRowControls}
              mutedMonths={mutedMonths}
            />
          )}
          {hasRowControls && onMemberAdd && (
            <AllocationGridAddRow
              months={months}
              pool={pool}
              addingRow={addingRow}
              onAddingRowChange={setAddingRow}
              onMemberAdd={onMemberAdd}
              hasRowControls={hasRowControls}
            />
          )}
        </tbody>
      </table>
      {pendingDeleteId && onMemberDelete && (
        <ConfirmDialog
          title="Remove Team Member"
          confirmLabel="Remove"
          message={<>Are you sure you want to remove <strong>{teamMembers.find((m) => m.id === pendingDeleteId)?.name ?? ''}</strong> from this reforecast? Their allocations in this reforecast will be lost. Other reforecasts are not affected.</>}
          onConfirm={() => {
            onMemberDelete(pendingDeleteId);
            setPendingDeleteId(null);
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  );
}
