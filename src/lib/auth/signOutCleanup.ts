// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Centralized sign-out cleanup for MyScrumBudget.
//
// Order of operations is load-bearing:
//   1. cancelAll() — abort in-flight debounced saves before credentials revoke
//   2a. Remove PII and UX-flag localStorage keys (unconditionally)
//   2b. Remove user-created data + fingerprint keys ONLY when mode is 'cloud'
//       (local-mode users: these keys are their ONLY copy — do not wipe)
//   2c. Clear per-user sessionStorage keys (unconditionally — not mode-gated)
//   3. Reset storage mode to 'local'
//   4. Swap delegating repo back to localStorage
//   5. firebaseSignOut — revoke Firebase credentials (wrapped in try/finally)
//   6. window.location.reload() — exhaustively clear in-memory hook state
//
// WHY mode is read BEFORE step 3:
//   setStorageMode('local') in step 3 overwrites the mode key.
//   Reading after step 3 always returns 'local', making the cloud-data
//   clear in step 2b a no-op. Mode MUST be read before any mutation.
//
// DO NOT replace the targeted removeItem loops with repo.clear().
//   repo.clear() iterates Object.values(STORAGE_KEYS) and removes
//   per-browser preferences that MUST survive sign-out:
//     msb:theme                       (UI preference, per-browser)
//     msb:version                     (schema version, per-browser)
//     msb:suppressLocalStorageWarning (per-browser UX)
//   repo.clear() is correct in handleClearLocalData (post-migration cleanup)
//   but is WRONG here.
//
// PRESERVE list (must NOT be cleared on sign-out, either mode):
//   msb-workspace-id            academic-integrity fingerprint (per-browser)
//   spert_tos_accepted_version  device-scoped legal acknowledgment
//   msb:suppressLocalStorageWarning  per-browser UX
//   msb:theme                   per-browser UX
//   msb:version                 per-browser schema marker
//   spert_firstRun_seen         per-browser UX
//
// v0.31.0 (E2a): user-created data keys and fingerprint keys (msb:originRef,
//   msb:changeLog) moved from unconditional clear to CLOUD_ONLY_CLEAR.
//   These fingerprint keys are per-browser identity — clearing them on
//   local-mode sign-out broke academic-integrity tracking continuity.
//   Prior to v0.31.0, all keys cleared unconditionally, causing data loss
//   for: local mode → sign in to Firebase → sign out.

import { signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { cancelAll } from '@/lib/storage/pendingSaveRegistry';
import { switchRepoImpl } from '@/lib/storage/repo';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import { getStorageMode, setStorageMode } from '@/lib/storage/storageMode';

/** PII and UX-flag keys cleared on every sign-out regardless of storage mode. */
const ALWAYS_CLEAR_ON_SIGN_OUT: readonly string[] = [
  'msb:exportAttribution',
  'msb:ratesReviewed',
  'msb:hasUploadedToCloud',
] as const;

/**
 * User-created data and fingerprint keys cleared ONLY when signing out of
 * cloud mode. In local mode these keys ARE the user's only copy of their work.
 */
const CLOUD_ONLY_CLEAR_ON_SIGN_OUT: readonly string[] = [
  'msb:projects',
  'msb:settings',
  'msb:teamPool',
  'msb:changeLog',
  'msb:originRef',
] as const;

/**
 * Per-user sessionStorage keys cleared unconditionally on sign-out.
 * sessionStorage is tab-scoped; these are per-session, not per-browser.
 */
const SESSION_CLEAR_ON_SIGN_OUT: readonly string[] = [
  'msb:invite-session',
] as const;

// In-flight guard: both explicit sign-out (Path 1) and passive token-expiry
// (Path 3) can race. Guard prevents double-execution. Released in finally so
// future passive-expiry calls on the same page session can succeed.
let cleanupInFlight = false;

export async function performSignOutCleanup(): Promise<void> {
  if (cleanupInFlight) return;
  cleanupInFlight = true;

  // 1. Abort in-flight debounced saves before credentials are revoked.
  cancelAll();

  // Read mode NOW — before step 3 overwrites the key with 'local'.
  const currentMode = getStorageMode();

  // 2a. Clear PII and UX-flag keys unconditionally.
  for (const key of ALWAYS_CLEAR_ON_SIGN_OUT) {
    try { localStorage.removeItem(key); } catch { /* SecurityError — ignore */ }
  }

  // 2b. Clear user-created data only when signing out of cloud mode.
  if (currentMode === 'cloud') {
    for (const key of CLOUD_ONLY_CLEAR_ON_SIGN_OUT) {
      try { localStorage.removeItem(key); } catch { /* SecurityError — ignore */ }
    }
  }

  // 2c. Clear per-user sessionStorage keys unconditionally (not mode-gated).
  for (const key of SESSION_CLEAR_ON_SIGN_OUT) {
    try { sessionStorage.removeItem(key); } catch { /* SecurityError — ignore */ }
  }

  // 3. Reset storage mode to 'local'.
  try { setStorageMode('local'); } catch { /* Storage disabled — ignore */ }

  // 4. Restore the delegating wrapper to localStorage.
  switchRepoImpl(createLocalStorageRepository());

  // 5 + 6. Revoke credentials, then reload. finally ensures reload fires
  //         even when firebaseSignOut rejects.
  try {
    if (auth) await firebaseSignOut(auth);
  } finally {
    cleanupInFlight = false;
    if (typeof window !== 'undefined') window.location.reload();
  }
}
