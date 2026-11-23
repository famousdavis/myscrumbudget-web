// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getStorageMode } from '@/lib/storage/storageMode';
import { getFirstName } from '@/lib/utils/getFirstName';

/** The avatar's fill: the white initial on it measures 4.55 : 1. Used only as the avatar's background. */
const AVATAR_FILL = '#0070f3';

/**
 * `currentColor`, inside the chip's action segment: the frame's link colour, #155dfc / #51a2ff, 5.25 and 6.73 : 1 on the
 * page ground, 5.02 / 5.56 on the chip's hover ground. Until v0.45.0 it was a fixed #0070f3. WCAG 1.4.11 (3 : 1,
 * non-text) governs it: in the signed-in chip, cloud-vs-lock is the only VISUAL sign of the storage mode (the mode is
 * also in the button's name, for assistive technology).
 */
function CloudIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * The lock is not decoration: in the signed-in-local chip it stands alone where the cloud chip shows its cloud, so it
 * is the only visual sign of the storage mode there, and WCAG 1.4.11 asks 3 : 1 of it. It draws in `currentColor`:
 * beside "Local only" that is the state segment's muted colour (4.84 : 1 on white, 6.82 on #101828); alone in the action
 * segment the caller passes the muted colour, because a lock says "local only", not "do something", and must not take
 * the action segment's link colour.
 */
function LockIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface StorageStatusPillProps {
  /** Called when the user clicks the chip. The header opens the Cloud Storage modal in response. Every state does. */
  onOpen: () => void;
}

/**
 * The account chip, on the frame's `.sf-chip` (FRAME26, contract §3 and §7, v0.45.0): 30 px tall in every state,
 * min-width 163, max-width 240, its right edge at the column's. Its colours are the frame's, never this file's:
 *   - the state segment (`.sf-chip-state`) is the muted text colour: 4.84 : 1 on white, 6.82 on #101828;
 *   - the action segment (`.sf-chip-act`) is the link colour: 5.25 / 6.73;
 *   - on hover the whole chip takes `--sf-hover` (#f9fafb / #1e2939), where the same two measure 4.63 / 5.64 and
 *     5.02 / 5.56.
 * The segment border between them is the divider. No colour is set inline or by a utility on the chip or its segments,
 * except the avatar's fill and the signed-in name: the stylesheet is unlayered and would win anyway. Stage 0's
 * "Local only" and "Sign in" classes (v0.44.14) gave way to these tokens. `StorageStatusPill.frame.test.tsx` holds this.
 *
 * Every state opens the Cloud Storage modal, and their names are unchanged from before the frame.
 */
export function StorageStatusPill({ onOpen }: StorageStatusPillProps) {
  const { user } = useAuth();
  // Subscribes this component to path changes; re-renders on navigation so the mode read below picks up any
  // storage-mode flip that happened on another page. Return value is intentionally ignored.
  usePathname();

  // Derived during render rather than via useEffect(setMode) to satisfy the react-hooks/set-state-in-effect rule.
  // getStorageMode() is a synchronous localStorage read. ⚠️ Hydration (the chip is rendered on the server since
  // v0.45.0): `user` is null on the server AND on the first client render, so both render the signed-out chip whatever
  // the stored mode says; the mode only matters once a user has resolved, after hydration.
  const mode: 'local' | 'cloud' = typeof window !== 'undefined' ? getStorageMode() : 'local';

  const isCloudSignedIn = mode === 'cloud' && !!user;
  const isSignedInLocal = !!user && mode !== 'cloud';
  const firstName = getFirstName(user?.displayName, user?.email);
  const initial = firstName.charAt(0).toUpperCase();

  if (isCloudSignedIn || isSignedInLocal) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={
          isCloudSignedIn
            ? `Signed in as ${firstName}. Open cloud storage settings.`
            : `Signed in as ${firstName} in local mode. Open cloud storage settings.`
        }
        className="sf-chip"
        data-sf="chip"
      >
        {/* State segment: avatar + first name. The avatar is 22 px, to fit the 30 px chip inside its 1 px border. */}
        <span className="sf-chip-state">
          <span
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-medium text-white"
            style={{ backgroundColor: AVATAR_FILL }}
          >
            {initial}
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{firstName}</span>
        </span>
        {/* Action segment: the cloud (in the link colour) or the lock (muted). */}
        <span className="sf-chip-act">
          {isCloudSignedIn ? <CloudIcon /> : <LockIcon className="text-gray-500 dark:text-gray-400" />}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label="Open cloud storage settings"
      className="sf-chip"
      data-sf="chip"
    >
      {/* State segment: lock icon + "Local only" */}
      <span className="sf-chip-state">
        <LockIcon />
        <span>Local only</span>
      </span>
      {/* Action segment: "Sign in" (visual only; the button's name says what it does) */}
      <span className="sf-chip-act">Sign in</span>
    </button>
  );
}
