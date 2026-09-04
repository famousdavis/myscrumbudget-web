// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/*
 * WI-4 — grid selection integrity.
 *
 * ⚠️ EVERY TEST HERE IS NEW, NOT A REPAIRED ONE, AND THAT IS STRUCTURAL.
 * AllocationGrid.test.tsx renders the grid 25 times and touches selection zero
 * times: it has no assertion on `onAllocationChange` anywhere and never calls
 * `rerender`, so it can express neither "which member got the write" nor "the
 * roster changed between selecting and acting". Every criterion below needs a
 * stateful host, a re-render, and an assertion on the member id.
 *
 * ⚠️ DO NOT REPHRASE ANY OF THESE AS "Delete writes to the selected member".
 * useGridKeyboard.test.ts already asserts that against a STATIC fixture that never
 * reorders, so it passes with the defect present and any such criterion is
 * vacuous on arrival. What discriminates is a roster or window change BETWEEN
 * selecting and acting.
 *
 * ⚠️ THE TWO THROW SITE CLASSES SURFACE THROUGH DIFFERENT CHANNELS, measured:
 * a throw during render propagates SYNCHRONOUSLY out of `rerender`, while a throw
 * inside a document listener surfaces only as a window `error` event and reaches
 * no test. `capture()` collects both, and the assertions check both — a
 * preventDefault listener with no assertion on what it caught is doubly green.
 */

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { TeamMember } from '@/types/domain';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { AllocationGrid } from '../AllocationGrid';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const MONTHS = ['2026-01', '2026-02', '2026-03'];

const ALICE: TeamMember = { id: 'tm-alice', name: 'Alice', role: 'Developer' };
const BOB: TeamMember = { id: 'tm-bob', name: 'Bob', role: 'Developer' };
const CARMEN: TeamMember = { id: 'tm-carmen', name: 'Carmen', role: 'Developer' };
const DAVE: TeamMember = { id: 'tm-dave', name: 'Dave', role: 'Developer' };

function buildMap(entries: Array<[string, string, number]>): AllocationMap {
  const map: AllocationMap = new Map();
  for (const [month, memberId, value] of entries) {
    if (!map.has(month)) map.set(month, new Map());
    map.get(month)!.set(memberId, value);
  }
  return map;
}
const MAP = buildMap([['2026-01', 'tm-alice', 0.5], ['2026-02', 'tm-alice', 0.75]]);

type Change = [string, string, number];

function gridProps(members: TeamMember[], months: string[], onChange: (...a: Change) => void) {
  return {
    months,
    teamMembers: members,
    allocationMap: MAP,
    onAllocationChange: onChange,
    onMemberDelete: vi.fn(),
    onMemberAdd: vi.fn(),
    pool: [],
  };
}

/** The month cell at (row, col). Column 0 of each row is the sticky name cell. */
function cellAt(container: HTMLElement, row: number, col: number): HTMLElement {
  const rows = container.querySelectorAll('tbody tr');
  return rows[row].querySelectorAll('td')[1 + col] as HTMLElement;
}

function removeButtonInRow(container: HTMLElement, row: number): HTMLElement {
  const rows = container.querySelectorAll('tbody tr');
  return rows[row].querySelector('button[title="Remove row"]') as HTMLElement;
}

/**
 * Runs `fn`, collecting BOTH failure channels: a synchronous throw (render path)
 * and a window `error` event (document-listener path). Callers must assert on the
 * returned values — a listener that swallows errors without asserting is green
 * whatever happens.
 */
function capture(fn: () => void): { errors: string[]; thrown: string | null } {
  const errors: string[] = [];
  const onError = (e: ErrorEvent) => {
    errors.push(String(e.error?.message ?? e.message));
    e.preventDefault();
  };
  window.addEventListener('error', onError);
  let thrown: string | null = null;
  try {
    fn();
  } catch (err) {
    thrown = (err as Error).message;
  }
  window.removeEventListener('error', onError);
  return { errors, thrown };
}

function expectNoFailure(label: string, r: { errors: string[]; thrown: string | null }) {
  expect(r.thrown, `${label}: expected no thrown exception`).toBeNull();
  expect(r.errors, `${label}: expected no uncaught error events`).toEqual([]);
}

/** A host that owns the roster, so a removal through the dialog really shrinks it. */
function StatefulHost({ initial, months, onChange }: {
  initial: TeamMember[];
  months: string[];
  onChange: (...a: Change) => void;
}) {
  const [members, setMembers] = useState<TeamMember[]>(initial);
  return (
    <AllocationGrid
      months={months}
      teamMembers={members}
      allocationMap={MAP}
      onAllocationChange={onChange}
      onMemberDelete={(id) => setMembers((m) => m.filter((x) => x.id !== id))}
      onMemberAdd={vi.fn()}
      pool={[]}
    />
  );
}

describe('AllocationGrid — selection integrity across roster and window changes', () => {
  // ───────────────────────── row axis ─────────────────────────

  it('after a sort, Delete writes to the member that was selected, not the one now in that row', () => {
    // Seeded [Carmen, Bob, Alice] deliberately: sorting [Alice, Bob, Carmen] by name
    // leaves Alice at row 0, where this test would pass with the defect present.
    const onChange = vi.fn();
    const { container, rerender } = render(
      <AllocationGrid {...gridProps([CARMEN, BOB, ALICE], MONTHS, onChange)} />,
    );
    fireEvent.mouseDown(cellAt(container, 2, 2)); // Alice / 2026-03
    rerender(<AllocationGrid {...gridProps([ALICE, BOB, CARMEN], MONTHS, onChange)} />);
    fireEvent.keyDown(document.body, { key: 'Delete' });

    expect(onChange.mock.calls).toEqual([['tm-alice', '2026-03', 0]]);
  });

  it('removing a member through the dialog leaves Delete targeting the still-selected member', () => {
    const onChange = vi.fn();
    const { container } = render(
      <StatefulHost initial={[ALICE, BOB, CARMEN]} months={MONTHS} onChange={onChange} />,
    );
    fireEvent.mouseDown(cellAt(container, 1, 2)); // Bob / 2026-03
    fireEvent.mouseDown(removeButtonInRow(container, 0));
    fireEvent.click(removeButtonInRow(container, 0)); // open the dialog on Alice
    const confirm = screen.getByRole('button', { name: 'Remove' });
    fireEvent.mouseDown(confirm);
    fireEvent.click(confirm);
    fireEvent.keyDown(document.body, { key: 'Delete' });

    expect(onChange.mock.calls).toEqual([['tm-bob', '2026-03', 0]]);
  });

  it('removing the SELECTED member raises no exception and writes nothing', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <AllocationGrid {...gridProps([ALICE, BOB, CARMEN], MONTHS, onChange)} />,
    );
    fireEvent.mouseDown(cellAt(container, 2, 0)); // Carmen / 2026-01
    expectNoFailure('shrink', capture(() =>
      rerender(<AllocationGrid {...gridProps([ALICE, BOB], MONTHS, onChange)} />)));
    expectNoFailure('Delete', capture(() => fireEvent.keyDown(document.body, { key: 'Delete' })));

    expect(onChange.mock.calls).toEqual([]);
  });

  it('removing a DIFFERENT member raises no exception and the write still names the selected member', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <AllocationGrid {...gridProps([ALICE, BOB, CARMEN], MONTHS, onChange)} />,
    );
    fireEvent.mouseDown(cellAt(container, 2, 0)); // Carmen / 2026-01
    expectNoFailure('shrink', capture(() =>
      rerender(<AllocationGrid {...gridProps([BOB, CARMEN], MONTHS, onChange)} />)));
    expectNoFailure('Delete', capture(() => fireEvent.keyDown(document.body, { key: 'Delete' })));

    expect(onChange.mock.calls).toEqual([['tm-carmen', '2026-01', 0]]);
  });

  it('a removal that also reorders the survivors keeps the selection on its own member, and drops it when that member went', () => {
    // Paired deliberately: the second half alone is an absence, satisfied by any
    // build that never writes.
    const kept = vi.fn();
    const a = render(<AllocationGrid {...gridProps([ALICE, BOB, CARMEN], MONTHS, kept)} />);
    fireEvent.mouseDown(cellAt(a.container, 0, 0)); // Alice / 2026-01
    a.rerender(<AllocationGrid {...gridProps([CARMEN, ALICE], MONTHS, kept)} />);
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(kept.mock.calls, 'selected member survived the update').toEqual([['tm-alice', '2026-01', 0]]);

    const gone = vi.fn();
    const b = render(<AllocationGrid {...gridProps([ALICE, BOB, CARMEN], MONTHS, gone)} />);
    fireEvent.mouseDown(cellAt(b.container, 1, 0)); // Bob / 2026-01
    b.rerender(<AllocationGrid {...gridProps([CARMEN, ALICE], MONTHS, gone)} />);
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(gone.mock.calls, 'selected member was removed').toEqual([]);
  });

  // ───────────────────────── column axis ─────────────────────────

  it('after the window narrows, Delete never writes a month outside the current window', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <AllocationGrid {...gridProps([ALICE, BOB], MONTHS, onChange)} />,
    );
    fireEvent.mouseDown(cellAt(container, 1, 2)); // Bob / 2026-03
    rerender(<AllocationGrid {...gridProps([ALICE, BOB], ['2026-01'], onChange)} />);
    fireEvent.keyDown(document.body, { key: 'Delete' });

    for (const [, month] of onChange.mock.calls) {
      expect(['2026-01'], `wrote month ${String(month)}`).toContain(month);
    }
  });

  it('after the window narrows, typing a digit never persists an allocation with an undefined month', () => {
    // The serious half: a non-zero value is APPENDED to rf.allocations, and no cell
    // exists at that column, so nothing is on screen while the user types.
    const onChange = vi.fn();
    const { container, rerender } = render(
      <AllocationGrid {...gridProps([ALICE, BOB], MONTHS, onChange)} />,
    );
    fireEvent.mouseDown(cellAt(container, 1, 2)); // Bob / 2026-03
    rerender(<AllocationGrid {...gridProps([ALICE, BOB], ['2026-01'], onChange)} />);
    fireEvent.keyDown(document.body, { key: '4' });
    fireEvent.keyDown(document.body, { key: 'Enter' });

    for (const [, month] of onChange.mock.calls) {
      expect(typeof month, `wrote month ${String(month)}`).toBe('string');
      expect(['2026-01']).toContain(month);
    }
  });

  it('when the window shifts, the selection follows its own month', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <AllocationGrid {...gridProps([ALICE, BOB], MONTHS, onChange)} />,
    );
    fireEvent.mouseDown(cellAt(container, 1, 2)); // Bob / 2026-03
    rerender(<AllocationGrid {...gridProps([ALICE, BOB], ['2026-02', '2026-03'], onChange)} />);
    fireEvent.keyDown(document.body, { key: 'Delete' });

    expect(onChange.mock.calls).toEqual([['tm-bob', '2026-03', 0]]);
  });

  // ───────────────────────── multi-cell ranges ─────────────────────────

  it('a range whose members stay contiguous survives an unrelated removal and still targets exactly those members', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <AllocationGrid {...gridProps([ALICE, BOB, CARMEN, DAVE], MONTHS, onChange)} />,
    );
    fireEvent.mouseDown(cellAt(container, 1, 2));  // Bob / 2026-03
    fireEvent.mouseEnter(cellAt(container, 2, 2)); // extend to Carmen
    fireEvent.mouseUp(window);
    rerender(<AllocationGrid {...gridProps([BOB, CARMEN, DAVE], MONTHS, onChange)} />);
    onChange.mockClear();
    fireEvent.keyDown(document.body, { key: 'Delete' });

    expect(onChange.mock.calls).toEqual([
      ['tm-bob', '2026-03', 0],
      ['tm-carmen', '2026-03', 0],
    ]);
  });

  it('a range broken up by a sort is cleared rather than silently retargeted', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <AllocationGrid {...gridProps([ALICE, CARMEN, BOB, DAVE], MONTHS, onChange)} />,
    );
    fireEvent.mouseDown(cellAt(container, 0, 2));  // Alice / 2026-03
    fireEvent.mouseEnter(cellAt(container, 1, 2)); // extend to Carmen
    fireEvent.mouseUp(window);
    rerender(<AllocationGrid {...gridProps([ALICE, BOB, CARMEN, DAVE], MONTHS, onChange)} />);
    onChange.mockClear();
    fireEvent.keyDown(document.body, { key: 'Delete' });

    expect(onChange.mock.calls).toEqual([]);
  });

  // ───────────────────────── fill drags ─────────────────────────

  it('a fill drag in flight survives the roster shrinking, with no exception and no write', () => {
    // The render path: isCellInFillPreview runs in the row body, so this throws
    // BEFORE any effect could correct the index.
    const onChange = vi.fn();
    const { container, rerender } = render(
      <AllocationGrid {...gridProps([ALICE, BOB, CARMEN], MONTHS, onChange)} />,
    );
    fireEvent.mouseDown(cellAt(container, 2, 2)); // Carmen / 2026-03
    fireEvent.mouseDown(container.querySelector('[data-fill-handle="true"]') as HTMLElement);
    fireEvent.mouseEnter(cellAt(container, 1, 1)); // drag back into Bob / 2026-02

    expectNoFailure('shrink', capture(() =>
      rerender(<AllocationGrid {...gridProps([BOB, CARMEN], MONTHS, onChange)} />)));
    expect(container.querySelector('table'), 'grid must still be mounted').not.toBeNull();
    expectNoFailure('mouseup', capture(() => fireEvent.mouseUp(window)));

    expect(onChange.mock.calls).toEqual([]);
  });

  it('a downward fill commit after the roster shrinks writes nothing rather than partially applying', () => {
    // Distinct from the case above: computeFillRegion dereferences the SOURCE rows
    // but emits rows below them, so render survives and the commit loop is what
    // fails — after it has already written some of the cells.
    const onChange = vi.fn();
    const { container, rerender } = render(
      <AllocationGrid {...gridProps([ALICE, BOB, CARMEN, DAVE], MONTHS, onChange)} />,
    );
    fireEvent.mouseDown(cellAt(container, 0, 0)); // Alice / 2026-01
    fireEvent.mouseDown(container.querySelector('[data-fill-handle="true"]') as HTMLElement);
    fireEvent.mouseEnter(cellAt(container, 3, 0)); // drag down to Dave

    expectNoFailure('shrink', capture(() =>
      rerender(<AllocationGrid {...gridProps([ALICE, BOB], MONTHS, onChange)} />)));
    expectNoFailure('mouseup', capture(() => fireEvent.mouseUp(window)));

    expect(onChange.mock.calls).toEqual([]);
  });

  // ───────────────────────── the edit path ─────────────────────────

  it('an in-flight edit commits to the member being edited after a sort, without replacing the input', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <AllocationGrid {...gridProps([CARMEN, BOB, ALICE], MONTHS, onChange)} />,
    );
    fireEvent.doubleClick(cellAt(container, 2, 2)); // Alice / 2026-03
    const before = container.querySelector('input[data-grid-input]') as HTMLInputElement;
    fireEvent.change(before, { target: { value: '7' } });
    rerender(<AllocationGrid {...gridProps([ALICE, BOB, CARMEN], MONTHS, onChange)} />);
    const after = container.querySelector('input[data-grid-input]');
    fireEvent.keyDown(document.body, { key: 'Enter' });

    expect(onChange.mock.calls).toEqual([['tm-alice', '2026-03', 0.07]]);
    // Node identity, not just presence: remounting loses caret, text selection and
    // IME composition. This is what separates the render-time fix from an effect.
    expect(after, 'the editor input must be the same DOM node').toBe(before);
  });

  // ───────────────────────── the Remove dialog ─────────────────────────

  it('keystrokes do not reach the grid while the Remove dialog is open', () => {
    const onChange = vi.fn();
    const { container } = render(
      <StatefulHost initial={[ALICE, BOB, CARMEN]} months={MONTHS} onChange={onChange} />,
    );
    fireEvent.mouseDown(cellAt(container, 0, 0)); // Alice / 2026-01
    fireEvent.mouseDown(removeButtonInRow(container, 0));
    fireEvent.click(removeButtonInRow(container, 0));
    fireEvent.keyDown(document.body, { key: 'Backspace' });

    expect(onChange.mock.calls).toEqual([]);
  });

  it('keystrokes resume, against a selection that survived, once the Remove dialog is cancelled', () => {
    const onChange = vi.fn();
    const { container } = render(
      <StatefulHost initial={[ALICE, BOB, CARMEN]} months={MONTHS} onChange={onChange} />,
    );
    fireEvent.mouseDown(cellAt(container, 0, 0)); // Alice / 2026-01
    fireEvent.mouseDown(removeButtonInRow(container, 0));
    fireEvent.click(removeButtonInRow(container, 0));
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.mouseDown(cancel);
    fireEvent.click(cancel);
    fireEvent.keyDown(document.body, { key: 'Delete' });

    expect(onChange.mock.calls).toEqual([['tm-alice', '2026-01', 0]]);
  });

  // ───────────────────────── click-outside containment ─────────────────────────

  it('a mousedown inside the scroll container but outside the table keeps the selection', () => {
    const onChange = vi.fn();
    const { container } = render(
      <AllocationGrid {...gridProps([ALICE, BOB], MONTHS, onChange)} />,
    );
    fireEvent.mouseDown(cellAt(container, 0, 0));
    fireEvent.mouseDown(container.querySelector('div.overflow-x-auto') as HTMLElement);
    fireEvent.keyDown(document.body, { key: 'Delete' });

    expect(onChange.mock.calls).toEqual([['tm-alice', '2026-01', 0]]);
  });

  it('a mousedown outside the grid still clears the selection', () => {
    const onChange = vi.fn();
    const { container } = render(
      <AllocationGrid {...gridProps([ALICE, BOB], MONTHS, onChange)} />,
    );
    fireEvent.mouseDown(cellAt(container, 0, 0));
    fireEvent.mouseDown(document.body);
    fireEvent.keyDown(document.body, { key: 'Delete' });

    expect(onChange.mock.calls).toEqual([]);
  });

  // ───────────────────────── identity churn ─────────────────────────

  it('an identity-only re-render does not cancel an in-progress RANGE drag', () => {
    // Keying the remap on array identity rather than content re-runs it on every
    // render, and the drag-cancel clause then fires mid-drag. No assertion about
    // focus or selection can catch that: remapping identical content is the
    // identity map, so those survive either way.
    const onChange = vi.fn();
    const roster = () => [{ ...ALICE }, { ...BOB }, { ...CARMEN }];
    const { container, rerender } = render(
      <AllocationGrid {...gridProps(roster(), MONTHS, onChange)} />,
    );
    fireEvent.mouseDown(cellAt(container, 0, 0)); // begin a range at Alice / 2026-01
    rerender(<AllocationGrid {...gridProps(roster(), [...MONTHS], onChange)} />);
    fireEvent.mouseEnter(cellAt(container, 2, 0)); // extend to Carmen
    fireEvent.mouseUp(window);
    fireEvent.keyDown(document.body, { key: 'Delete' });

    expect(onChange.mock.calls).toEqual([
      ['tm-alice', '2026-01', 0],
      ['tm-bob', '2026-01', 0],
      ['tm-carmen', '2026-01', 0],
    ]);
  });

  it('an identity-only re-render does not cancel an in-progress FILL drag', () => {
    const onChange = vi.fn();
    const roster = () => [{ ...ALICE }, { ...BOB }, { ...CARMEN }];
    const { container, rerender } = render(
      <AllocationGrid {...gridProps(roster(), MONTHS, onChange)} />,
    );
    fireEvent.mouseDown(cellAt(container, 0, 0));
    fireEvent.mouseUp(window);
    fireEvent.mouseDown(container.querySelector('[data-fill-handle="true"]') as HTMLElement);
    rerender(<AllocationGrid {...gridProps(roster(), [...MONTHS], onChange)} />);
    fireEvent.mouseEnter(cellAt(container, 2, 0));
    fireEvent.mouseUp(window);

    expect(onChange.mock.calls).toEqual([
      ['tm-bob', '2026-01', 0.5],
      ['tm-carmen', '2026-01', 0.5],
    ]);
  });

  it('a new roster array with identical content does not reset the selection', () => {
    // useTeam memoises on [project, pool], so every allocation edit hands the grid
    // a fresh array. Keying the remap on reference rather than content would clear
    // the selection on every keystroke.
    const onChange = vi.fn();
    const roster = () => [{ ...ALICE }, { ...BOB }];
    const { container, rerender } = render(
      <AllocationGrid {...gridProps(roster(), MONTHS, onChange)} />,
    );
    fireEvent.mouseDown(cellAt(container, 1, 2)); // Bob / 2026-03
    for (let i = 0; i < 5; i++) {
      rerender(<AllocationGrid {...gridProps(roster(), [...MONTHS], onChange)} />);
    }
    fireEvent.keyDown(document.body, { key: 'Delete' });

    expect(onChange.mock.calls).toEqual([['tm-bob', '2026-03', 0]]);
  });
});
