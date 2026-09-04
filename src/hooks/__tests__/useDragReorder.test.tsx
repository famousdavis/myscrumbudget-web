// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * WI-2 (v0.37.17) — the container drop path.
 *
 * ⚠️⚠️ WHAT THESE TESTS PROVE, AND WHAT THEY DO NOT.
 * jsdom performs no layout: every `getBoundingClientRect()` returns all zeros, and
 * two elements at genuinely different CSS positions return BYTE-IDENTICAL rects
 * (measured 2026-09-04 under this repo's vitest config, not bare jsdom). So the
 * rects below are INJECTED, and these tests prove WIRING — that the container
 * reads rects off the right elements, bails when a card owns the point, resolves
 * an id, and hands it to the untouched handleDrop. They prove NOTHING about
 * whether the browser's real hit-testing puts a pointer where we think it does.
 * That half is browser-only and is verified on `next start`; do not read a green
 * run here as a geometry result.
 *
 * Injecting the rects is deliberate rather than a workaround: it CREATES the
 * precondition explicitly instead of assuming layout produced it, which is the
 * campaign's vacuity class 3 (a setup that never establishes what the assertion
 * names).
 *
 * ⚠️ TWO jsdom GAPS HAD TO BE CLOSED BY HAND, AND THE SECOND IS SILENT.
 * jsdom implements no `DragEvent`, so `fireEvent.drop(el, { clientX, clientY })`
 * falls back to a plain `Event` and DISCARDS the coordinates — measured: they
 * arrive `undefined`, every distance becomes NaN, and resolution returns null.
 * There is no error and no warning; the drop simply does nothing. `dropAt` and
 * `dragOverAt` below define the coordinates on the event explicitly. Neither gap
 * is a defect in the production code, and neither is visible from a green run —
 * which is the standing argument for the browser check on `next start`.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, createEvent } from '@testing-library/react';
import { useDragReorder, resolveNearestDropTarget } from '../useDragReorder';

/**
 * The real dashboard layout, measured in-browser at 1440x900 with 4 projects:
 * three 373px columns, 16px gap, so row 1 is [A B C] and row 2 is [D _ _].
 * The two empty cells in row 2 are the largest dead region (31.8% of the grid).
 */
const LAYOUT: Record<string, { left: number; top: number; width: number; height: number }> = {
  a: { left: 256, top: 340, width: 373, height: 174 },
  b: { left: 645, top: 340, width: 373, height: 174 },
  c: { left: 1035, top: 340, width: 373, height: 174 },
  d: { left: 256, top: 530, width: 373, height: 174 },
};
const rectsFor = (ids: string[]) => ids.map((id) => ({ id, rect: LAYOUT[id] }));

/** jsdom has no DataTransfer constructor; the stub is the supported way round it. */
const dragStub = () => ({ setData: () => {}, effectAllowed: '', dropEffect: '' });

/** Dispatch a drag event carrying real pointer coordinates — see the header. */
function dragEventAt(
  kind: 'drop' | 'dragOver',
  el: Element,
  clientX: number,
  clientY: number,
): Event {
  const event = createEvent[kind](el, { dataTransfer: dragStub() });
  Object.defineProperty(event, 'clientX', { value: clientX });
  Object.defineProperty(event, 'clientY', { value: clientY });
  fireEvent(el, event);
  return event;
}
const dropAt = (el: Element, x: number, y: number) => dragEventAt('drop', el, x, y);
const dragOverAt = (el: Element, x: number, y: number) => dragEventAt('dragOver', el, x, y);

function Host({ ids, onReorder }: { ids: string[]; onReorder: (ordered: string[]) => void }) {
  const drag = useDragReorder(ids.map((id) => ({ id })), 'id', onReorder);
  return (
    <div data-testid="grid" {...drag.containerHandlers}>
      {ids.map((id) => (
        <div key={id} data-testid={`card-${id}`} {...drag.handlersFor(id)}>{id}</div>
      ))}
    </div>
  );
}

function renderGrid(ids: string[]) {
  const onReorder = vi.fn();
  const utils = render(<Host ids={ids} onReorder={onReorder} />);
  for (const id of ids) {
    const el = utils.getByTestId(`card-${id}`);
    const r = LAYOUT[id];
    el.getBoundingClientRect = () =>
      ({ ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => ({}) }) as DOMRect;
  }
  return { ...utils, onReorder, grid: utils.getByTestId('grid') };
}

describe('resolveNearestDropTarget — the pure decision', () => {
  // [FALSIFY-AFTER] The function does not exist before v0.37.17, so these cannot
  // fail at HEAD for an informative reason; they are verified by breaking the
  // finished artifact instead (F3, F6).

  it('returns the nearer card for a point in the gutter between two of them', () => {
    const targets = rectsFor(['a', 'b', 'c', 'd']);
    // The 16px gutter between a (right edge 629) and b (left edge 645), at row
    // mid-height. Asserted from BOTH sides: one side alone passes for an
    // implementation that always answers "a".
    expect(resolveNearestDropTarget(631, 427, targets)).toBe('a');
    expect(resolveNearestDropTarget(643, 427, targets)).toBe('b');
  });

  it('returns the LAST card for a trailing empty cell, not the nearer card above it', () => {
    // ⚠️ THIS IS THE DISCRIMINATING TEST OF THE WHOLE ALGORITHM, and asserting
    // only `toBe('d')` would understate it. Measured centre distances from the
    // empty cell immediately right of d are b:190 d:389 a:433 c:434 — so plain
    // nearest-by-centre answers B, a card in the row ABOVE, and dropping "at the
    // end" would insert at position 2 instead. A grid is a 1-D list wrapped into
    // rows; resolution must respect the wrap. The second assertion states the
    // trap directly so a future reader cannot mistake this for a distance test.
    const targets = rectsFor(['a', 'b', 'c', 'd']);
    expect(resolveNearestDropTarget(831.5, 617, targets)).toBe('d');
    expect(resolveNearestDropTarget(1221.5, 617, targets)).toBe('d');

    const centreDistanceTo = (id: string) => {
      const r = LAYOUT[id];
      return Math.hypot(831.5 - (r.left + r.width / 2), 617 - (r.top + r.height / 2));
    };
    expect(centreDistanceTo('b')).toBeLessThan(centreDistanceTo('d'));
  });

  it('returns null for an empty target list', () => {
    expect(resolveNearestDropTarget(500, 500, [])).toBeNull();
  });
});

describe('useDragReorder — container drop path (wiring, not geometry)', () => {
  it('[FAILS-TODAY] a drop in a trailing empty cell reorders to the nearest card', () => {
    const { grid, onReorder, getByTestId } = renderGrid(['a', 'b', 'c', 'd']);
    fireEvent.dragStart(getByTestId('card-a'), { dataTransfer: dragStub() });
    // A point owned by NO card — the empty cell after the last one.
    dropAt(grid, 1221, 617);
    // target d at full-list index 3: remove a -> [b,c,d], insert at 3 -> [b,c,d,a].
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'd', 'a']);
  });

  it('[FAILS-TODAY] a drop in the gutter between two cards reorders to the nearer one', () => {
    const { grid, onReorder, getByTestId } = renderGrid(['a', 'b', 'c', 'd']);
    fireEvent.dragStart(getByTestId('card-d'), { dataTransfer: dragStub() });
    dropAt(grid, 631, 427);
    // target a at index 0: remove d -> [a,b,c], insert at 0 -> [d,a,b,c].
    expect(onReorder).toHaveBeenCalledWith(['d', 'a', 'b', 'c']);
  });

  it('[REGRESSION] a drop ON a card reorders exactly ONCE, not twice', () => {
    // A drop on a card bubbles to the container (measured), so without the
    // closest('[data-drag-id]') bail the container would run handleDrop a second
    // time for one gesture. A call-count assertion is the only thing that sees
    // it — the resulting order is IDENTICAL either way, because the second run
    // re-applies the same move to the already-moved list.
    const { onReorder, getByTestId } = renderGrid(['a', 'b', 'c', 'd']);
    fireEvent.dragStart(getByTestId('card-a'), { dataTransfer: dragStub() });
    dropAt(getByTestId('card-b'), 831, 427);
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c', 'd']);
  });

  it('[FAILS-TODAY] dragover over empty grid space is preventDefault()ed, as it already is over a card', () => {
    // preventDefault on dragover is what marks a region droppable. Without it the
    // browser fires NO drop event at all — which is the entire defect. The card
    // half is the positive control: it passes at HEAD and must keep passing.
    const { grid, getByTestId } = renderGrid(['a', 'b', 'c', 'd']);

    const overEmptySpace = dragOverAt(grid, 1221, 617);
    expect(overEmptySpace.defaultPrevented, 'empty grid space must be droppable').toBe(true);

    const overCard = dragOverAt(getByTestId('card-b'), 831, 427);
    expect(overCard.defaultPrevented, 'POSITIVE CONTROL: a card was already droppable').toBe(true);
  });

  it('[FAILS-TODAY] emits data-drag-id from handlersFor, which is what the container hit-tests on', () => {
    const { grid } = renderGrid(['a', 'b', 'c', 'd']);
    expect(Array.from(grid.querySelectorAll('[data-drag-id]')).map((el) => (el as HTMLElement).dataset.dragId))
      .toEqual(['a', 'b', 'c', 'd']);
  });
});
