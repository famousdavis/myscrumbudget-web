// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Module-level registry of `cancel` callbacks from every mounted
 * `useDebouncedSave` instance.
 *
 * Used by `performSignOutCleanup` to abort in-flight debounced saves
 * BEFORE Firebase credentials are revoked — otherwise a save timer can
 * fire against a revoked token and produce a PERMISSION_DENIED error
 * (now swallowed as console.error; historically an unhandled rejection).
 *
 * Cancel-only by design: sign-out is an explicit user action; flushing
 * pending saves would open a revocation race window. Any edit not yet
 * persisted at sign-out is intentionally discarded.
 */

const cancels = new Set<() => void>();

/**
 * Register a cancel callback. Returns an unregister function to call
 * from the registrant's cleanup (e.g., a React effect cleanup).
 */
export function register(cancel: () => void): () => void {
  cancels.add(cancel);
  return () => {
    cancels.delete(cancel);
  };
}

/**
 * Invoke every registered cancel callback. Does NOT clear the set —
 * registrants remain registered for any subsequent sign-out in the
 * same session (defensive; sign-out typically ends with a full reload).
 */
export function cancelAll(): void {
  for (const cancel of cancels) {
    cancel();
  }
}
