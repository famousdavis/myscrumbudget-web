// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { usePathname } from 'next/navigation';
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

interface StorageStatusPillProps {
  /** Called when the user clicks the chip. The parent (TopBar) opens the
   *  Cloud Storage modal in response. Every branch routes through this. */
  onOpen: () => void;
}

export function StorageStatusPill({ onOpen }: StorageStatusPillProps) {
  const { user } = useAuth();
  // Subscribes this component to path changes; re-renders on navigation so
  // the mode read below picks up any storage-mode flip that happened on
  // another page. Return value is intentionally ignored.
  usePathname();

  // Derived during render rather than via useEffect(setMode) to satisfy the
  // react-hooks/set-state-in-effect rule. getStorageMode() is a synchronous
  // localStorage read; `user` and pathname changes both trigger re-render,
  // so mode always reflects the current localStorage value.
  const mode: 'local' | 'cloud' = typeof window !== 'undefined' ? getStorageMode() : 'local';

  const isCloudSignedIn = mode === 'cloud' && !!user;
  const isSignedInLocal = !!user && mode !== 'cloud';
  const firstName = getFirstName(user?.displayName, user?.email);
  const initial = firstName.charAt(0).toUpperCase();

  if (isCloudSignedIn) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={`Signed in as ${firstName}. Open cloud storage settings.`}
        className="flex items-center rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        style={{ border: '0.5px solid #D1D5DB' }}
      >
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
        <span className="self-stretch" style={{ width: '0.5px', backgroundColor: '#D1D5DB' }} />
        <span className="flex items-center justify-center px-2.5 py-1">
          <CloudIcon />
        </span>
      </button>
    );
  }

  if (isSignedInLocal) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={`Signed in as ${firstName} in local mode. Open cloud storage settings.`}
        className="flex items-center rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        style={{ border: '0.5px solid #D1D5DB' }}
      >
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
        <span className="self-stretch" style={{ width: '0.5px', backgroundColor: '#D1D5DB' }} />
        <span className="flex items-center justify-center px-2.5 py-1">
          <LockIcon />
        </span>
      </button>
    );
  }

  // Signed-out branch
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label="Open cloud storage settings"
      className="flex items-center rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      style={{ border: '0.5px solid #D1D5DB' }}
    >
      <span className="flex items-center gap-1.5 py-1 pl-2.5 pr-2.5">
        <LockIcon />
        <span style={{ fontSize: 13 }} className="text-gray-400">
          Local only
        </span>
      </span>
      <span className="self-stretch" style={{ width: '0.5px', backgroundColor: '#D1D5DB' }} />
      <span className="flex items-center justify-center px-2.5 py-1">
        <span style={{ fontSize: 12, fontWeight: 500, color: '#0070f3' }}>
          Sign in
        </span>
      </span>
    </button>
  );
}
