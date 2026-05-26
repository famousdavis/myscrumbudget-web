// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Tab-close flush handler. Registers pagehide and beforeunload listeners
 * that flush pending debounced saves before the page unloads.
 *
 * Credential guard: in cloud mode with no authenticated user, pending writes
 * would fail with PERMISSION_DENIED. cancelAll() is called instead.
 * Local-mode saves always flush — localStorage.setItem is synchronous.
 *
 * Known limitation (cloud mode): MSB uses memoryLocalCache() (no IndexedDB).
 * The setDoc call is initiated and best-effort; network round-trip may not
 * complete before unload. pagehide with bfcache gives additional time.
 */

import { flushAll, cancelAll } from '@/lib/storage/pendingSaveRegistry';
import { getStorageMode } from '@/lib/storage/storageMode';
import { auth } from '@/lib/firebase/config';

function handleTabClose(): void {
  if (getStorageMode() === 'cloud' && !auth?.currentUser) {
    cancelAll();
    return;
  }
  void flushAll();
}

export function registerTabCloseFlush(): () => void {
  if (typeof window === 'undefined') return () => {};
  const handlePageHide = () => handleTabClose();
  const handleBeforeUnload = () => handleTabClose();
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => {
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}
