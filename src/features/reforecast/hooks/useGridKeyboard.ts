// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { useEffect } from 'react';
import type { TeamMember } from '@/types/domain';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { getAllocation } from '@/lib/calc/allocationMap';
import type { CellCoord, SelectionRange } from '../lib/gridHelpers';
import {
  normalizeRange,
  moveCellInDirection,
  moveCellDown,
} from '../lib/gridHelpers';

interface UseGridKeyboardOptions {
  readonly: boolean;
  focusedCell: CellCoord | null;
  editingCell: CellCoord | null;
  selection: SelectionRange | null;
  teamMembers: TeamMember[];
  months: string[];
  allocationMap: AllocationMap;
  onAllocationChange: (memberId: string, month: string, value: number) => void;
  /** Apply many allocation changes as ONE undo entry. REQUIRED, not optional. */
  onAllocationsChange: (changes: { memberId: string; month: string; value: number }[]) => void;
  commitEdit: () => void;
  setFocusedCell: (cell: CellCoord) => void;
  setSelection: (sel: SelectionRange) => void;
  setEditingCell: (cell: CellCoord | null) => void;
  setInputValue: (value: string) => void;
  /**
   * Whether the editor about to open should SELECT its contents on focus.
   *
   * ⚠️ EVERY SITE THAT OPENS THE EDITOR MUST SET THIS, and it cannot be derived
   * from the seed. Measured on a 7% cell: Enter-open seeds '7' and digit-open
   * seeds '7' - byte-identical. There is no signal in the value at any length,
   * so a rule over `inputValue` (its length included: a legitimate 5% cell holds
   * a one-character "5") cannot separate the two paths. The flag is the only
   * mechanism.
   *
   * true  - opened PRE-FILLED from the cell (Enter here, double-click in
   *         AllocationGrid): typing replaces the old value, like a spreadsheet.
   * false - opened by typing a DIGIT: that digit is the user's first keystroke,
   *         and selecting it makes the next one replace it ("75" becomes "5").
   */
  setSelectOnEditorOpen: (value: boolean) => void;
}

/**
 * Registers a global keydown listener for allocation grid navigation.
 * Handles arrow keys, Enter, Escape, Tab, Delete/Backspace, and digit entry.
 */
export function useGridKeyboard({
  readonly,
  focusedCell,
  editingCell,
  selection,
  teamMembers,
  months,
  allocationMap,
  onAllocationChange,
  onAllocationsChange,
  commitEdit,
  setFocusedCell,
  setSelection,
  setEditingCell,
  setInputValue,
  setSelectOnEditorOpen,
}: UseGridKeyboardOptions): void {
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
          setSelectOnEditorOpen(true); // pre-filled from the cell
          setEditingCell(focusedCell);
          setInputValue(pctValue > 0 ? String(pctValue) : '');
          break;
        }
        case 'Delete':
        case 'Backspace': {
          e.preventDefault();
          if (selection) {
            const norm = normalizeRange(selection);
            // ONE batched call: clearing a range is one undo entry, not one per cell.
            const changes: { memberId: string; month: string; value: number }[] = [];
            for (let r = norm.startRow; r <= norm.endRow; r++) {
              for (let c = norm.startCol; c <= norm.endCol; c++) {
                changes.push({ memberId: teamMembers[r].id, month: months[c], value: 0 });
              }
            }
            onAllocationsChange(changes);
          }
          break;
        }
        default:
          if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            setSelectOnEditorOpen(false); // the seed IS the user's first keystroke
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
    onAllocationsChange,
    commitEdit,
    setFocusedCell,
    setSelection,
    setEditingCell,
    setInputValue,
    setSelectOnEditorOpen,
  ]);
}
