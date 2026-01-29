'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import type { TeamMember, LaborRate, MonthlyCalculation } from '@/types/domain';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { getAllocation } from '@/lib/calc/allocationMap';
import { formatMonthLabel } from '@/lib/utils/dates';
import { formatCurrency } from '@/lib/utils/format';

interface AllocationGridProps {
  months: string[];
  teamMembers: TeamMember[];
  allocationMap: AllocationMap;
  onAllocationChange: (memberId: string, month: string, value: number) => void;
  onMemberUpdate?: (id: string, updates: Partial<Omit<TeamMember, 'id'>>) => void;
  onMemberDelete?: (id: string) => void;
  onMemberAdd?: (name: string, role: string, type: 'Core' | 'Extended') => void;
  laborRates?: LaborRate[];
  readonly?: boolean;
  monthlyData?: MonthlyCalculation[];
}

interface CellCoord {
  row: number;
  col: number;
}

/** A rectangular selection defined by two corners (inclusive). */
interface SelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

interface FillDragState {
  /** The selection range being filled from */
  source: SelectionRange;
  /** Current mouse position (cell coord) */
  current: CellCoord;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeRange(range: SelectionRange): SelectionRange {
  return {
    startRow: Math.min(range.startRow, range.endRow),
    startCol: Math.min(range.startCol, range.endCol),
    endRow: Math.max(range.startRow, range.endRow),
    endCol: Math.max(range.startCol, range.endCol),
  };
}

function isCellInRange(range: SelectionRange | null, row: number, col: number): boolean {
  if (!range) return false;
  const n = normalizeRange(range);
  return row >= n.startRow && row <= n.endRow && col >= n.startCol && col <= n.endCol;
}

function getAllocationColor(value: number): string {
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
function computeFillRegion(
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

function isCellInFillPreview(
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AllocationGrid({
  months,
  teamMembers,
  allocationMap,
  onAllocationChange,
  onMemberUpdate,
  onMemberDelete,
  onMemberAdd,
  laborRates = [],
  readonly = false,
  monthlyData,
}: AllocationGridProps) {
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [editingCell, setEditingCell] = useState<CellCoord | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [fillDrag, setFillDrag] = useState<FillDragState | null>(null);
  const [isRangeSelecting, setIsRangeSelecting] = useState(false);
  const [addingRow, setAddingRow] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newType, setNewType] = useState<'Core' | 'Extended'>('Core');
  const gridRef = useRef<HTMLTableElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

    const EDGE_ZONE = 40; // px from edge to trigger scroll
    const SCROLL_SPEED = 8; // px per frame

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
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [commitEdit]);

  const handleAddRow = () => {
    if (!newName.trim() || !newRole || !onMemberAdd) return;
    onMemberAdd(newName.trim(), newRole, newType);
    setNewName('');
    setNewRole('');
    setNewType('Core');
    setAddingRow(false);
  };

  if (months.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No months in project date range.
      </p>
    );
  }

  const normalizedSel = selection ? normalizeRange(selection) : null;
  const fillHandleRow = normalizedSel?.endRow ?? null;
  const fillHandleCol = normalizedSel?.endCol ?? null;

  // Whether row management controls are available
  const hasRowControls = !readonly && onMemberUpdate && onMemberDelete && onMemberAdd;

  return (
    <div ref={scrollContainerRef} className="max-w-full overflow-x-auto">
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
            {hasRowControls && (
              <th className="sticky right-0 z-10 border border-zinc-200 bg-zinc-50 px-2 py-2 text-center text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900">
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {teamMembers.map((member, rowIdx) => (
            <tr key={member.id}>
              <td className="sticky left-0 z-10 border border-zinc-200 bg-white px-1 py-1 dark:border-zinc-700 dark:bg-zinc-950">
                {hasRowControls ? (
                  <div className="relative">
                    <div className="pointer-events-none px-1 py-0.5 text-xs font-medium whitespace-nowrap">
                      {member.name}
                      <span className="ml-1 text-zinc-400">({member.role})</span>
                    </div>
                    <select
                      value={member.id}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        if (selectedId === member.id) return;
                        const selectedMember = teamMembers.find((m) => m.id === selectedId);
                        if (selectedMember && onMemberUpdate) {
                          onMemberUpdate(member.id, {
                            name: selectedMember.name,
                            role: selectedMember.role,
                            type: selectedMember.type,
                          });
                        }
                      }}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    >
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="px-2 text-xs font-medium whitespace-nowrap">
                    {member.name}
                    <span className="ml-1 text-zinc-400">({member.role})</span>
                  </div>
                )}
              </td>
              {months.map((month, colIdx) => {
                const value = getAllocation(allocationMap, month, member.id);
                const pctValue = value ? Math.round(value * 100) : 0;
                const isEditing =
                  editingCell?.row === rowIdx && editingCell?.col === colIdx;
                const isSelected = isCellInRange(normalizedSel, rowIdx, colIdx);
                const isInFillPreview = isCellInFillPreview(
                  fillDrag,
                  allocationMap,
                  teamMembers,
                  months,
                  rowIdx,
                  colIdx,
                );

                const displayText = pctValue > 0 ? `${pctValue}%` : '';

                const showFillHandle =
                  !isEditing &&
                  fillHandleRow === rowIdx &&
                  fillHandleCol === colIdx &&
                  !fillDrag;

                let cellClasses =
                  'relative border border-zinc-200 p-0 dark:border-zinc-700';

                if (!isInFillPreview) {
                  cellClasses += ` ${getAllocationColor(value)}`;
                }

                if (isSelected && !isEditing) {
                  cellClasses +=
                    ' outline outline-2 outline-blue-500 -outline-offset-1';
                }
                if (isInFillPreview) {
                  cellClasses += ' bg-blue-200/60 dark:bg-blue-700/60';
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
                    onMouseDown={(e) => {
                      if ((e.target as HTMLElement).dataset.fillHandle) return;

                      if (isEditing) return;
                      commitEdit();

                      if (e.shiftKey && selection) {
                        setSelection((prev) =>
                          prev
                            ? {
                                startRow: prev.startRow,
                                startCol: prev.startCol,
                                endRow: rowIdx,
                                endCol: colIdx,
                              }
                            : {
                                startRow: rowIdx,
                                startCol: colIdx,
                                endRow: rowIdx,
                                endCol: colIdx,
                              },
                        );
                      } else {
                        setSelection({
                          startRow: rowIdx,
                          startCol: colIdx,
                          endRow: rowIdx,
                          endCol: colIdx,
                        });
                        setIsRangeSelecting(true);
                      }
                    }}
                    onMouseEnter={() => {
                      if (fillDrag) {
                        setFillDrag((prev) =>
                          prev
                            ? { ...prev, current: { row: rowIdx, col: colIdx } }
                            : null,
                        );
                      } else if (isRangeSelecting) {
                        setSelection((prev) =>
                          prev
                            ? { ...prev, endRow: rowIdx, endCol: colIdx }
                            : null,
                        );
                      }
                    }}
                    onDoubleClick={() => {
                      setSelection({
                        startRow: rowIdx,
                        startCol: colIdx,
                        endRow: rowIdx,
                        endCol: colIdx,
                      });
                      setEditingCell({ row: rowIdx, col: colIdx });
                      setInputValue(pctValue > 0 ? String(pctValue) : '');
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
                        className="absolute inset-0 z-10 bg-white text-center text-xs outline-none dark:bg-zinc-950"
                      />
                    ) : (
                      <div className="px-2 py-1 text-center text-xs whitespace-nowrap">
                        {displayText}
                      </div>
                    )}
                    {showFillHandle && (
                      <div
                        data-fill-handle="true"
                        className="absolute -right-[4px] -bottom-[4px] z-20 h-[8px] w-[8px] cursor-crosshair border border-white bg-blue-600"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!normalizedSel) return;
                          setFillDrag({
                            source: normalizedSel,
                            current: { row: rowIdx, col: colIdx },
                          });
                        }}
                      />
                    )}
                  </td>
                );
              })}
              {hasRowControls && (
                <td className="sticky right-0 z-10 border border-zinc-200 bg-white px-2 py-1 text-center dark:border-zinc-700 dark:bg-zinc-950">
                  <button
                    onClick={() => onMemberDelete(member.id)}
                    className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    title="Remove row"
                  >
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
          {/* Summary rows */}
          {monthlyData && monthlyData.length > 0 && (
            <>
              <tr>
                <td className="sticky left-0 z-10 border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-900">
                  Monthly Cost
                </td>
                {months.map((month, colIdx) => {
                  const md = monthlyData.find((d) => d.month === month);
                  return (
                    <td
                      key={`cost-${month}`}
                      className="border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-xs font-medium whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      {md ? formatCurrency(md.cost) : ''}
                    </td>
                  );
                })}
                {hasRowControls && (
                  <td className="sticky right-0 z-10 border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900" />
                )}
              </tr>
              <tr>
                <td className="sticky left-0 z-10 border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-900">
                  Monthly Hours
                </td>
                {months.map((month) => {
                  const md = monthlyData.find((d) => d.month === month);
                  return (
                    <td
                      key={`hours-${month}`}
                      className="border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-xs font-medium whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      {md ? Math.round(md.hours) : ''}
                    </td>
                  );
                })}
                {hasRowControls && (
                  <td className="sticky right-0 z-10 border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900" />
                )}
              </tr>
            </>
          )}
          {/* Add row */}
          {hasRowControls && (
            <tr>
              {addingRow ? (
                <>
                  <td
                    className="sticky left-0 z-10 border border-zinc-200 bg-white px-1 py-1 dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <div className="flex flex-col gap-1">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full rounded border border-zinc-300 px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      <div className="flex gap-1">
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          className="flex-1 rounded border border-zinc-300 px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="">Role...</option>
                          {laborRates.map((lr) => (
                            <option key={lr.role} value={lr.role}>
                              {lr.role}
                            </option>
                          ))}
                        </select>
                        <select
                          value={newType}
                          onChange={(e) => setNewType(e.target.value as 'Core' | 'Extended')}
                          className="rounded border border-zinc-300 px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="Core">Core</option>
                          <option value="Extended">Ext</option>
                        </select>
                      </div>
                    </div>
                  </td>
                  <td
                    colSpan={months.length}
                    className="border border-zinc-200 px-2 py-1 dark:border-zinc-700"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddRow}
                        disabled={!newName.trim() || !newRole}
                        className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700 disabled:opacity-40"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setAddingRow(false);
                          setNewName('');
                          setNewRole('');
                          setNewType('Core');
                        }}
                        className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                  <td className="sticky right-0 z-10 border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950" />
                </>
              ) : (
                <>
                  <td
                    className="sticky left-0 z-10 border border-zinc-200 bg-white px-3 py-1 dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <button
                      onClick={() => setAddingRow(true)}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      + Add member
                    </button>
                  </td>
                  <td
                    colSpan={months.length}
                    className="border border-zinc-200 dark:border-zinc-700"
                  />
                  <td className="sticky right-0 z-10 border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950" />
                </>
              )}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
