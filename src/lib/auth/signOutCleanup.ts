// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Centralized sign-out cleanup for MyScrumBudget.
//
// Order of operations is load-bearing:
//   1. cancelAll() — abort in-flight debounced saves before credentials revoke
//   2a. Remove PII and UX-flag localStorage keys (unconditionally)
//   2b. Remove user-created data + fingerprint keys ONLY when mode is 'cloud'
//       AND the cloud copy is CONFIRMED to exist (see confirmCloudCopy below)
//       (local-mode users: these keys are their ONLY copy — do not wipe)
//   2c. Clear per-user sessionStorage keys (unconditionally — not mode-gated)
//   3. Reset storage mode to 'local'
//   4. firebaseSignOut — revoke Firebase credentials (wrapped in try/finally)
//   5. window.location.reload() — exhaustively clear in-memory hook state
//
// v0.37.0: the former step 4 ("swap delegating repo back to localStorage") is
//   GONE, along with the module global it mutated. The active repository is now
//   derived from (storage mode, authenticated user) by RepositoryProvider, so
//   resetting the mode in step 3 and clearing the user in step 4 is the whole
//   of what used to need an explicit swap.
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
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import { createFirestoreRepository } from '@/lib/storage/firestoreRepo';
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

/**
 * True while a local→cloud upload is running. Set by CloudStorageSection around
 * `confirmUpload` / `confirmReupload`; read by `confirmCloudCopy` below.
 *
 * ⚠️ WHY THIS EXISTS. `confirmUpload` flips the app to cloud mode BEFORE the
 * upload finishes, and `importAll` then writes settings, the team pool, and one
 * `getDoc` + `setDoc` per project — seconds for a real dataset. A sign-out
 * inside that window finds mode `'cloud'` and a cloud that already holds the
 * uploaded HEAD under still-valid credentials, so `confirmCloudCopy` returned
 * true and step 2b deleted the local keys. Sign-out then revoked the credential,
 * the next `setDoc` rejected, and the upload's own catch flipped the mode back
 * to local — with the local keys already gone. The un-uploaded TAIL existed
 * nowhere.
 *
 * ⚠️ THE BUTTON GUARD IS NOT A SUBSTITUTE FOR THIS, which is why both exist.
 * Disabling Sign out while migrating covers the click. It cannot cover the
 * PASSIVE path: a token expiring mid-upload drives `AuthProvider` to a null
 * user and calls this same cleanup with no click anywhere.
 *
 * ⚠️ IN-MEMORY AND PER-PAGE-SESSION, DELIBERATELY — do NOT move this into
 * `cloudFlipHelpers.ts` or otherwise back it with localStorage. Every function
 * in that module is a storage read/write, and a PERSISTED "upload in flight"
 * would survive the reload at the end of sign-out and block every subsequent
 * cleanup forever. A crashed tab must forget this flag; that is the safe
 * direction, and it is the same reason `cleanupInFlight` above is a plain
 * module variable.
 *
 * A boolean rather than a counter: concurrent uploads are not reachable (the
 * upload buttons are disabled while `migrating`), and a counter that leaked an
 * increment would fail CLOSED forever rather than recovering on the next call.
 */
let uploadInFlight = false;

/** Mark a local→cloud upload as started. Pair with `endCloudUpload` in a `finally`. */
export function beginCloudUpload(): void {
  uploadInFlight = true;
}

/** Mark it finished — on success OR failure. Must run in a `finally`. */
export function endCloudUpload(): void {
  uploadInFlight = false;
}

/**
 * Bound on the cloud-copy check. A sign-out must not hang on a dead network,
 * and a timeout is failure — which skips the clear, the safe direction.
 */
const CLOUD_CHECK_TIMEOUT_MS = 5000;

/**
 * Confirm the cloud actually holds this user's data before step 2b wipes the
 * local copy.
 *
 * ⚠️ WHY THIS EXISTS (v0.37.0). Step 2b clears msb:projects / settings /
 * teamPool / changeLog / originRef whenever the mode is 'cloud'. That is
 * correct ONLY if the cloud is really holding the data — an assumption the
 * v0.37.0 defect falsified. While the active repository was a module global
 * reset to localStorage on every page load, a "cloud mode" user's work was
 * being written to localStorage, and this function's caller would then delete
 * it on sign-out as redundant. That is what turned a silent misrouting bug
 * into a data-loss trigger.
 *
 * ⚠️ THE ASYMMETRY IS THE WHOLE DESIGN: clearing is tidy-up. Failing to tidy
 * up leaves stale keys, which is harmless. Clearing wrongly destroys the only
 * copy. So EVERY uncertain outcome — throw, timeout, unconfigured Firebase, no
 * current user, empty cloud alongside non-empty local — returns false.
 *
 * ⚠️ DIRECT CONSTRUCTION, and it is a sanctioned exception rather than an
 * oversight. Everywhere else the repository is injected from
 * RepositoryProvider. It cannot be injected here: every caller of
 * performSignOutCleanup funnels through AuthProvider (its own signOut callback
 * and its passive token-expiry path), and AuthProvider sits ABOVE
 * RepositoryProvider in the tree — the provider consumes useAuth, so the
 * nesting cannot be inverted. Threading the repository down is not merely
 * awkward, it is structurally unavailable.
 *
 * Runs BEFORE step 5, so the Firebase credential is still live.
 */
async function confirmCloudCopy(): Promise<boolean> {
  // An upload in progress means the cloud holds a PREFIX of the local data, not
  // all of it. Checked first, and before any network call: a partial cloud copy
  // reads as a complete one to every check below it, because they ask whether
  // the cloud has projects rather than whether it has all of them.
  if (uploadInFlight) {
    console.warn(
      '[signOutCleanup] Local data kept: a cloud upload is still in flight.',
    );
    return false;
  }

  try {
    const uid = auth?.currentUser?.uid;
    if (!uid) return false;

    const cloudProjects = await Promise.race([
      createFirestoreRepository(uid).getProjects(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('cloud-check-timeout')), CLOUD_CHECK_TIMEOUT_MS),
      ),
    ]);
    if (cloudProjects.length > 0) return true;

    // Cloud is empty. That is only safe to act on when local is empty too —
    // otherwise the local keys are the sole copy and must survive.
    const localProjects = await createLocalStorageRepository().getProjects();
    if (localProjects.length === 0) return true;

    console.warn(
      '[signOutCleanup] Local data kept: cloud copy is empty while local is not.',
    );
    return false;
  } catch (e) {
    // Code only — never the payload (v0.28.2 / M6 log hygiene).
    console.warn(
      '[signOutCleanup] Local data kept: cloud copy could not be confirmed:',
      (e as { code?: string; message?: string })?.code
        ?? (e as { message?: string })?.message
        ?? 'unknown',
    );
    return false;
  }
}

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

  // 2b. Clear user-created data only when signing out of cloud mode AND the
  //     cloud copy is confirmed present. See confirmCloudCopy for why every
  //     uncertain answer skips the clear.
  if (currentMode === 'cloud' && await confirmCloudCopy()) {
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

  // 4 + 5. Revoke credentials, then reload. finally ensures reload fires
  //         even when firebaseSignOut rejects. No repository swap is needed —
  //         RepositoryProvider re-derives from the mode reset in step 3.
  try {
    if (auth) await firebaseSignOut(auth);
  } finally {
    cleanupInFlight = false;
    if (typeof window !== 'undefined') window.location.reload();
  }
}
