// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/*
 * WI-4 PR B — pointer and focus guards on the allocation grid.
 *
 * ⚠️ A SEPARATE FILE FROM AllocationGridSelection.test.tsx ON PURPOSE. These are
 * a different concern (pointer/focus events, not selection integrity across data
 * changes), and appending to a file is how a block lands outside the scope that
 * makes the rest of the file work.
 *
 * ⚠️ EVERY CRITERION HERE IS A PAIR, AND THAT IS THE POINT. Each of these guards
 * is a SUPERSET of the fix it implements, so a single-direction test — "the
 * right-click changed nothing" — is an absence that passes just as well against a
 * guard that has broken the feature outright. Each defect assertion is therefore
 * paired with one pinning what must STILL work.
 *
 * ⚠️ The z-index change that ships alongside these is NOT represented here.
 * jsdom applies no Tailwind, so getComputedStyle reports zIndex "auto" and the
 * only thing expressible would be a class-string change-detector. It is verified
 * in a browser instead; see the release notes.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { TeamMember } from '@/types/domain';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { AllocationGrid } from '../AllocationGrid';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const MONTHS = ['2026-01', '2026-02', '2026-03'];
const TEAM: TeamMember[] = [
  { id: 'tm-alice', name: 'Alice', role: 'Developer' },
  { id: 'tm-bob', name: 'Bob', role: 'Developer' },
  { id: 'tm-carmen', name: 'Carmen', role: 'Developer' },
];
const MAP: AllocationMap = new Map([
  ['2026-01', new Map([['tm-alice', 0.5], ['tm-carmen', 0.5]])],
]);

type Change = [string, string, number];
function gridProps(onChange: (...a: Change) => void) {
  return {
    months: MONTHS,
    teamMembers: TEAM,
    allocationMap: MAP,
    onAllocationChange: onChange,
    onMemberDelete: vi.fn(),
    onMemberAdd: vi.fn(),
    pool: [],
  };
}

/** The month cell at (row, col); column 0 of each row is the sticky name cell. */
function cellAt(container: HTMLElement, row: number, col: number): HTMLElement {
  const rows = container.querySelectorAll('tbody tr');
  return rows[row].querySelectorAll('td')[1 + col] as HTMLElement;
}
/*
 * Both helpers key on ATTRIBUTES, never on class strings - see the <td> in
 * AllocationGridRow.tsx for the full reason.
 *
 * The short version: styling is not identity. For one release (v0.37.18) the
 * fill preview and the SELECTION both carried `outline-blue-500`, and these two
 * tests select a cell before grabbing the fill handle, so the drag source is
 * selected throughout - a class-keyed fillPreviewCount would have matched that
 * still-selected source and failed `toBe(0)` outright. v0.37.19 gave the two
 * indicators different tokens; the attributes stay, so the next restyle cannot
 * disarm the guard below by accident either.
 */
function selectedCount(container: HTMLElement): number {
  return container.querySelectorAll('td[data-selected]').length;
}
function fillPreviewCount(container: HTMLElement): number {
  return container.querySelectorAll('td[data-fill-preview]').length;
}

describe('AllocationGrid — pointer and focus guards', () => {
  // ───────────── non-primary mouse buttons ─────────────

  it('a right-click inside a multi-cell selection leaves the selection intact', () => {
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    fireEvent.mouseDown(cellAt(container, 0, 0));
    fireEvent.mouseEnter(cellAt(container, 2, 2)); // 3 x 3
    fireEvent.mouseUp(window);
    expect(selectedCount(container), 'precondition: nine cells selected').toBe(9);

    fireEvent.mouseDown(cellAt(container, 1, 1), { button: 2 });

    expect(selectedCount(container)).toBe(9);
  });

  it('a left-click still moves the selection to the clicked cell', () => {
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    fireEvent.mouseDown(cellAt(container, 0, 0));
    fireEvent.mouseEnter(cellAt(container, 2, 2));
    fireEvent.mouseUp(window);

    fireEvent.mouseDown(cellAt(container, 1, 1), { button: 0 });
    fireEvent.keyDown(document.body, { key: 'Delete' });

    expect(selectedCount(container)).toBe(1);
    expect(onChange.mock.calls).toEqual([['tm-bob', '2026-02', 0]]);
  });

  it('a right-click still commits an open editor', () => {
    // Pins the deliberate choice not to make this a bare early return: dropping
    // the commit would leave it to the input's own onBlur, which is verified in
    // Chromium only, and the click-outside handler no longer covers a right-click
    // on another cell.
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    fireEvent.doubleClick(cellAt(container, 0, 0));
    const input = container.querySelector('input[data-grid-input]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '44' } });

    fireEvent.mouseDown(cellAt(container, 2, 2), { button: 2 });

    expect(onChange.mock.calls).toEqual([['tm-alice', '2026-01', 0.44]]);
  });

  // ───────────── losing the window mid-drag ─────────────

  it('losing the window during a fill drag cancels it without writing', () => {
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    fireEvent.mouseDown(cellAt(container, 0, 0));
    fireEvent.mouseUp(window);
    fireEvent.mouseDown(container.querySelector('[data-fill-handle="true"]') as HTMLElement);
    fireEvent.mouseEnter(cellAt(container, 2, 0));
    expect(fillPreviewCount(container), 'precondition: a fill is previewing').toBeGreaterThan(0);

    fireEvent.blur(window);
    expect(fillPreviewCount(container), 'the preview must be gone').toBe(0);

    fireEvent.mouseUp(window); // released elsewhere, or on returning
    expect(onChange.mock.calls).toEqual([]);
  });

  it('losing the window during a range drag ends the drag but keeps what was selected', () => {
    /*
     * Both directions in one test, because each alone is satisfiable by a build
     * that breaks the other.
     *
     * ⚠️ It must be blurred DURING the drag, not after it. The effect that owns
     * this listener only attaches while a drag is in flight, so blurring a
     * COMPLETED selection exercises no code at all — an earlier version of this
     * test did exactly that and passed against a deliberately broken build. The
     * completed case is safe by construction and needs no test.
     */
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    fireEvent.mouseDown(cellAt(container, 0, 0));
    fireEvent.mouseEnter(cellAt(container, 0, 1)); // still dragging
    expect(selectedCount(container), 'precondition: two cells selected').toBe(2);

    fireEvent.blur(window);

    // Kept: alt-tabbing away must not cost the user the selection they made.
    expect(selectedCount(container), 'the selection must survive the blur').toBe(2);
    // Ended: without this the drag stays live, and moving over cells with no
    // button held keeps extending it — measured at v0.37.14, two cells became nine.
    fireEvent.mouseEnter(cellAt(container, 2, 2));
    expect(selectedCount(container), 'the drag must have ended').toBe(2);

    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(onChange.mock.calls).toEqual([
      ['tm-alice', '2026-01', 0],
      ['tm-alice', '2026-02', 0],
    ]);
  });

  // ───────────── focus reaching the table from a descendant ─────────────

  it('focusing a control inside the grid does not select a cell', () => {
    // focusin bubbles, so a row's remove button used to select cell (0,0) — and a
    // Delete pressed after that wrote to a cell the user never chose.
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    const removeButton = container
      .querySelectorAll('tbody tr')[1]
      .querySelector('button[title="Remove row"]') as HTMLElement;

    fireEvent.focus(removeButton);

    expect(selectedCount(container)).toBe(0);
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(onChange.mock.calls).toEqual([]);
  });

  it('focusing the grid itself still selects the first cell', () => {
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);

    fireEvent.focus(container.querySelector('table') as HTMLElement);

    expect(selectedCount(container)).toBe(1);
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(onChange.mock.calls).toEqual([['tm-alice', '2026-01', 0]]);
  });
  // ───────────── WI-18: the fill-preview indicator ─────────────

  /*
   * v0.37.18. The preview used to be a background tint drawn from the SAME colour
   * ramp that encodes allocation, so against a destination holding 26-50% it sat
   * 3/255 from the cell's own colour in light mode and 17 in dark - invisible.
   *
   * ⚠️ THE COLOUR CLAIMS ARE NOT TESTABLE HERE and are not attempted: jsdom
   * applies no Tailwind, so getComputedStyle reports nothing useful and any
   * assertion would be a class-string change-detector wearing a contrast
   * argument. Those are measured in a browser; see the release notes. What is
   * pinned here is the STRUCTURE that measurement rests on - the indicator is
   * applied, the allocation colour SURVIVES it, and the guard attributes exist.
   *
   * ⚠️ Carmen's cell (2,0) is the deliberate subject: it holds 0.5, the 26-50%
   * band this item exists for. Bob's (1,0) is previewed too but holds nothing, so
   * it carries no allocation class and could not show a retention failure at all.
   */
  function startFillDrag(container: HTMLElement) {
    fireEvent.mouseDown(cellAt(container, 0, 0));
    fireEvent.mouseUp(window); // completes the selection; (0,0) stays selected
    fireEvent.mouseDown(container.querySelector('[data-fill-handle="true"]') as HTMLElement);
    fireEvent.mouseEnter(cellAt(container, 2, 0)); // fills rows 1-2 of column 0
  }

  it('a previewed cell carries the neutral dashed indicator and an unpreviewed one does not', () => {
    const { container } = render(<AllocationGrid {...gridProps(vi.fn())} />);
    startFillDrag(container);

    const previewed = cellAt(container, 2, 0);
    expect(previewed.className, 'previewed cell must carry the dashed outline')
      .toContain('outline-dashed');
    expect(previewed.className, 'in the neutral light-mode token')
      .toContain('outline-zinc-600');
    expect(previewed.className, 'and the neutral dark-mode token')
      .toContain('dark:outline-zinc-400');
    /*
     * v0.37.18 sat the dash on a ground-coloured ring-[3px] because a BLUE dash
     * collapsed on the filled bands. A neutral dash collapses on no band
     * (measured minimum 167 across all 12 band x theme cells), so the ring is
     * gone - and its absence is pinned, because re-adding it "for safety" costs
     * 16% of the cell's own colour for contrast the dash no longer needs.
     */
    expect(previewed.className, 'the v0.37.18 ring must be gone')
      .not.toContain('ring-[3px]');

    // Paired, per this file's convention: a cell outside the fill region gains neither.
    const untouched = cellAt(container, 0, 1);
    expect(untouched.className).not.toContain('outline-dashed');
    expect(untouched.className).not.toContain('outline-zinc-600');
  });

  it('the preview indicator and the selection indicator use different colour tokens', () => {
    /*
     * v0.37.19. At v0.37.18 the preview was a dashed `outline-blue-500` and the
     * selection a solid `outline-blue-500` - identical colour, identical width,
     * differing by dash pattern alone (measured on `next start`: distance 0).
     * The user read the selection as LOST the moment the fill handle was grabbed.
     * Nothing was lost; it had merely stopped being distinguishable.
     *
     * jsdom cannot measure the colours (no Tailwind), so what is pinned here is
     * the TOKEN DISJOINTNESS the browser measurement rests on: the preview must
     * not wear the selection's colour token, and the selection must be unchanged
     * for the whole drag. The distances are browser-verified; see the release
     * notes.
     */
    const { container } = render(<AllocationGrid {...gridProps(vi.fn())} />);
    startFillDrag(container);

    const previewed = cellAt(container, 2, 0);
    const source = cellAt(container, 0, 0);
    expect(previewed.className, 'the preview must NOT wear the selection colour')
      .not.toContain('outline-blue-500');
    // The selection is unchanged throughout the drag.
    expect(source.className, 'the selected source keeps its solid blue outline mid-drag')
      .toContain('outline outline-2 outline-blue-500');
    expect(source.className, 'and does not become dashed')
      .not.toContain('outline-dashed');
    expect(source.hasAttribute('data-selected'), 'and stays marked selected')
      .toBe(true);
  });

  it('a previewed cell RETAINS its own allocation colour', () => {
    /*
     * Before v0.37.18 the allocation class was SUPPRESSED for previewed cells,
     * which is precisely what let the preview tint assert a value the cell did not
     * have. Carmen holds 0.5 -> bg-blue-100.
     */
    const { container } = render(<AllocationGrid {...gridProps(vi.fn())} />);
    startFillDrag(container);

    expect(cellAt(container, 2, 0).className, 'the 26-50% band class must survive the preview')
      .toContain('bg-blue-100');
    // Paired: the old ramp-member tint is GONE, not merely joined by the outline.
    expect(cellAt(container, 2, 0).className, 'the old ramp-member tint must be gone')
      .not.toContain('bg-blue-200/60');
  });

  it('the guard attributes mark exactly the previewed cells and the selected source', () => {
    const { container } = render(<AllocationGrid {...gridProps(vi.fn())} />);
    startFillDrag(container);

    // Messages are per-assertion on purpose: bare hasAttribute checks all print
    // "expected false to be true", so a break in two of them would be one message.
    expect(cellAt(container, 1, 0).hasAttribute('data-fill-preview'), "Bob's cell (1,0) is previewed")
      .toBe(true);
    expect(cellAt(container, 2, 0).hasAttribute('data-fill-preview'), "Carmen's cell (2,0) is previewed")
      .toBe(true);
    expect(cellAt(container, 0, 1).hasAttribute('data-fill-preview'), 'a cell outside the fill region is not')
      .toBe(false);

    /*
     * data-selected marks the drag SOURCE, which stays selected for the whole
     * gesture - which is why the preview guard is not keyed on a class: at
     * v0.37.18 both states carried `outline-blue-500`, and a class-keyed
     * fillPreviewCount would have matched this cell and failed its `toBe(0)`.
     * The tokens differ since v0.37.19; the attributes are what keep the two
     * states independent of styling either way.
     */
    expect(cellAt(container, 0, 0).hasAttribute('data-selected'), 'the drag source is selected')
      .toBe(true);
    expect(cellAt(container, 0, 0).hasAttribute('data-fill-preview'), 'and is NOT itself previewed')
      .toBe(false);
  });

  // ───────────── WI-18 PR A3: the source is drawn from the drag ─────────────

  /*
   * v0.37.20. Reported in production on two engines: pressing the fill handle
   * made the selected cells' borders vanish while the preview dashes and the
   * copy itself kept working. The copy reads fillDrag.source; the source
   * marking read `selection`. Whatever clears `selection` mid-drag on that
   * machine (not reproduced in this suite or in a local browser), the marking
   * must not depend on it.
   *
   * The clear is driven through the one path the DOM can reach: a mousedown
   * outside the scroll container, which the click-outside effect turns into
   * setSelection(null). It stands in for the unpinned trigger.
   */
  it('clearing the selection mid-drag leaves the source cells marked', () => {
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    startFillDrag(container);
    expect(fillPreviewCount(container), 'precondition: a fill is previewing').toBe(2);
    expect(cellAt(container, 0, 0).hasAttribute('data-selected'), 'precondition: the source is marked')
      .toBe(true);

    fireEvent.mouseDown(document.body); // outside the grid: clears `selection`

    expect(fillPreviewCount(container), 'the drag itself must survive').toBe(2);
    expect(cellAt(container, 0, 0).hasAttribute('data-selected'), 'the source must stay marked while the drag is live')
      .toBe(true);
    expect(cellAt(container, 0, 0).className, 'with its solid blue outline, not the dashed preview')
      .toContain('outline outline-2 outline-blue-500');
  });

  it('after a fill commits, nothing is selected and Delete writes nothing', () => {
    /*
     * v0.37.21. A completed fill leaves the grid with no selection. The reason
     * that decided it is safety, not tidiness: `selection` is what Delete and
     * Backspace act on (useGridKeyboard zeroes the whole normalised range), so
     * a selection left standing after a copy is a live destructive target -
     * finish a fill, come back later, press Delete meaning one cell, lose the
     * whole source range. v0.37.20 restored the selection here; that answered a
     * screenshot of the v0.37.19 defect, not a design gap.
     */
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    startFillDrag(container);
    fireEvent.mouseUp(window); // commits the fill

    expect(onChange.mock.calls, 'the copy itself is unaffected').toEqual([
      ['tm-bob', '2026-01', 0.5],
      ['tm-carmen', '2026-01', 0.5],
    ]);
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(onChange.mock.calls.length, 'Delete after a completed fill must write nothing').toBe(2);
    expect(selectedCount(container), 'no cell is selected after the copy').toBe(0);
    expect(container.querySelectorAll('[data-fill-handle]').length, 'and there is no handle to grab').toBe(0);
  });

  it('after a fill commits, no cell is focused: no focus ring, and the arrow keys have nowhere to resume from', () => {
    /*
     * focusedCell is independent state. Clearing only `selection` would disarm
     * Delete but leave the last cell wearing the ring-2 ring-blue-400 focus
     * ring, which is not "no selected cells whatsoever". The accepted cost is
     * that keyboard navigation restarts from the next click.
     */
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    startFillDrag(container);
    fireEvent.mouseUp(window);

    const ringed = [...container.querySelectorAll('td')].filter((td) => td.className.includes('ring-blue-400'));
    expect(ringed.length, 'no cell wears the focus ring after the copy').toBe(0);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(selectedCount(container), 'an arrow key after the copy selects nothing').toBe(0);
  });

  it('a cancelled fill leaves the selection byte-identical - orientation included', () => {
    /*
     * The cancel path keeps v0.37.20's restore: nothing was copied, so the user
     * is left exactly where they were. "Exactly" includes the range's
     * ORIENTATION: `selection` keeps its anchor in startRow/startCol, and a
     * shift-click extends from that anchor. A restore that wrote the NORMALISED
     * source (fillDrag.source is normalised) would move the anchor to the
     * top-left, which this test can see. The commit path no longer restores at
     * all (v0.37.21) - that difference is deliberate and F3 pins it.
     */
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    // Select 2x2 by dragging from the bottom-right (1,1) UP to (0,0): anchor stays at (1,1).
    fireEvent.mouseDown(cellAt(container, 1, 1));
    fireEvent.mouseEnter(cellAt(container, 0, 0));
    fireEvent.mouseUp(window);
    expect(selectedCount(container), 'precondition: four cells selected').toBe(4);

    // Start a fill from the handle (at the normalised bottom-right, (1,1)) down onto row 2, then cancel it.
    fireEvent.mouseDown(container.querySelector('[data-fill-handle="true"]') as HTMLElement);
    fireEvent.mouseEnter(cellAt(container, 2, 1));
    expect(fillPreviewCount(container), 'precondition: two cells previewing').toBe(2);
    fireEvent.blur(window);

    expect(fillPreviewCount(container), 'the preview is gone').toBe(0);
    expect(onChange.mock.calls, 'nothing was copied').toEqual([]);
    expect(selectedCount(container), 'the 2x2 is still selected').toBe(4);
    // Shift-click (2,2): extending from anchor (1,1) gives a 2x2 = 4 cells;
    // from a normalised anchor (0,0) it would give 3x3 = 9.
    fireEvent.mouseDown(cellAt(container, 2, 2), { shiftKey: true });
    expect(selectedCount(container), 'shift-extension still runs from the original anchor').toBe(4);
  });

  it('a drag cancelled by losing the window, after the selection was cleared, still ends with the source selected', () => {
    const { container } = render(<AllocationGrid {...gridProps(vi.fn())} />);
    startFillDrag(container);
    fireEvent.mouseDown(document.body); // clears `selection` mid-drag
    fireEvent.blur(window);             // cancels the drag

    expect(fillPreviewCount(container), 'the preview is gone').toBe(0);
    expect(selectedCount(container), 'and the source is selected again').toBe(1);
  });

  it('a press whose target unmounts before the click-outside listener runs is not a click outside', () => {
    /*
     * The trigger behind the report, reproduced in production on Brave and
     * Safari and pinned locally with a real pointer. The fill handle's
     * onMouseDown sets fillDrag; showFillHandle includes !fillDrag; so the
     * handle unmounts its OWN event target. On a TRUSTED event the browser runs
     * a microtask checkpoint between listeners and React flushes the update in
     * it, so the grid's document-level click-outside listener receives a
     * DETACHED node - measured {isConnected:false, contains:false,
     * isTrusted:true}, against {isConnected:true, contains:true,
     * isTrusted:false} for the same press dispatched synthetically - and cleared
     * the selection as "outside".
     *
     * ⚠️ jsdom cannot reach that state through the handle: no microtask runs
     * between listeners under fireEvent, and the handle's stopPropagation halts
     * the event at the test container before it reaches document at all (in the
     * app the React root IS document, so the listener runs regardless). What is
     * pinned here is the listener's RULE - a detached target is not outside -
     * with a stand-in: a node inside the scroll container with no React
     * handler, removed by a body-level listener that runs before the grid's
     * document listener. The browser timing is verified with a real pointer;
     * see the release notes.
     */
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    fireEvent.mouseDown(cellAt(container, 0, 0));
    fireEvent.mouseUp(window);
    expect(selectedCount(container), 'precondition: one cell selected').toBe(1);

    const scroller = (container.querySelector('table') as HTMLElement).parentElement as HTMLElement;
    const probe = document.createElement('span');
    scroller.appendChild(probe);
    const detach = () => probe.remove();
    document.body.addEventListener('mousedown', detach);
    try {
      fireEvent.mouseDown(probe);
    } finally {
      document.body.removeEventListener('mousedown', detach);
    }
    expect(probe.isConnected, 'precondition: the target was detached before the document listener ran').toBe(false);
    expect(selectedCount(container), 'a press whose target unmounted is not a click outside: the selection must survive')
      .toBe(1);

    // Paired: a genuine outside press, target still connected, must still clear.
    fireEvent.mouseDown(document.body);
    expect(selectedCount(container), 'a real outside press still clears the selection').toBe(0);
  });

  // ───────────── WI-5b: the fill handle's hit surface ─────────────
  /*
   * ⚠️ WHAT THESE PIN IS THE HANDLER'S HOST, NOT THE ATTRIBUTE'S.
   *
   * The handle is a 16x16 transparent box with an 8x8 painted core inside it.
   * The obvious wrong build is a padded WRAPPER with the handler left on the blue
   * child: it looks identical, and its padding is inert - a press there has
   * e.target = the wrapper, the <td> handler runs, and the selection collapses
   * instead of a fill starting. Measured 2026-09-06, both halves: a bare child of
   * the <td> does reach that handler, and closest('[data-fill-handle]') from such a
   * wrapper returns FALSE, because closest() walks self-and-ancestors and the
   * attribute would be on a DESCENDANT.
   *
   * ⚠️ SO THE 16x16 BOX IS LOCATED BY ITS SIZE, NOT BY data-fill-handle, in the
   * test that presses it. Querying the attribute would find the blue child under
   * that wrong build, press the element that does have the handler, and pass.
   *
   * jsdom has no layout, so nothing here is a hit test; the pixel measurements are
   * in the release notes. These pin the STRUCTURE that makes the pixels reachable.
   */

  it('[FAILS-TODAY] the pressed surface is the padded box, and the painted core is an inert child of it', () => {
    const { container } = render(<AllocationGrid {...gridProps(vi.fn())} />);
    fireEvent.mouseDown(cellAt(container, 0, 0));
    fireEvent.mouseUp(window);

    const hit = container.querySelector('[data-fill-handle]') as HTMLElement;
    expect(hit, 'precondition: selecting a cell renders a fill handle').toBeTruthy();

    expect(hit.className, 'the element that receives the press must be the PADDED box, not the painted core')
      .not.toMatch(/bg-blue-600/);

    const core = hit.querySelector('div');
    expect(core, 'the painted core must be a CHILD of the padded box, so the box can be larger than the paint')
      .toBeTruthy();
    expect((core as HTMLElement).className, 'the core must be inert to the pointer, so e.target is the padded box for every press inside it')
      .toContain('pointer-events-none');
  });

  it('[FAILS-TODAY] pressing the 16x16 box - located by its size, not by the attribute - starts a fill', () => {
    const { container } = render(<AllocationGrid {...gridProps(vi.fn())} />);
    fireEvent.mouseDown(cellAt(container, 0, 0));
    fireEvent.mouseUp(window);
    expect(selectedCount(container), 'precondition: one cell selected').toBe(1);

    const box = [...container.querySelectorAll('div')].find(
      (d) => d.className.includes('h-[16px]') && d.className.includes('w-[16px]'),
    );
    expect(box, 'a 16x16 padded hit box must exist - the enlargement is the whole item').toBeTruthy();

    fireEvent.mouseDown(box as HTMLElement);
    fireEvent.mouseEnter(cellAt(container, 1, 0));

    expect(fillPreviewCount(container), 'pressing the PADDED box must start a fill, not collapse the selection')
      .toBeGreaterThan(0);
  });

  it('[REGRESSION] the visible core is still an 8x8 blue square with a white border', () => {
    const { container } = render(<AllocationGrid {...gridProps(vi.fn())} />);
    fireEvent.mouseDown(cellAt(container, 0, 0));
    fireEvent.mouseUp(window);

    // Located by its PAINT, so this reads the same element before and after WI-5b.
    const core = [...container.querySelectorAll('div')].find((d) => d.className.includes('bg-blue-600'));
    expect(core, 'precondition: a painted core exists').toBeTruthy();
    for (const cls of ['h-[8px]', 'w-[8px]', 'border', 'border-white', 'bg-blue-600']) {
      expect((core as HTMLElement).className, `the visible core must keep "${cls}" - WI-5b enlarges the HIT area only`)
        .toContain(cls);
    }
  });

  it('[REGRESSION] a fill driven from the handle still copies the source value', () => {
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    fireEvent.mouseDown(cellAt(container, 0, 0)); // Alice, 2026-01, 0.5
    fireEvent.mouseUp(window);

    fireEvent.mouseDown(container.querySelector('[data-fill-handle="true"]') as HTMLElement);
    fireEvent.mouseEnter(cellAt(container, 1, 0));
    fireEvent.mouseUp(window);

    expect(onChange, 'the enlargement must not disturb what a fill writes')
      .toHaveBeenCalledWith('tm-bob', '2026-01', 0.5);
  });

  it('[REGRESSION] exactly one element carries data-fill-handle', () => {
    const { container } = render(<AllocationGrid {...gridProps(vi.fn())} />);
    fireEvent.mouseDown(cellAt(container, 0, 0));
    fireEvent.mouseUp(window);

    // Six sites in this suite do querySelector('[data-fill-handle]') and one asserts
    // a count of 0 when no handle is rendered; a second marked element would make
    // "which one did I press?" depend on document order.
    expect(container.querySelectorAll('[data-fill-handle]').length, 'the marker must name exactly one element')
      .toBe(1);
  });
});
