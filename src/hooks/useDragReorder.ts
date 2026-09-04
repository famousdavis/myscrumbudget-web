// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

/** One candidate drop target: its id and the box it occupies on screen. */
export interface DropTargetRect {
  id: string;
  rect: { left: number; top: number; width: number; height: number };
}

/**
 * Two rows are the same row when their tops agree to within this many pixels.
 * Grid items in one row share a top exactly; the tolerance only absorbs the
 * sub-pixel column arithmetic (measured: 373.328px vs 373.336px in one grid).
 */
const SAME_ROW_TOLERANCE_PX = 1;

/**
 * The id of the drop target nearest to (x, y) — nearest ROW first, then nearest
 * horizontally within that row — or null when there are no targets. Pure: it
 * takes rects, it does not read the DOM.
 *
 * ⚠️⚠️ ROW-FIRST IS NOT A REFINEMENT OF PLAIN 2-D DISTANCE; IT IS THE WHOLE
 * CORRECTNESS ARGUMENT, AND NEAREST-BY-CENTRE IS MEASURABLY WRONG HERE.
 * A CSS grid is a one-dimensional list wrapped into rows, so the empty cell after
 * the last card means "after that card" in reading order — while sitting
 * physically closer to whatever happens to be in the row ABOVE it. Measured on
 * the real dashboard layout (1440x900, 3 columns of 373px, gap 16, cards A B C /
 * D _ _): from the empty cell immediately right of D, centre distances are
 * B:190 D:389 A:433 C:434 — so plain nearest-by-centre answers B, and dropping
 * "at the end" would instead insert at position 2. That is a plausible-looking
 * WRONG reorder, which is worse than the no-op this release exists to fix.
 * Do not simplify this back to a single distance comparison.
 *
 * ⚠️ It resolves an **id**, never an index, and that is load-bearing rather than
 * stylistic. On the dashboard `useDragReorder` is bound to the FULL project list
 * while the grid renders a filtered subset (archived projects are hidden), so a
 * positional answer would name a different project than the one under the
 * pointer. `handleDrop` does `ids.indexOf(targetId)` against the full list, and
 * the id is the only value that survives that crossing intact.
 *
 * Ties resolve to the earliest row, then the earliest target, deterministically.
 */
interface TargetRow {
  top: number;
  bottom: number;
  items: DropTargetRect[];
}

/** Bucket targets into rows by their top edge, preserving array order. */
function groupIntoRows(targets: DropTargetRect[]): TargetRow[] {
  const rows: TargetRow[] = [];
  for (const target of targets) {
    const bottom = target.rect.top + target.rect.height;
    const row = rows.find((r) => Math.abs(r.top - target.rect.top) <= SAME_ROW_TOLERANCE_PX);
    if (row) {
      row.items.push(target);
      row.bottom = Math.max(row.bottom, bottom);
    } else {
      rows.push({ top: target.rect.top, bottom, items: [target] });
    }
  }
  return rows;
}

/**
 * The row whose vertical band is nearest to `y`. Distance is zero when y is
 * inside the band, so a point level with a row always picks that row however far
 * off to the side it sits — which is what makes a trailing empty cell resolve to
 * its own row rather than to the row above.
 */
function nearestRowTo(y: number, rows: TargetRow[]): TargetRow {
  let bestRow = rows[0];
  let bestDistance = Infinity;
  for (const row of rows) {
    const distance = y < row.top ? row.top - y : y > row.bottom ? y - row.bottom : 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRow = row;
    }
  }
  return bestRow;
}

/** The item in `row` whose horizontal centre is nearest to `x`. */
function nearestInRowTo(x: number, row: TargetRow): string | null {
  let bestId: string | null = null;
  let bestDx = Infinity;
  for (const { id, rect } of row.items) {
    const dx = Math.abs(x - (rect.left + rect.width / 2));
    if (dx < bestDx) {
      bestDx = dx;
      bestId = id;
    }
  }
  return bestId;
}

export function resolveNearestDropTarget(
  x: number,
  y: number,
  targets: DropTargetRect[],
): string | null {
  if (targets.length === 0) return null;
  return nearestInRowTo(x, nearestRowTo(y, groupIntoRows(targets)));
}

/**
 * Reusable drag-to-reorder hook.
 * Manages drag state and enter/leave counters for smooth drop-target highlighting.
 *
 * Usage:
 *   const drag = useDragReorder(items, 'id', onReorder);
 *   <div {...drag.handlersFor(item.id)} className={drag.classFor(item.id)} />
 *
 * A container may additionally spread `drag.containerHandlers` to make the space
 * BETWEEN and AFTER the items droppable — see `resolveNearestDropTarget`.
 */
export function useDragReorder<T>(
  items: T[],
  idKey: keyof T,
  onReorder: (orderedIds: string[]) => void,
) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const counterRef = useRef<Map<string, number>>(new Map());

  const handleDragStart = useCallback((id: string, e: React.DragEvent) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
    counterRef.current.clear();
  }, []);

  const handleDragEnter = useCallback((id: string) => {
    const count = (counterRef.current.get(id) ?? 0) + 1;
    counterRef.current.set(id, count);
    setDragOverId(id);
  }, []);

  const handleDragLeave = useCallback((id: string) => {
    const count = (counterRef.current.get(id) ?? 1) - 1;
    counterRef.current.set(id, count);
    if (count <= 0) {
      counterRef.current.delete(id);
      setDragOverId((prev) => (prev === id ? null : prev));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (targetId: string, e: React.DragEvent) => {
      e.preventDefault();
      const sourceId = draggedId;
      if (!sourceId || sourceId === targetId) return;

      const ids = items.map((item) => String(item[idKey]));
      const fromIndex = ids.indexOf(sourceId);
      const toIndex = ids.indexOf(targetId);
      if (fromIndex < 0 || toIndex < 0) return;

      ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, sourceId);
      onReorder(ids);
    },
    [draggedId, items, idKey, onReorder],
  );

  const isDragging = useCallback(
    (id: string) => draggedId === id,
    [draggedId],
  );

  const isDragOver = useCallback(
    (id: string) => dragOverId === id && draggedId !== id,
    [dragOverId, draggedId],
  );

  const handlersFor = useCallback(
    (id: string) => ({
      draggable: true,
      // Emitted HERE, never written at the call site, so the attribute and the id
      // bound into onDrop below come from the SAME parameter and are provably
      // equal. Written separately they could disagree, and a container that
      // hit-tests on this attribute would then act on the wrong item.
      //
      // ⚠️ A consumer that is a COMPONENT rather than a DOM element must declare
      // and forward this prop — see ProjectCard. TypeScript will not tell you:
      // JSX spreads skip excess-property checking, so an undeclared prop compiles
      // clean and is silently dropped. `draggable` above has been in exactly that
      // state since v0.20.x and is invisible only because ProjectCard hardcodes
      // the same value. The DOM-level test in page.test.tsx is the real guard.
      'data-drag-id': id,
      onDragStart: (e: React.DragEvent) => handleDragStart(id, e),
      onDragEnd: handleDragEnd,
      onDragOver: handleDragOver,
      onDragEnter: () => handleDragEnter(id),
      onDragLeave: () => handleDragLeave(id),
      onDrop: (e: React.DragEvent) => handleDrop(id, e),
    }),
    [handleDragStart, handleDragEnd, handleDragOver, handleDragEnter, handleDragLeave, handleDrop],
  );

  /**
   * Opt-in handlers for the element that CONTAINS the draggable items, making the
   * space between and after them droppable.
   *
   * ⚠️ Without this, a container is not a drop target at all: it never calls
   * preventDefault() on dragover, so the browser marks the region non-droppable,
   * fires NO drop event, and snaps the item back. Measured on the dashboard at
   * v0.37.16 — 37.6% of the grid area silently discarded drops, of which 31.8
   * points were the empty cells AFTER the last card, i.e. exactly where a user
   * drops to mean "put this at the end".
   *
   * Both handlers bail when a draggable item owns the point, leaving the existing
   * per-item path byte-identical. The bail is REQUIRED, not defensive: a drop on
   * an item bubbles to the container (measured), so without it handleDrop would
   * run twice for one gesture.
   */
  const containerHandlers = useMemo(
    () => {
      const readTargets = (container: Element): DropTargetRect[] =>
        Array.from(container.querySelectorAll<HTMLElement>('[data-drag-id]')).map((el) => ({
          id: el.dataset.dragId ?? '',
          rect: el.getBoundingClientRect(),
        }));

      return {
        onDragOver: (e: React.DragEvent) => {
          if ((e.target as Element).closest('[data-drag-id]')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          // Re-asserted on every dragover rather than tracked with the enter/leave
          // counter, which has no event to count out here. Identical values are a
          // no-op for React, so this does not re-render per pointer move.
          setDragOverId(
            resolveNearestDropTarget(e.clientX, e.clientY, readTargets(e.currentTarget)),
          );
        },
        onDrop: (e: React.DragEvent) => {
          if ((e.target as Element).closest('[data-drag-id]')) return;
          e.preventDefault();
          const targetId = resolveNearestDropTarget(
            e.clientX,
            e.clientY,
            readTargets(e.currentTarget),
          );
          if (targetId) handleDrop(targetId, e);
        },
      };
    },
    [handleDrop],
  );

  return {
    draggedId,
    isDragging,
    isDragOver,
    handlersFor,
    containerHandlers,
    handleDragStart,
    handleDragEnd,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
