import type { TeamMember } from '@/types/domain';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { getAllocation } from '@/lib/calc/allocationMap';
import type { CellCoord, SelectionRange, FillDragState } from '../lib/gridHelpers';
import {
  isCellInRange,
  getAllocationColor,
  isCellInFillPreview,
} from '../lib/gridHelpers';

interface AllocationGridRowProps {
  member: TeamMember;
  rowIdx: number;
  months: string[];
  allocationMap: AllocationMap;
  readonly: boolean;
  hasRowControls: boolean;
  normalizedSel: SelectionRange | null;
  editingCell: CellCoord | null;
  focusedCell: CellCoord | null;
  fillDrag: FillDragState | null;
  fillHandleRow: number | null;
  fillHandleCol: number | null;
  inputValue: string;
  teamMembers: TeamMember[];
  onInputChange: (value: string) => void;
  onCellCommitEdit: () => void;
  onCellMouseDown: (rowIdx: number, colIdx: number, shiftKey: boolean) => void;
  onCellMouseEnter: (rowIdx: number, colIdx: number) => void;
  onCellDoubleClick: (rowIdx: number, colIdx: number, pctValue: number) => void;
  onFillHandleMouseDown: (rowIdx: number, colIdx: number, normalizedSel: SelectionRange) => void;
  onDeleteClick: (id: string) => void;
  // Drag reorder
  isDragging: boolean;
  isDragOver: boolean;
  dragHandlers: {
    onDragOver?: (e: React.DragEvent) => void;
    onDragEnter?: () => void;
    onDragLeave?: () => void;
    onDrop?: (e: React.DragEvent) => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
  };
  canReorder: boolean;
}

export function AllocationGridRow({
  member,
  rowIdx,
  months,
  allocationMap,
  readonly,
  hasRowControls,
  normalizedSel,
  editingCell,
  focusedCell,
  fillDrag,
  fillHandleRow,
  fillHandleCol,
  inputValue,
  teamMembers,
  onInputChange,
  onCellCommitEdit,
  onCellMouseDown,
  onCellMouseEnter,
  onCellDoubleClick,
  onFillHandleMouseDown,
  onDeleteClick,
  isDragging,
  isDragOver,
  dragHandlers,
  canReorder,
}: AllocationGridRowProps) {
  return (
    <tr
      className={`${isDragging ? 'opacity-40' : ''}${isDragOver ? ' bg-blue-50 dark:bg-blue-950' : ''}`}
      onDragOver={dragHandlers.onDragOver}
      onDragEnter={dragHandlers.onDragEnter}
      onDragLeave={dragHandlers.onDragLeave}
      onDrop={dragHandlers.onDrop}
    >
      <td className="sticky left-0 z-10 border border-zinc-200 bg-white px-1 py-1 dark:border-zinc-700 dark:bg-zinc-950">
        <div className="flex items-center gap-1 px-1 text-sm font-medium whitespace-nowrap">
          {hasRowControls && canReorder && (
            <div
              draggable
              onDragStart={dragHandlers.onDragStart}
              onDragEnd={dragHandlers.onDragEnd}
              className="cursor-grab text-zinc-400 hover:text-zinc-600 active:cursor-grabbing dark:text-zinc-500 dark:hover:text-zinc-300"
              title="Drag to reorder"
              aria-label={`Drag ${member.name} to reorder`}
            >
              ⠿
            </div>
          )}
          <span>
            {member.name}
            <span className="ml-1 text-zinc-400">({member.role})</span>
          </span>
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

        const needsElevation = (isSelected || isFocused) && !isEditing;
        let cellClasses =
          `relative border border-zinc-200 p-0 dark:border-zinc-700${needsElevation ? ' z-20' : ''}`;

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
              className={`border border-zinc-200 px-2 py-1 text-center text-sm dark:border-zinc-700 ${getAllocationColor(value)}`}
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
              onCellMouseDown(rowIdx, colIdx, e.shiftKey);
            }}
            onMouseEnter={() => onCellMouseEnter(rowIdx, colIdx)}
            onDoubleClick={() => onCellDoubleClick(rowIdx, colIdx, pctValue)}
          >
            {isEditing ? (
              <input
                type="text"
                autoFocus
                data-grid-input="true"
                value={inputValue}
                onChange={(e) => onInputChange(e.target.value)}
                onBlur={onCellCommitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') return;
                }}
                className="absolute inset-0 z-10 bg-white text-center text-sm outline-none dark:bg-zinc-950"
              />
            ) : (
              <div className="px-2 py-1 text-center text-sm whitespace-nowrap">
                {displayText}
              </div>
            )}
            {showFillHandle && normalizedSel && (
              <div
                data-fill-handle="true"
                className="absolute -right-[4px] -bottom-[4px] z-20 h-[8px] w-[8px] cursor-crosshair border border-white bg-blue-600"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onFillHandleMouseDown(rowIdx, colIdx, normalizedSel);
                }}
              />
            )}
          </td>
        );
      })}
      {hasRowControls && (
        <td className="sticky right-0 z-10 border border-zinc-200 bg-white px-2 py-1 text-center dark:border-zinc-700 dark:bg-zinc-950">
          <button
            onClick={() => onDeleteClick(member.id)}
            className="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            title="Remove row"
          >
            ✕
          </button>
        </td>
      )}
    </tr>
  );
}
