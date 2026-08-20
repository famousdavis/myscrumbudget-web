// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Project } from '@/types/domain';
import { useRepository } from '@/components/RepositoryProvider';
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
  const { repository } = useRepository();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // The live project is mirrored into a ref so mutators can read the latest
  // value and persist SYNCHRONOUSLY (see updateProject). This is load-bearing:
  // the Edit page builds several updateProject calls then `await flush()` before
  // navigating away. React defers setState updater functions, so persisting from
  // inside an updater (the pre-v0.33.0 pattern) left `flush()` with nothing
  // queued — the real write landed ~500ms later via the debounce, AFTER
  // navigation, and the detail page re-read stale data (the v0.29.2 "await
  // flush" fix could not work). Persisting from the ref, synchronously, fixes it.
  const projectRef = useRef<Project | null>(null);

  // Session-scoped undo/redo held in refs (so updateProject can read fresh
  // values without stale closures) with boolean state mirrors that drive the
  // toolbar buttons. Snapshots are stored by reference — every mutation produces
  // a new Project tree via spread updates, so the live tree can never mutate a
  // snapshot in place. Do NOT introduce in-place array mutation in mutators
  // without revisiting this assumption.
  const undoRef = useRef<Project[]>([]);
  const redoRef = useRef<Project[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // useRef (not useState) — flipping the group flag must NOT trigger renders.
  const undoGroupActiveRef = useRef<boolean>(false);

  const syncStackFlags = useCallback(() => {
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(redoRef.current.length > 0);
  }, []);

  // Apply an externally-sourced project (initial load / cloud sync) WITHOUT
  // touching the undo stacks — another user's write must not enter this user's
  // undo history.
  const applyProject = useCallback((p: Project | null) => {
    projectRef.current = p;
    setProject(p);
  }, []);

  const reload = useCallback(async () => {
    const p = await repository.getProject(id);
    applyProject(p);
    setLoading(false);
  }, [id, applyProject, repository]);

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
      await repository.saveProject(p);
    } catch (err) {
      addToastGlobal('Failed to save project. Please check your connection.', 'error');
      throw err;
    }
  }, [repository]);
  const { save: persistProject, flush } = useDebouncedSave<Project>(persistProjectFn, id);

  const updateProject = useCallback(
    (updater: (prev: Project) => Project) => {
      const prev = projectRef.current;
      if (!prev) return;
      const updated = updater(prev);

      // Snapshot the PRE-update project onto the undo stack. Skipped during
      // a notes edit session so the entire focus → blur span collapses to
      // a single undo entry (the one captured at focus / first keystroke).
      if (!undoGroupActiveRef.current) {
        undoRef.current = pushBounded(undoRef.current, prev);
        // Any new user mutation invalidates the redo branch.
        redoRef.current = [];
      }

      projectRef.current = updated;
      setProject(updated);
      // Persist SYNCHRONOUSLY (not inside a deferred setState updater) so a
      // subsequent flush() reliably captures this value before navigation.
      persistProject(updated);
      syncStackFlags();
    },
    [persistProject, syncStackFlags]
  );

  const beginUndoGroup = useCallback(() => {
    if (undoGroupActiveRef.current) return; // idempotent — keystrokes 2..N
    const prev = projectRef.current;
    if (!prev) return;
    // Push pre-edit snapshot exactly once for the entire focus session.
    undoRef.current = pushBounded(undoRef.current, prev);
    redoRef.current = [];
    undoGroupActiveRef.current = true;
    syncStackFlags();
  }, [syncStackFlags]);

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

    if (undoRef.current.length === 0) return;
    const snapshot = undoRef.current[undoRef.current.length - 1];
    undoRef.current = undoRef.current.slice(0, -1);
    const current = projectRef.current;
    if (current) redoRef.current = pushBounded(redoRef.current, current);

    projectRef.current = snapshot;
    setProject(snapshot);
    // Persist immediately, bypassing the 500ms debounce. persistProject queues
    // into the debounce; flush() then writes synchronously and cancels the
    // pending timer so a stale in-flight save can't clobber.
    persistProject(snapshot);
    flush();
    syncStackFlags();
  }, [persistProject, flush, syncStackFlags]);

  const redo = useCallback(() => {
    // Same reason as undo() — clear the group flag first so a continuing
    // edit session after a mid-edit redo gets a fresh snapshot on the
    // next keystroke.
    undoGroupActiveRef.current = false;

    if (redoRef.current.length === 0) return;
    const snapshot = redoRef.current[redoRef.current.length - 1];
    redoRef.current = redoRef.current.slice(0, -1);
    const current = projectRef.current;
    if (current) undoRef.current = pushBounded(undoRef.current, current);

    projectRef.current = snapshot;
    setProject(snapshot);
    persistProject(snapshot);
    flush();
    syncStackFlags();
  }, [persistProject, flush, syncStackFlags]);

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
