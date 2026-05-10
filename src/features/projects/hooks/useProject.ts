// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Project } from '@/types/domain';
import { repo } from '@/lib/storage/repo';
import { useDebouncedSave } from '@/hooks/useDebouncedSave';
import { cloudSyncBus } from '@/lib/firebase/cloudSyncBus';
import { UNDO_STACK_LIMIT } from '@/lib/constants';
import { addToastGlobal } from '@/components/Toast';

function pushBounded(stack: Project[], snapshot: Project): Project[] {
  const next = [...stack, snapshot];
  return next.length > UNDO_STACK_LIMIT
    ? next.slice(next.length - UNDO_STACK_LIMIT)
    : next;
}

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  // Session-scoped undo/redo. Snapshots are stored by reference — every
  // mutation produces a new Project tree via spread updates, so the live
  // tree can never mutate a snapshot in place. Do NOT introduce in-place
  // array mutation in mutators without revisiting this assumption.
  const [undoStack, setUndoStack] = useState<Project[]>([]);
  const [redoStack, setRedoStack] = useState<Project[]>([]);
  // useRef (not useState) — flipping the group flag must NOT trigger renders.
  const undoGroupActiveRef = useRef<boolean>(false);

  const reload = useCallback(async () => {
    const p = await repo.getProject(id);
    setProject(p);
    setLoading(false);
  }, [id]);

  // Fetch-on-mount + cloudSyncBus subscription — externally driven, not cascading.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  // Subscribe to cloud sync events for projects.
  // reload() calls setProject directly (not updateProject), so inbound cloud
  // changes do NOT push onto the local undo stack. This is intentional —
  // another user's write should not appear on this user's undo history.
  useEffect(() => {
    return cloudSyncBus.subscribe((event) => {
      if (event === 'projects') reload();
    });
  }, [reload]);

  const persistProjectFn = useCallback(async (p: Project) => {
    try {
      await repo.saveProject(p);
    } catch (err) {
      addToastGlobal('Failed to save project. Please check your connection.', 'error');
      throw err;
    }
  }, []);
  const { save: persistProject, flush } = useDebouncedSave<Project>(persistProjectFn);

  const updateProject = useCallback(
    (updater: (prev: Project) => Project) => {
      setProject((prev) => {
        if (!prev) return prev;
        const updated = updater(prev);

        // Snapshot the PRE-update project onto the undo stack. Skipped during
        // a notes edit session so the entire focus → blur span collapses to
        // a single undo entry (the one captured at focus / first keystroke).
        if (!undoGroupActiveRef.current) {
          setUndoStack((stack) => pushBounded(stack, prev));
          // Any new user mutation invalidates the redo branch.
          setRedoStack((stack) => (stack.length === 0 ? stack : []));
        }

        persistProject(updated);
        return updated;
      });
    },
    [persistProject]
  );

  const beginUndoGroup = useCallback(() => {
    if (undoGroupActiveRef.current) return; // idempotent — keystrokes 2..N
    setProject((prev) => {
      if (!prev) return prev;
      // Push pre-edit snapshot exactly once for the entire focus session.
      setUndoStack((stack) => pushBounded(stack, prev));
      setRedoStack((stack) => (stack.length === 0 ? stack : []));
      return prev; // no state change
    });
    undoGroupActiveRef.current = true;
  }, []);

  const endUndoGroup = useCallback(() => {
    undoGroupActiveRef.current = false;
  }, []);

  const undo = useCallback(() => {
    // Close any active group BEFORE popping. Required so that if the user
    // hits Ctrl+Z while still focused on the notes textarea, the next
    // keystroke's defensive onBeginEdit() seeds a fresh group around the
    // continuing typing. Without this, the flag stays true, beginUndoGroup
    // early-returns on every keystroke, and the new typing is unrecoverable.
    undoGroupActiveRef.current = false;

    // INVESTIGATION FLAG (v0.28.1): the nested setRedoStack/setProject inside
    // setUndoStack's updater technically violates React's "updaters are pure"
    // contract. Tolerated by current React; revisit before any React major
    // upgrade or strict-mode tightening — preferred refactor is to read both
    // stacks and project via refs before issuing top-level setState calls.
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const snapshot = stack[stack.length - 1];
      setProject((current) => {
        if (!current) return current;
        setRedoStack((rs) => pushBounded(rs, current));
        // Persist immediately, bypassing the 500ms debounce. persistProject
        // queues into the debounce; flush() then writes synchronously and
        // cancels the pending timer so a stale in-flight save can't clobber.
        persistProject(snapshot);
        flush();
        return snapshot;
      });
      return stack.slice(0, -1);
    });
  }, [persistProject, flush]);

  const redo = useCallback(() => {
    // Same reason as undo() — clear the group flag first so a continuing
    // edit session after a mid-edit redo gets a fresh snapshot on the
    // next keystroke.
    undoGroupActiveRef.current = false;

    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const snapshot = stack[stack.length - 1];
      setProject((current) => {
        if (!current) return current;
        setUndoStack((us) => pushBounded(us, current));
        persistProject(snapshot);
        flush();
        return snapshot;
      });
      return stack.slice(0, -1);
    });
  }, [persistProject, flush]);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  return {
    project,
    loading,
    updateProject,
    flush,
    undo,
    redo,
    canUndo,
    canRedo,
    beginUndoGroup,
    endUndoGroup,
  };
}
