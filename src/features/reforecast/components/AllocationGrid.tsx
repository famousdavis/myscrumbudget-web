'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { TeamMember, PoolMember, MonthlyCalculation, ProductivityWindow } from '@/types/domain';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { getAllocation } from '@/lib/calc/allocationMap';
import { formatMonthLabel } from '@/lib/utils/dates';
import { formatCurrency } from '@/lib/utils/format';
import { getProductivityFactor } from '@/lib/calc/productivity';
import type { CellCoord, SelectionRange, FillDragState } from '../lib/gridHelpers';
import {
  normalizeRange,
  isCellInRange,
  getAllocationColor,
  computeFillRegion,
  isCellInFillPreview,
  moveCellInDirection,
} from '../lib/gridHelpers';

interface AllocationGridProps {
  months: string[];
  teamMembers: TeamMember[];
  allocationMap: AllocationMap;
  onAllocationChange: (memberId: string, month: string, value: number) => void;
  onMemberDelete?: (id: string) => void;
  onMemberAdd?: (poolMemberId: string) => void;
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
  const [selectedPoolId, setSelectedPoolId] = useState('');
  const [focusedCell, setFocusedCell] = useState<CellCoord | null>(null);
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

      // Don't interfere with select dropdowns or non-grid inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'SELECT') return;
      if (target.tagName === 'INPUT' && !target.hasAttribute('data-grid-input')) return;

      if (editingCell) {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitEdit();
          const next = moveCellInDirection(focusedCell, 1, 0, maxRow, maxCol);
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

  const handleAddRow = () => {
    if (!selectedPoolId || !onMemberAdd) return;
    onMemberAdd(selectedPoolId);
    setSelectedPoolId('');
    setAddingRow(false);
  };

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

  const hasRowControls = !readonly && onMemberDelete && onMemberAdd;

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

  if (teamMembers.length === 0 && hasRowControls) {
    return (
      <>
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No team members assigned to this project.
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Add team members from the pool using the control below.
          </p>
        </div>
        <div className="mt-4">
          {addingRow ? (
            <div className="flex items-center gap-2">
              <select
                autoFocus
                value={selectedPoolId}
                onChange={(e) => setSelectedPoolId(e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Select member...</option>
                {pool.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name} ({pm.role})
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddRow}
                disabled={!selectedPoolId}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setAddingRow(false);
                  setSelectedPoolId('');
                }}
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingRow(true)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              + Add member
            </button>
          )}
        </div>
      </>
    );
  }

  if (teamMembers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No team members assigned to this project.
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Go to the Team page to create a pool, then return here to assign members.
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
        className="border-collapse text-sm select-none"
        tabIndex={0}
        onFocus={() => {
          if (!focusedCell && teamMembers.length > 0 && months.length > 0) {
            setFocusedCell({ row: 0, col: 0 });
            setSelection({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
          }
        }}
      >
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900">
              Team Member
            </th>
            {months.map((month) => {
              const factor = productivityWindows
                ? getProductivityFactor(month, productivityWindows)
                : 1;
              return (
                <th
                  key={month}
                  className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-center text-xs font-medium whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-900"
                  title={
                    factor < 1
                      ? `Productivity: ${Math.round(factor * 100)}% (reduced capacity)`
                      : undefined
                  }
                >
                  <div>{formatMonthLabel(month)}</div>
                  {factor < 1 && (
                    <div className="text-[10px] font-normal text-amber-600 dark:text-amber-400">
                      {Math.round(factor * 100)}%
                    </div>
                  )}
                </th>
              );
            })}
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
                <div className="px-2 text-xs font-medium whitespace-nowrap">
                  {member.name}
                  <span className="ml-1 text-zinc-400">({member.role})</span>
                </div>
              </td>
              {months.map((month, colIdx) => {
                const value = getAllocation(allocationMap, month, member.id);
                const pctValue = value ? Math.round(value * 100) : 0;
                const isEditing =
                  editingCell?.row === rowIdx && editingCell?.col === colIdx;
                const isSelected = isCellInRange(normalizedSel, rowIdx, colIdx);
                const isFocused =
                  focusedCell?.row === rowIdx && focusedCell?.col === colIdx;
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
                } else if (isFocused && !isEditing) {
                  cellClasses +=
                    ' ring-2 ring-blue-400 ring-inset';
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

                      setFocusedCell({ row: rowIdx, col: colIdx });

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
                      setFocusedCell({ row: rowIdx, col: colIdx });
                      setEditingCell({ row: rowIdx, col: colIdx });
                      setInputValue(pctValue > 0 ? String(pctValue) : '');
                    }}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        data-grid-input="true"
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
                {months.map((month) => {
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
                    <select
                      autoFocus
                      value={selectedPoolId}
                      onChange={(e) => setSelectedPoolId(e.target.value)}
                      className="w-full rounded border border-zinc-300 px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="">Select member...</option>
                      {pool.map((pm) => (
                        <option key={pm.id} value={pm.id}>
                          {pm.name} ({pm.role})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    colSpan={months.length}
                    className="border border-zinc-200 px-2 py-1 dark:border-zinc-700"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddRow}
                        disabled={!selectedPoolId}
                        className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700 disabled:opacity-40"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setAddingRow(false);
                          setSelectedPoolId('');
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
