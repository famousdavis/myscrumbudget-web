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
  /**
   * Whether the open editor selects its contents on focus. Set at the OPEN SITE
   * (see AllocationGrid) - it is not derivable from `inputValue`, because a
   * pre-filled 7% cell and a digit-opened seed of 7 are byte-identical.
   */
  selectOnEditorOpen: boolean;
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
  selectOnEditorOpen,
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

  /*
   * A pre-filled editor selects its value, so the first keystroke REPLACES it -
   * double-click a 50% cell, type 75, get 75%. Without this the caret sat at the
   * end and you got "5075", which commitEdit clamped to 100% with nothing on
   * screen to say so.
   *
   * ⚠️ CONDITIONAL, NOT UNCONDITIONAL. The grid also opens this editor when the
   * user types a DIGIT at a focused cell, seeding it with that digit; selecting
   * the seed makes the next keystroke replace it, so "75" becomes "5". That
   * regression is pinned by the digit-open test in AllocationGridEditor.test.tsx.
   *
   * `currentTarget`, matching 2 of the 3 existing select-on-focus sites
   * (ReforecastToolbar.tsx, HistoricalCostsTable.tsx). ⚠️ None of those fields
   * can be opened by typing, so the precedent does not cover the case above.
   *
   * Declared here rather than inline in the months.map arrow below: that arrow
   * is one of the 13 accepted cognitive-complexity findings, and a branch does
   * not belong inside it.
   */
  const handleEditorFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (selectOnEditorOpen) e.currentTarget.select();
  };

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
           * The preview is a NEUTRAL dashed OUTLINE, and both words are load-bearing.
           *
           * OUTLINE, not a background: the tint this replaced at v0.37.18 was a
           * member of the data ramp and asserted an allocation the cell did not
           * have (see the comment above getAllocationColor).
           *
           * NEUTRAL, not blue: at v0.37.18 the dash was `outline-blue-500`, the
           * SELECTION's own colour, so mid-drag the selected source and the
           * previewed destinations differed by dash pattern alone (measured on
           * `next start`: distance 0) and the user read the selection as lost.
           * Zinc is in neither the allocation ramp nor the selection, so it
           * collides with neither. Measured 2026-09-04 on RENDERED colours -
           * Tailwind v4 emits lab(), so read the cell, never the hex you remember:
           * minimum across all 12 band x theme cells 167 (dark 51-75%); against
           * the selection 173 light / 148 dark. The bar is 100.
           *
           * NO RING. v0.37.18 sat its blue dash on a ground-coloured `ring-[3px]`
           * because blue-on-blue collapsed (41 on the dark 100% cell). A neutral
           * dash collapses on no band, so the ring has nothing left to carry, and
           * removing it returns 91.6% of the cell's own colour (75.7% with it). Do
           * not re-add it "for safety": it costs data colour and buys no contrast.
           *
           * This per-theme ZINC pair is not the per-theme BLUE pair v0.37.18
           * declined. That one (blue-600 / blue-400) worked only because those
           * tokens sit at the ramp's two ends, so it preserved the very coupling
           * the change existed to remove; zinc is coupled to nothing that can
           * move. Both halves ARE load-bearing, though: zinc-600 alone scores 75
           * on dark 1-25%, zinc-400 alone 95 on light 76-99%, neither clears 100.
           *
           * If you rename either token, check the BUILT CSS emits it. A mistyped
           * outline token does not render transparent - outline-color falls back
           * to `currentcolor`, the TEXT colour, which looks like a deliberate dark
           * outline. This string was verified by grepping the built CSS for both
           * classes and asserting the computed outlineColor is the zinc lab().
           */
          cellClasses +=
            ' outline-2 outline-dashed outline-zinc-600 dark:outline-zinc-400 -outline-offset-1';
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
             * Styling is not identity, and v0.37.18 showed a class-based key does
             * not merely age badly - it BREAKS: for that one release the preview
             * and the selection both carried `outline-blue-500`, and that test
             * selects a cell and releases the mouse BEFORE grabbing the fill
             * handle, so the drag SOURCE stays selected - a class-keyed preview
             * helper matched it and failed `toBe(0)`. v0.37.19 gave the two
             * indicators different tokens; the attributes stay so that the next
             * restyle cannot disarm the guards by accident. Keep BOTH helpers on
             * attributes. (Measured 2026-09-04.)
             */
            data-selected={showsSelectionOutline || undefined}
            data-fill-preview={isInFillPreview || undefined}
            onMouseDown={(e) => {
              /*
               * ⚠️ THIS GUARD IS CURRENTLY UNREACHABLE, AND IT IS KEPT ON PURPOSE.
               *
               * The fill handle's own onMouseDown calls e.stopPropagation(), so
               * React never dispatches to this handler for a press on the handle
               * and this line has never once returned early.
               *
               * TWO SEPARATE CLAIMS, TWO SEPARATE INSTRUMENTS - do not let either
               * stand for the other (measured 2026-09-06 at 35b1e8b):
               *   UNREACHABLE - an instrumented build recorded every entry to this
               *     handler. A press on a plain cell logs `td-entered tag=TD`; a
               *     press on the handle logs NOTHING AT ALL. The early return never
               *     fires.
               *   UNTESTED - deleting this line outright leaves 1621 of 1621 tests
               *     passing. That says nothing is watching it; it does NOT say it is
               *     dead, and a reader who sees only this number may think it covered.
               *
               * ⚠️ IT IS UNREACHABLE ONLY BECAUSE A SIBLING CALLS stopPropagation.
               * That is a precondition, not a property of this line. Delete the
               * stopPropagation below and this guard is what stops a handle press
               * from collapsing the selection instead of starting a fill - and it
               * does so SILENTLY: that mutation alone fails 0 of 1621 tests. The
               * guard is load-bearing exactly when nothing reports that it is.
               *
               * ⚠️ Removing BOTH is caught, but only incidentally, and the failure
               * points somewhere else: 1 test fails - `a cancelled fill leaves the
               * selection byte-identical - orientation included`, asserting
               * "shift-extension still runs from the original anchor: expected 9 to
               * be 4". That is a v0.37.20 test about a shift-click ANCHOR; its
               * message names neither this guard nor the fill handle, because what
               * it actually sees is handleCellMouseDown moving selection.startRow /
               * startCol to the handle's own cell. A reader who trips it will not be
               * led back here. (An earlier draft of this comment claimed no test
               * would report it at all; measured 2026-09-06, that was wrong, and it
               * is corrected rather than left standing.)
               */
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
                onFocus={handleEditorFocus}
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
                 * The vertical overhang is kept - nothing sticky sits below a row,
                 * so it occludes nothing - and WI-5b widened it from -bottom-[4px] to
                 * -bottom-[8px]. (Corrected here rather than left standing: this line
                 * named the old value, and a comment asserting a dead figure is the
                 * v0.36.2 defect.)
                 *
                 * ⚠️ THAT z-[25] STILL WINS, AND WI-5b MEASURED WHAT IT COSTS.
                 * Every earlier measurement of this interaction was taken with the
                 * grid scrolled FULLY RIGHT, where the last month column is merely
                 * ADJACENT to the pinned column and the overlap is literally zero
                 * (1379.82 == 1379.82) - so they all concluded the sticky column no
                 * longer occludes anything. Force an overlap instead, by scrolling a
                 * selected cell 9.49 px under it, and the old 8x8 handle measures
                 * 0 of 64 pixels hittable: completely unreachable. A probe that
                 * cannot produce the phenomenon returns the answer that ends the
                 * work. (Measured 2026-09-06; 16 px wide takes it to 112 of 256.)
                 */
                /*
                 * ⚠️ THIS ELEMENT IS THE 16x16 HIT BOX. THE BLUE SQUARE IS ITS CHILD.
                 *
                 * The handle used to be a single 8x8 div - 64 px² to the pointer and,
                 * because box-sizing is border-box and the border is 1 px of white,
                 * only a 6x6 = 36 px² blue core to the eye. Two operators missed it
                 * while actively trying: the owner in normal use, and an instrumented
                 * real-pointer drag during v0.37.20 debugging, whose miss was read as
                 * "the bug does not reproduce". Measured 2026-09-06: hit area is now
                 * 64 -> 256 px², 256/256 of them owned by this element.
                 *
                 * ⚠️⚠️ WHAT MAKES THE PADDING LIVE IS THAT *THIS* ELEMENT CARRIES THE
                 * onMouseDown HANDLER - NOT that it carries data-fill-handle.
                 * Move the handler onto the blue child and the padding goes inert:
                 * a press on it has e.target = this div, the <td> handler above runs
                 * and COLLAPSES THE SELECTION, and the enlargement appears to do
                 * nothing. Measured, both halves: a bare child of the <td> reaches
                 * that handler, and closest('[data-fill-handle]') from a bare wrapper
                 * returns FALSE - closest() walks self-and-ancestors, never
                 * descendants, so putting the attribute on the child cannot rescue it.
                 *
                 * ⚠️ PAD LEFT AND DOWN ONLY; NEVER RIGHT. right-0 is load-bearing.
                 * Rightward pad is lost 1:1 under the sticky ✕ column (z-[25] beats
                 * this cell's z-20 - see the note below) and steals the right
                 * neighbour for nothing. The leftward pad is what pays: with a
                 * selected cell scrolled 9.49 px under that pinned column, the old
                 * 8x8 box measured 0 of 64 pixels hittable - COMPLETELY UNREACHABLE -
                 * and 16 px wide takes it to 112 of 256.
                 *
                 * Width is capped by the number, not by the row: 16 px leaves 5.49 px
                 * clear of a "100%" glyph box, 20 px leaves 1.49 px.
                 */
                className="absolute right-0 -bottom-[8px] z-20 h-[16px] w-[16px] cursor-crosshair"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onFillHandleMouseDown(rowIdx, colIdx, normalizedSel);
                }}
              >
                {/*
                 * The visible core, unchanged at 8x8 and still anchored to the cell's
                 * bottom-right corner: the box grew around it, so nothing moved on
                 * screen. pointer-events-none keeps e.target equal to the padded box
                 * for every press inside it, so hit tests and the six
                 * querySelector('[data-fill-handle]') sites in the suite all resolve
                 * the element that actually handles the press.
                 */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute right-0 bottom-[4px] h-[8px] w-[8px] border border-white bg-blue-600"
                />
              </div>
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
