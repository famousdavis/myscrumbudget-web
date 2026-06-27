// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useId, useState, useRef, useEffect } from 'react';
import { REFORECAST_NOTES_MAX_LENGTH } from '@/lib/constants';

interface ReforecastNotesProps {
  value: string;
  onChange: (value: string) => void;
  onBeginEdit?: () => void;
  onEndEdit?: () => void;
}

function NoteIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7 3h8l4 4v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
        fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.15 : 0}
        stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M15 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ReforecastNotes({ value, onChange, onBeginEdit, onEndEdit }: ReforecastNotesProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  // ── A3 echo guard ──────────────────────────────────────────────────────
  // Race: user types → debounce (500ms) → Firestore write → server-ack
  // (hasPendingWrites:false) → cloudSyncBus.emit → reload() → setProject
  // (Firestore version) → value prop changes mid-typing → textarea reverts.
  //
  // Fix: localValue buffer holds what the textarea displays. While focused,
  // incoming prop changes are suppressed via isFocusedRef.
  //
  // onChange fires per-keystroke (same as pre-fix) — project.notes and
  // undo/redo machinery are always current.
  //
  // Handler order: onBeginEdit BEFORE onChange. This matches the original
  // code and is load-bearing for undo-group seeding: beginUndoGroup sets
  // undoGroupActiveRef.current = true synchronously in the same React batch,
  // before updateProject's updater reads the flag. Reversing the order causes
  // the updater to see flag = false on the first keystroke after a mid-edit
  // undo, pushing the wrong snapshot and wasting the user's Ctrl+Z.
  //
  // onBlur: calls setLocalValue(value) to sync the textarea FROM the store.
  //   Normal case: value === localValue → no-op.
  //   After mid-edit Ctrl+Z: value = undone state → blur snaps textarea.
  //   NOT a write to the store (no onChange call on blur).
  //
  // Documented limitation: while still focused after Ctrl+Z, the textarea
  // shows the typed text. The snap to the undone value happens on next blur.
  const [localValue, setLocalValue] = useState(value);
  const isFocusedRef = useRef(false);
  useEffect(() => {
    if (!isFocusedRef.current) setLocalValue(value);
  }, [value]);
  // ─────────────────────────────────────────────────────────────────────────

  const hasContent = localValue.trim().length > 0;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
      >
        <span className={hasContent ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}>
          <NoteIcon filled={hasContent} />
        </span>
        <span>Notes</span>
        {hasContent && (
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400"
            aria-label="has content" />
        )}
        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded && (
        <div id={panelId} className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <textarea
            name="reforecastNotes"
            value={localValue}
            onChange={(e) => {
              const newValue = e.target.value;
              setLocalValue(newValue);  // update buffer (prevents echo clobber)
              onBeginEdit?.();           // FIRST: seed undo group before updateProject
              onChange(newValue);        // THEN: per-keystroke commit to store/undo stack
            }}
            onFocus={() => {
              isFocusedRef.current = true;
              onBeginEdit?.();
            }}
            onBlur={() => {
              isFocusedRef.current = false;
              setLocalValue(value);  // sync FROM store — NOT a write to store
              onEndEdit?.();
            }}
            maxLength={REFORECAST_NOTES_MAX_LENGTH}
            rows={5}
            placeholder="Why this reforecast? Scope change, team shift, delay…"
            aria-label="Notes"
            className="w-full resize-y rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <div className="mt-1 flex justify-end text-xs text-zinc-400 dark:text-zinc-500">
            {localValue.length} / {REFORECAST_NOTES_MAX_LENGTH}
          </div>
        </div>
      )}
    </div>
  );
}
