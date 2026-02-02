'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Reusable drag-to-reorder hook.
 * Manages drag state and enter/leave counters for smooth drop-target highlighting.
 *
 * Usage:
 *   const drag = useDragReorder(items, 'id', onReorder);
 *   <div {...drag.handlersFor(item.id)} className={drag.classFor(item.id)} />
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
      onDragStart: (e: React.DragEvent) => handleDragStart(id, e),
      onDragEnd: handleDragEnd,
      onDragOver: handleDragOver,
      onDragEnter: () => handleDragEnter(id),
      onDragLeave: () => handleDragLeave(id),
      onDrop: (e: React.DragEvent) => handleDrop(id, e),
    }),
    [handleDragStart, handleDragEnd, handleDragOver, handleDragEnter, handleDragLeave, handleDrop],
  );

  return {
    draggedId,
    isDragging,
    isDragOver,
    handlersFor,
    handleDragStart,
    handleDragEnd,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
