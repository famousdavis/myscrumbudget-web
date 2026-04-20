// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getStorageMode } from '@/lib/storage/storageMode';
import { getFirstName } from '@/lib/utils/getFirstName';

function CloudIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
        fill="#0070f3"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="#9CA3AF" strokeWidth="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function StorageStatusPill() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mode, setMode] = useState<'local' | 'cloud'>('local');
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const wrapperRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Re-read storage mode on every navigation OR user-state change. Without
  // the user dependency, a sign-in that does not navigate (e.g., signing in
  // from the Settings page) leaves the pill stuck in its prior local/cloud
  // branch — for a user who signs in while Local is selected, that means
  // rendering the signed-out chip to an already-authenticated user.
  useEffect(() => {
    setMode(getStorageMode());
  }, [pathname, user]);

  const isCloudSignedIn = mode === 'cloud' && !!user;
  const isSignedInLocal = !!user && mode !== 'cloud';
  const firstName = getFirstName(user?.displayName, user?.email);
  const initial = firstName.charAt(0).toUpperCase();

  // Escape + outside-click dismissal (signed-in popover only)
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (signingOut) return;
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (signingOut) return;
      const t = e.target as Node;
      if (
        !wrapperRef.current?.contains(t) &&
        !popoverRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open, signingOut]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // Thin wrapper: signOut delegates to performSignOutCleanup, which
      // cancels pending saves, clears per-user keys, resets mode, swaps the
      // repo, revokes credentials, and reloads. The setMode/setOpen cleanup
      // is moot post-reload; kept only to keep the button dimmed for the
      // brief window between click and unmount.
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  if (isCloudSignedIn) {
    return (
      <div className="relative">
        <button
          ref={wrapperRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Signed in as ${firstName}. Open account menu.`}
          className="flex items-center rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          style={{ border: '0.5px solid #D1D5DB' }}
        >
          {/* Left segment: avatar + first name */}
          <span className="flex items-center gap-1.5 py-1 pl-1 pr-2.5">
            <span
              className="flex items-center justify-center rounded-full text-white shrink-0"
              style={{
                width: 26,
                height: 26,
                backgroundColor: '#0070f3',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {initial}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500 }} className="text-gray-900 dark:text-gray-100">
              {firstName}
            </span>
          </span>
          {/* Vertical divider */}
          <span className="self-stretch" style={{ width: '0.5px', backgroundColor: '#D1D5DB' }} />
          {/* Right segment: cloud icon */}
          <span className="flex items-center justify-center px-2.5 py-1">
            <CloudIcon />
          </span>
        </button>

        {open && (
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Account menu"
            className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="px-4 py-3">
              <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {user?.displayName || firstName}
              </div>
              {user?.email && (
                <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {user.email}
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 dark:border-zinc-700" />
            <div className="flex justify-end gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => { if (!signingOut) setOpen(false); }}
                disabled={signingOut}
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isSignedInLocal) {
    return (
      <div className="relative">
        <button
          ref={wrapperRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Signed in as ${firstName} in local mode. Open account menu.`}
          className="flex items-center rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          style={{ border: '0.5px solid #D1D5DB' }}
        >
          {/* Left segment: avatar + first name (same as cloud branch) */}
          <span className="flex items-center gap-1.5 py-1 pl-1 pr-2.5">
            <span
              className="flex items-center justify-center rounded-full text-white shrink-0"
              style={{
                width: 26,
                height: 26,
                backgroundColor: '#0070f3',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {initial}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500 }} className="text-gray-900 dark:text-gray-100">
              {firstName}
            </span>
          </span>
          {/* Vertical divider */}
          <span className="self-stretch" style={{ width: '0.5px', backgroundColor: '#D1D5DB' }} />
          {/* Right segment: lock icon (local mode) */}
          <span className="flex items-center justify-center px-2.5 py-1">
            <LockIcon />
          </span>
        </button>

        {open && (
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Account menu"
            className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="px-4 py-3">
              <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {user?.displayName || firstName}
              </div>
              {user?.email && (
                <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {user.email}
                </div>
              )}
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Storage: Local only
              </div>
            </div>
            <div className="border-t border-gray-200 dark:border-zinc-700" />
            <div className="flex flex-col gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  router.push('/settings#cloud-storage');
                  setOpen(false);
                }}
                disabled={signingOut}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Switch to Cloud Storage
              </button>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { if (!signingOut) setOpen(false); }}
                  disabled={signingOut}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Signed-out branch: single button → /settings
  return (
    <button
      type="button"
      onClick={() => router.push('/settings')}
      aria-label="Sign in"
      className="flex items-center rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      style={{ border: '0.5px solid #D1D5DB' }}
    >
      {/* Left segment: lock icon + "Local only" */}
      <span className="flex items-center gap-1.5 py-1 pl-2.5 pr-2.5">
        <LockIcon />
        <span style={{ fontSize: 13 }} className="text-gray-400">
          Local only
        </span>
      </span>
      {/* Vertical divider */}
      <span className="self-stretch" style={{ width: '0.5px', backgroundColor: '#D1D5DB' }} />
      {/* Right segment: "Sign in" */}
      <span className="flex items-center justify-center px-2.5 py-1">
        <span style={{ fontSize: 12, fontWeight: 500, color: '#0070f3' }}>
          Sign in
        </span>
      </span>
    </button>
  );
}
