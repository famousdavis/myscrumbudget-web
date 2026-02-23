'use client';

import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { TeamMember, PoolMember, MonthlyCalculation, ProductivityWindow } from '@/types/domain';
import { ConfirmDialog } from '@/components/BaseDialog';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { getAllocation } from '@/lib/calc/allocationMap';
import { useDragReorder } from '@/hooks/useDragReorder';
import type { CellCoord, SelectionRange, FillDragState } from '../lib/gridHelpers';
import {
  normalizeRange,
  computeFillRegion,
  moveCellInDirection,
  moveCellDown,
} from '../lib/gridHelpers';
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
    if (!isNaN(raw)) {
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

  // Clear selection when clicking outside the grid
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
        commitEdit();
        setSelection(null);
        setEditingCell(null);
        setFocusedCell(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [commitEdit]);

  // Keyboard navigation
  useEffect(() => {
    if (readonly || teamMembers.length === 0 || months.length === 0) return;

    const maxRow = teamMembers.length - 1;
    const maxCol = months.length - 1;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!focusedCell) return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'SELECT') return;
      if (target.tagName === 'INPUT' && !target.hasAttribute('data-grid-input')) return;

      if (editingCell) {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitEdit();
          const next = moveCellDown(focusedCell, maxRow);
          setFocusedCell(next);
          setSelection({ startRow: next.row, startCol: next.col, endRow: next.row, endCol: next.col });
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setEditingCell(null);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          commitEdit();
          const next = moveCellInDirection(focusedCell, 0, e.shiftKey ? -1 : 1, maxRow, maxCol);
          setFocusedCell(next);
          setSelection({ startRow: next.row, startCol: next.col, endRow: next.row, endCol: next.col });
        }
        return;
      }

      const setFocusAndSelect = (cell: CellCoord) => {
        setFocusedCell(cell);
        setSelection({ startRow: cell.row, startCol: cell.col, endRow: cell.row, endCol: cell.col });
      };

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setFocusAndSelect(moveCellInDirection(focusedCell, -1, 0, maxRow, maxCol));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusAndSelect(moveCellInDirection(focusedCell, 1, 0, maxRow, maxCol));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setFocusAndSelect(moveCellInDirection(focusedCell, 0, -1, maxRow, maxCol));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setFocusAndSelect(moveCellInDirection(focusedCell, 0, 1, maxRow, maxCol));
          break;
        case 'Tab':
          e.preventDefault();
          setFocusAndSelect(moveCellInDirection(focusedCell, 0, e.shiftKey ? -1 : 1, maxRow, maxCol));
          break;
        case 'Enter': {
          e.preventDefault();
          const value = getAllocation(allocationMap, months[focusedCell.col], teamMembers[focusedCell.row].id);
          const pctValue = value ? Math.round(value * 100) : 0;
          setEditingCell(focusedCell);
          setInputValue(pctValue > 0 ? String(pctValue) : '');
          break;
        }
        case 'Delete':
        case 'Backspace': {
          e.preventDefault();
          if (selection) {
            const norm = normalizeRange(selection);
            for (let r = norm.startRow; r <= norm.endRow; r++) {
              for (let c = norm.startCol; c <= norm.endCol; c++) {
                onAllocationChange(teamMembers[r].id, months[c], 0);
              }
            }
          }
          break;
        }
        default:
          if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            setEditingCell(focusedCell);
            setInputValue(e.key);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    readonly,
    focusedCell,
    editingCell,
    selection,
    teamMembers,
    months,
    allocationMap,
    onAllocationChange,
    commitEdit,
  ]);

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

  if (teamMembers.length === 0 && pool.length === 0) {
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
            />
          ))}
          {monthlyData && monthlyData.length > 0 && (
            <AllocationGridSummaryRows
              months={months}
              monthlyData={monthlyData}
              hasRowControls={hasRowControls}
            />
          )}
          <AllocationGridAddRow
            months={months}
            pool={pool}
            addingRow={addingRow}
            onAddingRowChange={setAddingRow}
            onMemberAdd={onMemberAdd!}
            hasRowControls={hasRowControls}
          />
        </tbody>
      </table>
      {pendingDeleteId && onMemberDelete && (
        <ConfirmDialog
          title="Remove Team Member"
          confirmLabel="Remove"
          message={<>Are you sure you want to remove <strong>{teamMembers.find((m) => m.id === pendingDeleteId)?.name ?? ''}</strong>? All allocations for this member across every reforecast will be lost.</>}
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
