// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { TeamMember, LaborRate } from '@/types/domain';
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
  onCellMouseDown: (rowIdx: number, colIdx: number, shiftKey: boolean, button: number) => void;
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
  mutedMonths: Set<string>;
  /**
   * The labor rates currently loaded, used only to flag a member whose role has none.
   *
   * ⚠️ OPTIONAL ON PURPOSE, AND `undefined` IS NOT AN EMPTY LIST. Absent means
   * "settings have not loaded yet", which must never render as "this role has no
   * rate". `projects/[id]/page.tsx` discards `useSettings`' `loading` and renders the
   * grid with no `settings &&` guard (the guard there wraps the Excel panel instead),
   * so `undefined` is a genuine first-render state: in cloud mode the settings and
   * project reads are two racing `getDoc`s. Passing `settings?.laborRates ?? []` —
   * the house pattern used on the Team page — would flash EVERY member red mid-fetch.
   */
  laborRates?: LaborRate[];
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
  mutedMonths,
  laborRates,
}: AllocationGridRowProps) {
  /*
   * ⚠️ THE `UNKNOWN_ROLE` SENTINEL DELIBERATELY HAS NO BRANCH OF ITS OWN. Do not
   * re-add one. `excelImport.ts` assigns the sentinel ONLY when
   * `!settings.laborRates.some(lr => lr.role === r.role)`, so a member carrying it is
   * by construction a member whose role has no rate — this predicate subsumes it in
   * every reachable state. And a sentinel branch would be actively WRONG in one case:
   * once a user adds a labor rate literally named "Unknown", that member's role does
   * have a rate, and not flagging them becomes the correct behaviour. Both cases are
   * pinned in AllocationGrid.test.tsx.
   *
   * `laborRates === undefined` means "not loaded yet" and flags nobody — see the prop.
   */
  const roleHasNoRate =
    laborRates !== undefined && !laborRates.some((r) => r.role === member.role);

  return (
    <tr
      className={`${isDragging ? 'opacity-40' : ''}${isDragOver ? ' bg-blue-50 dark:bg-blue-950' : ''}`}
      onDragOver={dragHandlers.onDragOver}
      onDragEnter={dragHandlers.onDragEnter}
      onDragLeave={dragHandlers.onDragLeave}
      onDrop={dragHandlers.onDrop}
    >
      <td className="sticky left-0 z-[25] border border-zinc-200 bg-white px-1 py-1 dark:border-zinc-700 dark:bg-zinc-950">
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
            <span
              className={`ml-1 ${roleHasNoRate ? 'text-red-600 dark:text-red-400' : 'text-zinc-400'}`}
              title={roleHasNoRate ? 'Role not in labor rates' : undefined}
            >
              ({member.role})
            </span>
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
        const isMuted = mutedMonths.has(month);

        const displayText = pctValue > 0 ? `${pctValue}%` : '';

        const showFillHandle =
          !isEditing &&
          fillHandleRow === rowIdx &&
          fillHandleCol === colIdx &&
          !fillDrag;

        const needsElevation = (isSelected || isFocused) && !isEditing;
        // Named so data-selected below cannot drift from the class it stands for.
        const showsSelectionOutline = isSelected && !isEditing;
        let cellClasses =
          `relative border border-zinc-200 p-0 dark:border-zinc-700${needsElevation ? ' z-20' : ''}`;

        /*
         * The allocation tint is applied to previewed cells TOO; it used to be
         * suppressed for them.
         *
         * The reason is NOT "don't hide the data" - the number is text and never
         * vanishes. It is that this tint is a member of the DATA colour ramp
         * (getAllocationColor), so painting the preview in it made the cell ASSERT
         * AN ALLOCATION IT DOES NOT HAVE. Measured 2026-09-04: against a
         * destination holding 26-50%, the old preview tint sat 3/255 from the
         * cell's own colour in light mode and 17 in dark - invisible, on the
         * commonest value in a resource plan. The indicator below sits outside the
         * ramp and is coupled to nothing.
         */
        cellClasses += isMuted ? '' : ` ${getAllocationColor(value)}`;

        if (showsSelectionOutline) {
          cellClasses +=
            ' outline outline-2 outline-blue-500 -outline-offset-1';
        } else if (isFocused && !isEditing) {
          cellClasses +=
            ' ring-2 ring-blue-400 ring-inset';
        }
        if (isInFillPreview) {
          /*
           * DO NOT "simplify" this to a bare blue outline. Measured across all 12
           * band x theme cells 2026-09-04: outline-blue-500 ALONE scores 51 light /
           * 41 dark on a 100% cell. The ground-coloured inner ring is what carries
           * the contrast (worst case 198/256, minimum 127/141).
           * And no single blue token works: blue-600 IS the dark 100% fill,
           * blue-700 the dark 90%, blue-800 the dark 75%.
           * A per-theme pair (outline-blue-600 dark:outline-blue-400) also passes,
           * at 91, and was REJECTED: it works only because those two happen to sit
           * at the ramp's ends, so it preserves exactly the palette coupling this
           * change exists to remove, and a future palette edit collapses its margin
           * silently. The ring is coupled to the page ground, not to the data.
           */
          cellClasses +=
            ' outline-2 outline-dashed outline-blue-500 -outline-offset-1 ring-[3px] ring-inset ring-white dark:ring-zinc-950';
        }

        const textClasses = isMuted
          ? 'px-2 py-1 text-center text-sm whitespace-nowrap text-zinc-300 dark:text-zinc-600'
          : 'px-2 py-1 text-center text-sm whitespace-nowrap';

        if (readonly) {
          return (
            <td
              key={`${member.id}-${month}`}
              className={`border border-zinc-200 px-2 py-1 text-center text-sm dark:border-zinc-700 ${isMuted ? 'text-zinc-300 dark:text-zinc-600' : getAllocationColor(value)}`}
            >
              {displayText}
            </td>
          );
        }

        return (
          <td
            key={`${member.id}-${month}`}
            className={cellClasses}
            /*
             * These two attributes are what the pointer guards key on, and they are
             * NOT cosmetic. AllocationGridPointer.test.tsx used to find previewed
             * cells by the class `bg-blue-200/60` and selected cells by
             * `outline-blue-500`.
             *
             * A CLASS-BASED re-key does not merely age badly - it BREAKS
             * IMMEDIATELY. That test selects a cell and releases the mouse BEFORE
             * grabbing the fill handle, so the drag SOURCE is selected; the preview
             * indicator and the selection outline now share `outline-blue-500`, so
             * keying the preview helper on the class makes its `toBe(0)` assertion
             * match the still-selected source and fail. Keep BOTH helpers on
             * attributes. (Measured 2026-09-04.)
             */
            data-selected={showsSelectionOutline || undefined}
            data-fill-preview={isInFillPreview || undefined}
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).dataset.fillHandle) return;
              if (isEditing) return;
              onCellMouseDown(rowIdx, colIdx, e.shiftKey, e.button);
            }}
            onMouseEnter={() => onCellMouseEnter(rowIdx, colIdx)}
            onDoubleClick={() => onCellDoubleClick(rowIdx, colIdx, pctValue)}
          >
            {isEditing ? (
              <input
                name="allocationCell"
                aria-label={`Allocation for ${member.name} in ${month}`}
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
              <div className={textClasses}>
                {displayText}
              </div>
            )}
            {showFillHandle && normalizedSel && (
              <div
                data-fill-handle="true"
                /*
                 * The handle no longer overhangs its cell HORIZONTALLY, and that is
                 * a consequence of this release rather than a style choice.
                 *
                 * It used to sit at -right-[4px], straddling the cell border. On the
                 * LAST month column that overhang lies under the sticky action
                 * column, which this release raised from z-10 to z-[25] so that
                 * selected cells scroll UNDER the pinned columns instead of over
                 * them. Measured on `next start` 2026-09-04: 8 of 8 horizontal
                 * pixels of the handle were clickable before, and only 4 after —
                 * the sticky cell also covers one non-overhanging pixel via the
                 * collapsed border.
                 *
                 * ⚠️ RAISING THE HANDLE'S OWN z-index DOES NOT FIX THIS, and that
                 * was measured, not assumed: z-[26] was tried and changed nothing.
                 * The handle's parent <td> is `relative` with z-20 while selected,
                 * which CREATES A STACKING CONTEXT, so the handle's z-index only
                 * orders it against its siblings inside that cell. What competes
                 * with the sticky column is the parent's z-20. The handle cannot be
                 * lifted out without lifting the whole cell, which would undo the
                 * fix above.
                 *
                 * The vertical -bottom-[4px] overhang is kept: nothing sticky sits
                 * below a row, so it occludes nothing.
                 */
                className="absolute right-0 -bottom-[4px] z-20 h-[8px] w-[8px] cursor-crosshair border border-white bg-blue-600"
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
        <td className="sticky right-0 z-[25] border border-zinc-200 bg-white px-2 py-1 text-center dark:border-zinc-700 dark:bg-zinc-950">
          <button
            onClick={() => onDeleteClick(member.id)}
            className="text-sm text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400"
            title="Remove row"
          >
            ✕
          </button>
        </td>
      )}
    </tr>
  );
}
