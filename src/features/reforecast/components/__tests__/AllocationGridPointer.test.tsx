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
function selectedCount(container: HTMLElement): number {
  return container.querySelectorAll('td.outline-blue-500').length;
}
function fillPreviewCount(container: HTMLElement): number {
  return container.querySelectorAll('td.bg-blue-200\\/60').length;
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

  it('losing the window with a completed selection leaves that selection usable', () => {
    // The other direction, and the one that stops "cancel" being read as "undo":
    // alt-tabbing away and back must not cost the user their selection.
    const onChange = vi.fn();
    const { container } = render(<AllocationGrid {...gridProps(onChange)} />);
    fireEvent.mouseDown(cellAt(container, 0, 0));
    fireEvent.mouseEnter(cellAt(container, 0, 1));
    fireEvent.mouseUp(window);
    expect(selectedCount(container), 'precondition: two cells selected').toBe(2);

    fireEvent.blur(window);

    expect(selectedCount(container)).toBe(2);
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
});
