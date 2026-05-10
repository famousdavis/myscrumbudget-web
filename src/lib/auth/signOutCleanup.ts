// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Centralized sign-out cleanup for MyScrumBudget.
//
// Order of operations is load-bearing:
//   1. cancelAll() — abort in-flight debounced saves before credentials revoke
//   2. Remove per-user localStorage keys (explicit list below)
//   3. Reset storage mode to 'local'
//   4. Swap delegating repo back to localStorage
//   5. firebaseSignOut — revoke Firebase credentials (wrapped in try/finally)
//   6. window.location.reload() — exhaustively clear in-memory hook state
//
// Step 5/6 are wrapped in try/finally so the reload fires even when
// firebaseSignOut rejects (network failure, already-revoked token). By the
// time those steps execute, localStorage is already cleared and the repo is
// already pointing at localStorage, so the reload always delivers a clean
// local-only session. A stale Firebase token on next load is harmless —
// onAuthStateChanged will re-surface it and the app operates correctly in
// either auth state.
//
// DO NOT replace the targeted removeItem loop with repo.clear().
// repo.clear() iterates Object.values(STORAGE_KEYS) and would remove
// per-browser preferences that MUST survive sign-out:
//   - msb:theme                        (UI preference, per-browser)
//   - msb:version                      (schema version, per-browser)
//   - msb:suppressLocalStorageWarning  (per-browser UX)
// repo.clear() is the correct call in handleClearLocalData (post-migration
// cleanup) but is wrong here.
//
// PRESERVE list (these keys MUST NOT be cleared on sign-out):
//   - msb-workspace-id                 academic-integrity fingerprint (per-browser)
//   - spert_tos_accepted_version       device-scoped legal acknowledgment
//   - msb:suppressLocalStorageWarning  per-browser UX
//   - msb:theme                        per-browser UX
//   - msb:version                      per-browser schema marker
//   - spert_firstRun_seen              per-browser UX
//
// v0.28.2 (L6): also clear sessionStorage entries that hold per-user
// invitation state. sessionStorage dies on tab close but a sign-out
// without closing the tab leaves user A's invite token visible to user
// B's subsequent sign-in flow in the same tab. Server-side rules reject
// claims for the wrong account, but the leak still surfaces in
// sessionStorage and a re-claim attempt would happen.

import { signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { cancelAll } from '@/lib/storage/pendingSaveRegistry';
import { switchRepoImpl } from '@/lib/storage/repo';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import { setStorageMode } from '@/lib/storage/storageMode';

/** Per-user localStorage keys cleared on sign-out. See PRESERVE list above for exclusions. */
const CLEAR_ON_SIGN_OUT: readonly string[] = [
  'msb:projects',
  'msb:settings',
  'msb:teamPool',
  'msb:changeLog',
  'msb:originRef',
  'msb:exportAttribution',
  'msb:ratesReviewed',
  'msb:hasUploadedToCloud',
] as const;

/** Per-user sessionStorage keys cleared on sign-out (v0.28.2 / L6). */
const SESSION_CLEAR_ON_SIGN_OUT: readonly string[] = [
  'msb:invite-session',
] as const;

// v0.28.2 (L8): in-flight guard. Both the explicit sign-out path
// (AuthProvider.signOut → performSignOutCleanup) and the passive token-
// expiry path (AuthProvider subscriber sees firebaseUser === null →
// performSignOutCleanup) can race to call this. Without the guard, the
// second invocation runs cancelAll/localStorage clear redundantly, then
// firebaseSignOut on an already-revoked credential, then schedules a
// second window.location.reload() — wasted work mid-unmount. The flag
// is module-scoped so a re-entrant call short-circuits.
let cleanupInFlight = false;

/**
 * Zero-argument sign-out helper. Every sign-out entry point in the app
 * (AuthProvider.signOut, settings page, chip popover, passive token-
 * expiry detected by onAuthStateChanged) routes through this single
 * canonical sequence.
 */
export async function performSignOutCleanup(): Promise<void> {
  if (cleanupInFlight) return;
  cleanupInFlight = true;

  // 1. Abort in-flight debounced saves before credentials are revoked.
  cancelAll();

  // 2. Clear per-user localStorage keys. Individual try/catch guards against
  //    SecurityError on browsers with disabled storage.
  for (const key of CLEAR_ON_SIGN_OUT) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage disabled / SecurityError — ignore and continue.
    }
  }

  // 2b. Clear per-user sessionStorage keys (v0.28.2 / L6). Same try/catch
  //     pattern; missing keys are no-op.
  for (const key of SESSION_CLEAR_ON_SIGN_OUT) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Storage disabled / SecurityError — ignore and continue.
    }
  }

  // 3. Reset storage mode to 'local' via setItem (not removeItem); fresh
  //    sessions read 'local' directly without falling through to a default.
  try {
    setStorageMode('local');
  } catch {
    // Storage disabled — ignore.
  }

  // 4. Restore the delegating wrapper to localStorage so any final render
  //    before reload reads from the correct source.
  switchRepoImpl(createLocalStorageRepository());

  // 5 + 6. Revoke Firebase credentials, then reload. try/finally ensures the
  //    reload fires regardless of firebaseSignOut success, so the user is
  //    never left in a partially-cleaned-up state.
  try {
    if (auth) await firebaseSignOut(auth);
  } finally {
    // v0.28.2 (L8): release the in-flight flag inside the finally so a
    // future passive-expiry path on the SAME page session can succeed if
    // the production reload below somehow doesn't fire (test mocks, edge-
    // case window scenarios). In production the reload races ahead of any
    // re-entrant caller; this is defense-in-depth + makes the function
    // testable across multiple invocations in the same module instance.
    cleanupInFlight = false;
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}
