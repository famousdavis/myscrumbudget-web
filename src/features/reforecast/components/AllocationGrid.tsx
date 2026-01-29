'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import type { TeamMember } from '@/types/domain';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { getAllocation } from '@/lib/calc/allocationMap';
import { formatMonthLabel } from '@/lib/utils/dates';

interface AllocationGridProps {
  months: string[];
  teamMembers: TeamMember[];
  allocationMap: AllocationMap;
  onAllocationChange: (memberId: string, month: string, value: number) => void;
  readonly?: boolean;
}

interface CellCoord {
  row: number; // index into teamMembers
  col: number; // index into months
}

interface DragState {
  anchor: CellCoord;
  value: number;
  current: CellCoord;
}

function getAllocationColor(value: number): string {
  if (value === 0) return '';
  if (value <= 0.25) return 'bg-blue-50 dark:bg-blue-950';
  if (value <= 0.5) return 'bg-blue-100 dark:bg-blue-900';
  if (value <= 0.75) return 'bg-blue-200 dark:bg-blue-800';
  if (value < 1) return 'bg-blue-300 dark:bg-blue-700';
  return 'bg-blue-400 dark:bg-blue-600';
}

function isCellInFillRange(
  drag: DragState | null,
  row: number,
  col: number
): boolean {
  if (!drag) return false;
  const { anchor, current } = drag;

  // Fill only works along one axis: same row (horizontal) or same column (vertical)
  // Determine dominant direction based on distance
  const dRow = Math.abs(current.row - anchor.row);
  const dCol = Math.abs(current.col - anchor.col);

  if (dRow === 0 && dCol === 0) return false;

  if (dCol >= dRow) {
    // Horizontal fill: same row as anchor
    if (row !== anchor.row) return false;
    const minCol = Math.min(anchor.col, current.col);
    const maxCol = Math.max(anchor.col, current.col);
    return col >= minCol && col <= maxCol && !(col === anchor.col);
  } else {
    // Vertical fill: same col as anchor
    if (col !== anchor.col) return false;
    const minRow = Math.min(anchor.row, current.row);
    const maxRow = Math.max(anchor.row, current.row);
    return row >= minRow && row <= maxRow && !(row === anchor.row);
  }
}

function getFillCells(drag: DragState): CellCoord[] {
  const { anchor, current } = drag;
  const cells: CellCoord[] = [];

  const dRow = Math.abs(current.row - anchor.row);
  const dCol = Math.abs(current.col - anchor.col);

  if (dRow === 0 && dCol === 0) return cells;

  if (dCol >= dRow) {
    // Horizontal fill
    const minCol = Math.min(anchor.col, current.col);
    const maxCol = Math.max(anchor.col, current.col);
    for (let c = minCol; c <= maxCol; c++) {
      if (c !== anchor.col) {
        cells.push({ row: anchor.row, col: c });
      }
    }
  } else {
    // Vertical fill
    const minRow = Math.min(anchor.row, current.row);
    const maxRow = Math.max(anchor.row, current.row);
    for (let r = minRow; r <= maxRow; r++) {
      if (r !== anchor.row) {
        cells.push({ row: r, col: anchor.col });
      }
    }
  }

  return cells;
}

export function AllocationGrid({
  months,
  teamMembers,
  allocationMap,
  onAllocationChange,
  readonly = false,
}: AllocationGridProps) {
  const [selectedCell, setSelectedCell] = useState<CellCoord | null>(null);
  const [editingCell, setEditingCell] = useState<CellCoord | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [dragState, setDragState] = useState<DragState | null>(null);
  const gridRef = useRef<HTMLTableElement>(null);

  // Commit edits on blur or enter
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

  // Handle mouse up globally to end drag
  useEffect(() => {
    if (!dragState) return;

    const handleMouseUp = () => {
      // Apply fill
      const cells = getFillCells(dragState);
      for (const cell of cells) {
        const memberId = teamMembers[cell.row].id;
        const month = months[cell.col];
        onAllocationChange(memberId, month, dragState.value);
      }
      setDragState(null);
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [dragState, teamMembers, months, onAllocationChange]);

  // Prevent text selection during drag
  useEffect(() => {
    if (!dragState) return;
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('selectstart', prevent);
    return () => document.removeEventListener('selectstart', prevent);
  }, [dragState]);

  if (teamMembers.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Add team members to start entering allocations.
      </p>
    );
  }

  if (months.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No months in project date range.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table ref={gridRef} className="border-collapse text-sm select-none">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900">
              Team Member
            </th>
            {months.map((month) => (
              <th
                key={month}
                className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-center text-xs font-medium whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-900"
              >
                {formatMonthLabel(month)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teamMembers.map((member, rowIdx) => (
            <tr key={member.id}>
              <td className="sticky left-0 z-10 border border-zinc-200 bg-white px-3 py-1 text-xs font-medium whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-950">
                {member.name}
                <span className="ml-1 text-zinc-400">({member.role})</span>
              </td>
              {months.map((month, colIdx) => {
                const value = getAllocation(allocationMap, month, member.id);
                const pctValue = value ? Math.round(value * 100) : 0;
                const isEditing =
                  editingCell?.row === rowIdx && editingCell?.col === colIdx;
                const isSelected =
                  selectedCell?.row === rowIdx && selectedCell?.col === colIdx;
                const isInFillRange = isCellInFillRange(
                  dragState,
                  rowIdx,
                  colIdx
                );

                const displayText = pctValue > 0 ? `${pctValue}%` : '';

                let cellClasses = `relative border border-zinc-200 p-0 dark:border-zinc-700 ${getAllocationColor(value)}`;
                if (isSelected && !isEditing) {
                  cellClasses += ' outline outline-2 outline-blue-500 -outline-offset-1';
                }
                if (isInFillRange) {
                  cellClasses +=
                    ' bg-blue-200/60 dark:bg-blue-700/60';
                }

                if (readonly) {
                  return (
                    <td
                      key={`${member.id}-${month}`}
                      className={`border border-zinc-200 px-2 py-1 text-center text-xs dark:border-zinc-700 ${getAllocationColor(value)}`}
                    >
                      {displayText}
                    </td>
                  );
                }

                return (
                  <td
                    key={`${member.id}-${month}`}
                    className={cellClasses}
                    onClick={() => {
                      if (!isEditing) {
                        commitEdit();
                        setSelectedCell({ row: rowIdx, col: colIdx });
                      }
                    }}
                    onDoubleClick={() => {
                      setSelectedCell({ row: rowIdx, col: colIdx });
                      setEditingCell({ row: rowIdx, col: colIdx });
                      setInputValue(pctValue > 0 ? String(pctValue) : '');
                    }}
                    onMouseEnter={() => {
                      if (dragState) {
                        setDragState((prev) =>
                          prev
                            ? { ...prev, current: { row: rowIdx, col: colIdx } }
                            : null
                        );
                      }
                    }}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            commitEdit();
                          }
                          if (e.key === 'Escape') {
                            setEditingCell(null);
                          }
                        }}
                        className="w-full bg-transparent px-1 py-1 text-center text-xs outline-none"
                      />
                    ) : (
                      <div className="px-1 py-1 text-center text-xs">
                        {displayText}
                      </div>
                    )}
                    {/* Fill handle: small square at bottom-right corner of selected cell */}
                    {isSelected && !isEditing && (
                      <div
                        className="absolute -right-[4px] -bottom-[4px] z-20 h-[8px] w-[8px] cursor-crosshair border border-white bg-blue-600"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragState({
                            anchor: { row: rowIdx, col: colIdx },
                            value: value,
                            current: { row: rowIdx, col: colIdx },
                          });
                        }}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
