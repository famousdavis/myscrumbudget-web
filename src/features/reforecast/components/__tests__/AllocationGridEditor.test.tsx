// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/*
 * WI-5a — the allocation-grid editor behaves like a spreadsheet cell.
 *
 * ⚠️ A SEPARATE FILE, like AllocationGridPointer.test.tsx and for the same
 * reason: this is a different concern (what the EDITOR does once it is open),
 * and appending to a file is how a block lands outside the scope that makes the
 * rest of the file work.
 *
 * ⚠️ TWO DEFECTS SHIP TOGETHER AND THEY ARE NOT INDEPENDENT. Select-on-focus
 * makes a SINGLE Backspace empty the editor (the input's onKeyDown guards only
 * Enter/Escape, and useGridKeyboard's `if (editingCell)` branch handles only
 * Enter/Escape/Tab before returning, so Backspace falls through to the browser
 * default and deletes the selected range). Before this release, an empty editor
 * committed NOTHING - `parseFloat('') === NaN` fails `Number.isFinite`. Shipping
 * item 1 alone therefore makes item 2's defect EASIER to hit, on the keystroke
 * select-on-focus exists to make natural.
 *
 * ⚠️⚠️ `typeInto` IS NOT SELF-ASSERTING, AND THE DISTINCTION IS THE WHOLE
 * INSTRUMENT. jsdom performs no default text insertion on keydown - measured at
 * HEAD: digit-open seeds '7', a further `keydown 5` leaves the value '7'. So a
 * jsdom test cannot type. What `typeInto` models is the BROWSER's universal
 * insert-at-selection rule, and it READS selectionStart/selectionEnd from the
 * DOM - it never writes them before an insert. The result ("75" vs "5075") is
 * therefore derived entirely from the production selection state, which is the
 * thing under test. The version this file deliberately does NOT use is
 * `fireEvent.change(input, '75')`, which would make the test supply the answer.
 *
 * ⚠️ THE `<td>`'s textContent IS USELESS AS AN OUTCOME INSTRUMENT HERE, measured
 * rather than assumed: `allocationMap` is a fixed prop in this harness, so the
 * parent never re-renders from onAllocationChange and the cell reads "50%" after
 * EVERY commit - including the ones that wrote nothing at all. And a cell whose
 * editor is open reads "" because the <input> carries no text, which looks
 * exactly like an emptied cell. Every outcome assertion below is on
 * onAllocationChange; "the editor closed" is asserted on the input's absence.
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
];
/** (0,0) holds 50% - two characters. (0,1) holds 5% - ONE character, criterion 3. */
const MAP: AllocationMap = new Map([
  ['2026-01', new Map([['tm-alice', 0.5]])],
  ['2026-02', new Map([['tm-alice', 0.05]])],
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

/** The open editor, or null. Keyed on the data attribute the grid itself uses. */
function editor(container: HTMLElement): HTMLInputElement | null {
  return container.querySelector('input[data-grid-input]');
}

function openByDoubleClick(container: HTMLElement, row: number, col: number) {
  fireEvent.doubleClick(cellAt(container, row, col));
}

function openByEnter(container: HTMLElement, row: number, col: number) {
  fireEvent.mouseDown(cellAt(container, row, col));
  fireEvent.mouseUp(window); // end the range-select the mousedown started
  fireEvent.keyDown(document.body, { key: 'Enter' });
}

function openByDigit(container: HTMLElement, row: number, col: number, digit: string) {
  fireEvent.mouseDown(cellAt(container, row, col));
  fireEvent.mouseUp(window);
  fireEvent.keyDown(document.body, { key: digit });
}

/** `${selectionStart}/${selectionEnd}` of the open editor - "0/2" means all selected. */
function selectionOf(container: HTMLElement): string {
  const i = editor(container)!;
  return `${i.selectionStart}/${i.selectionEnd}`;
}

/**
 * Types `text` one character at a time, each character replacing whatever the
 * editor currently has SELECTED - the browser's own rule. See the file header
 * for why this is an instrument and not a workaround.
 */
function typeInto(container: HTMLElement, text: string) {
  for (const ch of text) {
    const i = editor(container)!;
    const start = i.selectionStart ?? i.value.length;
    const end = i.selectionEnd ?? i.value.length;
    fireEvent.change(i, { target: { value: i.value.slice(0, start) + ch + i.value.slice(end) } });
    /*
     * A browser leaves the caret collapsed after the inserted character. jsdom
     * puts it at the end of the new value on assignment, which is the same place
     * only when you type at the end - so set it explicitly.
     *
     * ⚠️ MEASURED, NOT ASSUMED, AND IT IS NOT LOAD-BEARING HERE: deleting this
     * line leaves the failing set at HEAD byte-identical (8 and 8, both lists
     * asserted non-empty before the diff). Every insert in this file happens to
     * land at the end of the new value, where jsdom's own rule agrees. It stays
     * because it is what a browser does, and the first insert over a SELECTION
     * is where the two rules could diverge.
     */
    editor(container)!.setSelectionRange(start + ch.length, start + ch.length);
  }
}

/** Commits through the editor's own key path: the event bubbles to useGridKeyboard. */
function commitWithEnter(container: HTMLElement) {
  fireEvent.keyDown(editor(container)!, { key: 'Enter' });
}

describe('AllocationGrid — editor behaviour', () => {
  // ───────────── item 1: the editor selects a pre-filled value ─────────────

  it('[1a] double-clicking a 50% cell and typing 75 commits 75%, not 100%', () => {
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    openByDoubleClick(container, 0, 0);
    expect(editor(container)!.value, 'precondition: the editor opened pre-filled from the cell').toBe('50');

    typeInto(container, '75');
    commitWithEnter(container);

    expect(onChange.mock.calls, 'typing over a selected 50 must write 75%, not append to it (5075 -> clamped 100%)')
      .toEqual([['tm-alice', '2026-01', 0.75]]);
  });

  it('[1a-mechanism] a double-click selects the pre-filled value', () => {
    const { container } = render(<AllocationGrid {...gridProps(vi.fn())} />);
    openByDoubleClick(container, 0, 0);
    expect(selectionOf(container), 'double-click must select the whole pre-filled value').toBe('0/2');
  });

  it('[1b] Enter-opening a 50% cell and typing 75 commits 75%, not 100%', () => {
    /*
     * 1a and 1b are a PAIR and must not be collapsed. The flag has to be set at
     * three open sites, two of them inside useGridKeyboard - an implementation
     * that does the hook alone passes 1b and still ships a double-click that
     * does not select.
     */
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    openByEnter(container, 0, 0);
    expect(editor(container)!.value, 'precondition: the editor opened pre-filled from the cell').toBe('50');

    typeInto(container, '75');
    commitWithEnter(container);

    expect(onChange.mock.calls, 'Enter-open must select too').toEqual([['tm-alice', '2026-01', 0.75]]);
  });

  it('[1b-mechanism] Enter-open selects the pre-filled value', () => {
    const { container } = render(<AllocationGrid {...gridProps(vi.fn())} />);
    openByEnter(container, 0, 0);
    expect(selectionOf(container), 'Enter-open must select the whole pre-filled value').toBe('0/2');
  });

  it('[3] a ONE-CHARACTER pre-filled value selects on open, on both paths', () => {
    /*
     * The boundary that rules out inferring "pre-filled" from the value's
     * length: a legitimate 5% cell holds a one-character "5", exactly like a
     * digit-open seed, and must still select. Measured at HEAD: Enter-open on
     * this cell gives 1/1 - nothing selected - so this is [FAILS-TODAY], not a
     * regression guard.
     */
    const a = render(<AllocationGrid {...gridProps(vi.fn())} />);
    openByDoubleClick(a.container, 0, 1);
    expect(editor(a.container)!.value, 'precondition: a one-character pre-filled value').toBe('5');
    expect(selectionOf(a.container), 'double-click on a 5% cell must select its single character').toBe('0/1');
    a.unmount();

    const b = render(<AllocationGrid {...gridProps(vi.fn())} />);
    openByEnter(b.container, 0, 1);
    expect(selectionOf(b.container), 'Enter-open on a 5% cell must select its single character').toBe('0/1');
    b.unmount();
  });

  it('[2-mechanism] a DIGIT-opened editor leaves its seed UNSELECTED', () => {
    /*
     * ⚠️ THE REGRESSION AN UNCONDITIONAL onFocus={e => e.currentTarget.select()}
     * SHIPS. The grid opens its editor when you type a digit at a focused cell,
     * seeding inputValue with that digit; selecting it means the NEXT keystroke
     * REPLACES it, so "75" becomes "5".
     *
     * ⚠️ This is the jsdom half of criterion 2 and it asserts the CARET, not the
     * typed result. jsdom performs no default text insertion on keydown
     * (measured: seed '7', then keydown '5', value still '7'), so the OUTCOME is
     * browser-only. Driving the second digit with fireEvent.change('75') would
     * make the test supply its own answer.
     *
     * ⚠️ AND THE SEED CANNOT BE TOLD FROM A PRE-FILLED VALUE BY INSPECTION: a 7%
     * cell seeds '7' on Enter-open and '7' on digit-open, byte-identical. Only a
     * flag set at the open site can separate them.
     */
    const { container } = render(<AllocationGrid {...gridProps(vi.fn())} />);
    openByDigit(container, 0, 1, '7'); // the 5% cell: the seed REPLACES the old value
    expect(editor(container)!.value, 'precondition: the digit seeded the editor').toBe('7');
    expect(selectionOf(container), 'a digit-opened seed must stay unselected so the next digit APPENDS').toBe('1/1');
  });

  // ───────────── item 2: an empty editor commits 0 ─────────────

  it('[4] clearing the editor and pressing Enter writes 0 exactly once and closes the editor', () => {
    /*
     * parseFloat('') is NaN, so at HEAD `if (Number.isFinite(raw))` skips the
     * write entirely: there is no way to empty a cell from the editor. A write
     * of 0 is the right value because 0 and empty ARE the same value in this
     * grid - useReforecast.ts:104-108 DELETES the entry when the write is 0.
     */
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    openByDoubleClick(container, 0, 0);
    fireEvent.change(editor(container)!, { target: { value: '' } });
    commitWithEnter(container);

    expect(onChange.mock.calls, 'an emptied editor must write 0 - once').toEqual([['tm-alice', '2026-01', 0]]);
    /*
     * ⚠️ THE CLOSE IS NOT EVIDENCE AND MUST NOT BE READ AS ANY. commitEdit()
     * runs setEditingCell(null) unconditionally, so the editor closes at HEAD
     * too - measured. The discriminator is the single write above.
     */
    expect(editor(container), 'and the editor must close').toBeNull();
  });

  it('[4-whitespace] a whitespace-only editor also writes 0', () => {
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    openByDoubleClick(container, 0, 0);
    fireEvent.change(editor(container)!, { target: { value: '   ' } });
    commitWithEnter(container);

    expect(onChange.mock.calls, 'whitespace is empty').toEqual([['tm-alice', '2026-01', 0]]);
  });

  it('[5a] an editor holding "0" writes 0 - the regression guard', () => {
    /*
     * 0 is the exact value item 2's fix writes, and nothing else pins it. This
     * guards an `if (!raw) skip`-shaped implementation, which would leave the
     * old value standing while looking like it handled the empty case.
     *
     * ⚠️ THE CONTENT IS SET DIRECTLY, NOT TYPED, AND THAT IS WHAT MAKES THIS A
     * REGRESSION GUARD RATHER THAN A SECOND COPY OF [1a]. It passes at HEAD and
     * must keep passing; [5b] is the same criterion driven the way a user
     * drives it, and that one cannot pass at HEAD.
     */
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    openByDoubleClick(container, 0, 0);
    fireEvent.change(editor(container)!, { target: { value: '0' } });
    commitWithEnter(container);

    expect(onChange.mock.calls, 'an explicit 0 must still empty the cell').toEqual([['tm-alice', '2026-01', 0]]);
  });

  it('[5b] TYPING 0 into a 50% cell empties it', () => {
    /*
     * ⚠️ THE SPEC LABELS CRITERION 5 [REGRESSION] AND THAT IS TRUE ONLY OF [5a].
     * Measured at HEAD with the real typing path: the caret sits at 2/2, so the
     * "0" APPENDS - "500" - which parseFloat reads as 500 and commitEdit clamps
     * to 100%. HEAD writes 1, not 0. So this reading is [FAILS-TODAY], and the
     * reason it fails is item 1's defect wearing a different digit.
     *
     * It is kept alongside [5a] because after the fix it is the STRONGER form:
     * it still refuses an `if (!raw) skip` implementation, and it does so
     * through the path a user actually takes.
     */
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    openByDoubleClick(container, 0, 0);
    typeInto(container, '0');
    commitWithEnter(container);

    expect(onChange.mock.calls, 'typing 0 over a selected 50 must empty the cell, not make it 500 -> 100%')
      .toEqual([['tm-alice', '2026-01', 0]]);
  });

  it('[6] a non-numeric entry stays a no-op - a typo must not zero a cell', () => {
    /*
     * ⚠️ THE SCOPE BOUNDARY OF ITEM 2. Only an EMPTY or whitespace-only string
     * becomes 0. parseFloat('abc') is NaN and must remain skipped.
     *
     * ⚠️ ON ITS OWN THIS IS A VACUOUS ABSENCE - it passes just as well against a
     * build where item 2 was never implemented. It is evidence only PAIRED with
     * [4] in this same file: empty writes 0, a typo writes nothing. What makes
     * it load-bearing is the mutation it refuses - widening the empty check to
     * "any non-finite parse" fails exactly this test and nothing else.
     */
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    openByDoubleClick(container, 0, 0);
    fireEvent.change(editor(container)!, { target: { value: 'abc' } });
    commitWithEnter(container);

    expect(onChange.mock.calls, 'a typo must write nothing at all').toEqual([]);
  });

  it('[7] "75%" still commits 75 - the parse stays parseFloat, not Number', () => {
    /*
     * ⚠️⚠️ THE ONLY THING THAT CATCHES THE SEDUCTIVE WRONG FIX. Number('') is 0,
     * so switching parseFloat to Number makes criterion 4 pass with no empty
     * check at all - while silently turning a trailing-% entry (parseFloat -> 75)
     * into Number('75%') -> NaN, a no-op. The criterion this change exists for
     * passes under the wrong implementation; this one does not.
     */
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    openByDoubleClick(container, 0, 0);
    fireEvent.change(editor(container)!, { target: { value: '75%' } });
    commitWithEnter(container);

    expect(onChange.mock.calls, 'parseFloat prefix-parses "75%"; Number does not').toEqual([['tm-alice', '2026-01', 0.75]]);
  });
});
