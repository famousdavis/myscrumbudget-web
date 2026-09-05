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

/**
 * The selection to hold after a fill drag ends. Keeps `prev` whenever it already
 * covers the dragged source - preserving its orientation, i.e. the anchor that a
 * shift-click extends from - and falls back to the source only when `prev` was
 * cleared or replaced during the drag.
 */
function restoreSource(prev: SelectionRange | null, source: SelectionRange): SelectionRange {
  if (prev) {
    const a = normalizeRange(prev);
    const b = normalizeRange(source);
    if (a.startRow === b.startRow && a.startCol === b.startCol && a.endRow === b.endRow && a.endCol === b.endCol) {
      return prev;
    }
  }
  return source;
}

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
   * content, and a reference compare would re-run this block on every render.
   * ⚠️ The harm is NOT a lost selection — remapping identical content is the
   * identity map, so focus and selection survive either way, and no assertion
   * about them can tell the two apart (measured: a reference-keyed build passes
   * every other test in AllocationGridSelection.test.tsx). What breaks is
   * `setFillDrag(null)` / `setIsRangeSelecting(false)` firing on every render,
   * which KILLS AN IN-PROGRESS DRAG whenever the parent re-renders. Measured
   * 2026-09-04: a range drag stops extending after one cell and a fill drag
   * commits nothing. That is what the two drag-survival tests pin.
   *
   * ⚠️ ALL FIVE POSITIONAL STATES ARE HANDLED HERE — focusedCell, editingCell,
   * selection, fillDrag, isRangeSelecting — and nothing enforces that. If you add
   * another piece of state holding a row/col, ADD IT HERE TOO.
   *
   * ⚠️⚠️ `setFillDrag(null)` IS NOT REDUNDANT WITH THE REMAP. Do not delete it as
   * dead in a later cleanup — its necessity is invisible from the argument that
   * motivated everything above it, which is exactly why it needs saying here.
   * The render-time reasoning does NOT reach the path it closes:
   *   - computeFillRegion's vertical branch DEREFERENCES rows
   *     src.startRow..src.endRow but EMITS rows src.endRow+1..current.row. The
   *     emitted rows lie entirely BELOW the dereferenced ones, so with a stale
   *     end row the fill-commit loop in the mouseup effect below throws on a row
   *     RENDER NEVER TOUCHED. Render survives; there is nothing for an
   *     adjust-state-before-children argument to prevent.
   *   - `onAllocationChange` is called INSIDE that loop and `setFillDrag(null)`
   *     sits AFTER it, so a mid-loop throw both persists the earlier cells and
   *     skips the reset.
   * Measured at HEAD 2026-09-04, and the second half is the worse half: one
   * mouseup wrote a single cell and threw, the fill preview was STILL RENDERED
   * afterwards, and a SECOND mouseup threw again and re-wrote the same cell.
   * The drag is not merely aborted — it is left live and failing, re-writing on
   * every subsequent mouse release until the page is reloaded.
   * ⚠️ Pinned by the test 'a downward fill commit after the roster shrinks
   * writes nothing rather than partially applying' in
   * __tests__/AllocationGridSelection.test.tsx. That test, not this comment, is
   * what fails if the line goes.
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
        const { source } = fillDrag;
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
        setSelection((prev) => restoreSource(prev, source));
      }
      if (isRangeSelecting) {
        setIsRangeSelecting(false);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [fillDrag, isRangeSelecting, allocationMap, teamMembers, months, onAllocationChange]);

  /*
   * Cancel an in-flight drag when the window loses focus. Without this, alt-tabbing
   * mid-fill leaves the drag live: measured at v0.37.14 the preview survived the
   * blur and the next mouseup COMMITTED the fill the user had walked away from.
   *
   * ⚠️ TWO MECHANISMS, OPPOSITE TREATMENT — one sentence covering two things that
   * must not be collapsed.
   *   - fillDrag has a destructive commit, so cancelling means DISCARDING it.
   *   - Range selection has no destructive branch; "commit" and "cancel" are the
   *     same operation. Stopping the drag stops the EXTENSION only.
   * ⚠️ `selection` IS DELIBERATELY NOT TOUCHED. Reading "cancel" as "undo" and
   * clearing it would lose the user's selection every time they alt-tab away —
   * measured at v0.37.14, a completed 2-cell selection survives a window blur and
   * Delete still targets both cells. That must stay true.
   * ⚠️ And do NOT reuse the mouseup handler above for this: it COMMITS the fill,
   * which is the exact bug this guard exists to prevent.
   *
   * ⚠️ ESCAPE IS DELIBERATELY NOT A TRIGGER HERE, and that is a scoping decision
   * rather than an oversight. Measured at v0.37.14: Escape during a fill drag does
   * nothing at all — the preview survives and the next mouseup still commits. It
   * is not closed here because the keyboard lives in useGridKeyboard, so adding it
   * means giving that hook setFillDrag/setIsRangeSelecting as new inputs, which is
   * a wider change than this release is scoped for. Recorded 2026-09-04 as a
   * follow-up candidate, not as a gap someone should quietly patch in passing.
   */
  useEffect(() => {
    if (!fillDrag && !isRangeSelecting) return;
    const handleWindowBlur = () => {
      if (fillDrag) {
        // A cancelled drag must not end with nothing selected either.
        const { source } = fillDrag;
        setSelection((prev) => restoreSource(prev, source));
      }
      setFillDrag(null);
      setIsRangeSelecting(false);
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [fillDrag, isRangeSelecting]);

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
      /*
       * A target that is no longer in the document was removed by its OWN
       * handler, and that is not a click outside the grid.
       *
       * Reported in production on Brave and Safari and pinned locally with a
       * real pointer (2026-09-04): the fill handle's onMouseDown sets fillDrag,
       * showFillHandle includes !fillDrag, so the handle unmounts its own event
       * target. On a TRUSTED event the browser runs a microtask checkpoint
       * between listeners and React flushes the discrete update in it; this
       * listener is registered after React's root listener on the same node
       * (the App Router root is `document`), so it received a DETACHED node -
       * measured {isConnected:false, contains:false, isTrusted:true}, against
       * {isConnected:true, contains:true, isTrusted:false} for the same press
       * dispatched synthetically. contains() was false, and every handle press
       * cleared the selection and the focused cell and committed any editor.
       * No synthetic instrument could see it: jsdom, fireEvent and
       * dispatchEvent keep the stack busy, so the microtask never runs between
       * listeners. Verified with a real pointer; the jsdom test detaches by
       * hand (AllocationGridPointer.test.tsx).
       *
       * Bound, checked 2026-09-04: the fill handle is the only onMouseDown in
       * the grid that unmounts its target. Buttons and the dialogs act on click,
       * by which time nothing has unmounted (the Remove dialog's Cancel was
       * checked with a real click), so a genuine outside click still clears.
       * The one other self-unmounting mousedown target in src/ is the
       * CloudStorageModal backdrop, outside the grid and reachable only after a
       * click on the auth chip has already cleared the selection.
       */
      if (!(e.target instanceof Node) || !e.target.isConnected) return;
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
  const handleCellMouseDown = useCallback((rowIdx: number, colIdx: number, shiftKey: boolean, button: number) => {
    /*
     * Non-primary buttons must not move the selection. Measured at v0.37.14: a
     * right-click inside a 9-cell selection collapsed it to a single cell.
     *
     * ⚠️ This guard is a SUPERSET of that fix and is safe only by circumstance.
     * The spreadsheet idiom is asymmetric — right-click INSIDE a selection keeps
     * it, right-click OUTSIDE moves it — and this gives neither: it makes
     * right-click inert. That is acceptable here ONLY BECAUSE nothing in this app
     * renders a context menu (`onContextMenu|contextmenu` matched 0 files in
     * src/, checked 2026-09-04), so there is no menu whose target could disagree
     * with the selection. If one is ever added, this must become the asymmetric
     * rule rather than staying a blanket return.
     *
     * ⚠️ commitEdit() STILL RUNS, and the guard is HERE rather than in the row
     * for that reason alone. Do not "simplify" it to a bare early return, and do
     * not move it up into AllocationGridRow's onMouseDown.
     * Right-clicking another cell while an editor is open commits the pending
     * value today (measured at v0.37.14), and the call below is the ONLY thing
     * that does it. ⚠️ The click-outside handler is NOT a fallback here and never
     * was: a <td> sits inside both the <table> and the scroll container, so its
     * `!contains(target)` test is false on any cell click under either scoping.
     * (What v0.37.14 did narrow is the BLANK SPACE beside a narrow table, which
     * used to be outside the <table> and is inside the scroll container — a real
     * change, but not one that touches cells.)
     * So a guard that returns before this function runs would leave the commit to
     * the input's own onBlur, which is verified in Chromium and unverified on
     * WebKit and Gecko. Committing here keeps the shipped behaviour and removes
     * the browser dependency.
     */
    if (button !== 0) {
      commitEdit();
      return;
    }
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

  /*
   * While a fill drag is live the SOURCE marking is drawn from the drag's own
   * record, not from `selection`.
   *
   * The two halves of the gesture used to read two states: the copy and the
   * preview read `fillDrag`, the marking and the handle read `selection`. So
   * anything that clears or replaces `selection` mid-drag produced exactly the
   * reported symptom - borders gone, previews rendering, copy landing. The
   * clearer turned out to be the click-outside listener above (fixed there),
   * but the coupling is a defect on its own: the table's onFocus can replace
   * `selection` with (0,0) too, and the next clearer would reproduce the report
   * verbatim. `fillDrag.source` is the range the copy uses, so drawing the
   * source from it cannot disagree with what gets written.
   *
   * ⚠️ Both this and the drag-end restore are NO-OPS while `selection` survives:
   * the source was taken from the selection at handle-down, and restoreSource
   * keeps the existing object when it covers the same cells, so the range's
   * orientation - the anchor a shift-click extends from - is untouched. That
   * is not automatic: `fillDrag.source` is NORMALISED, and writing it back
   * would move the anchor to the top-left. Pinned by the byte-identical test
   * in AllocationGridPointer.test.tsx.
   */
  const normalizedSel = selection ? normalizeRange(selection) : null;
  const sourceRange = fillDrag ? fillDrag.source : normalizedSel;
  const fillHandleRow = normalizedSel?.endRow ?? null;
  const fillHandleCol = normalizedSel?.endCol ?? null;

  return (
    <div ref={scrollContainerRef} className="max-w-full overflow-x-auto">
      <table
        ref={gridRef}
        className="border-collapse text-base select-none"
        tabIndex={0}
        onFocus={(e) => {
          /*
           * React's onFocus is delivered via focusin, which BUBBLES, so without
           * this every focusable descendant triggered it. Measured at v0.37.14:
           * focusing a row's remove button selected cell (0,0), and a Delete
           * pressed afterwards zeroed an allocation the user never touched —
           * tabbing to a remove button silently armed a destructive keystroke on
           * an unrelated cell. "+ Add member" did the same.
           * ⚠️ Focusing the TABLE itself must still select (0,0); that is the
           * keyboard entry point, not a bug.
           */
          if (e.target !== e.currentTarget) return;
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
              normalizedSel={sourceRange}
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
