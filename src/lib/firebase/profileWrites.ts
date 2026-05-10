// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/lib/firebase/config';
import { SUITE_PROFILES_COL, PROFILES_COL } from '@/lib/firebase/collections';
import { normalizeDisplayName } from '@/lib/utils/getFirstName';

/**
 * Writes to spertsuite_profiles — cross-app collection used by invitation
 * Cloud Functions for email→uid lookup. Genuinely new in v0.28.0; never
 * existed before. Runs on every auth resolution from PR 1 onward.
 *
 * Intentional asymmetry with writeMyscrumbudgetProfile:
 * - Applies normalizeDisplayName (handles "Last, First" MS AD format)
 * - Skips write entirely if user.email is null (a user without an email
 *   cannot be invited by email anyway, so writing an empty-email doc to
 *   spertsuite_profiles is pointless)
 * - Uses serverTimestamp() for updatedAt
 */
export async function writeSpertsuiteProfile(user: User): Promise<void> {
  if (!user.email) return;
  if (!db) return;
  try {
    const profileData = {
      displayName: normalizeDisplayName(user.displayName ?? ''),
      email: user.email.toLowerCase(),
      photoURL: user.photoURL ?? null,
      // No uid field — doc ID is already the uid
    };
    await setDoc(
      doc(db, SUITE_PROFILES_COL, user.uid),
      { ...profileData, updatedAt: serverTimestamp() },  // serverTimestamp AFTER spread (Lesson 29)
      { merge: true },
    );
  } catch (e) {
    // v0.28.2 (L5): log only the error code. The full FirebaseError can
    // serialize document paths into the browser console, leaking UIDs.
    console.warn(
      '[profileWrites] writeSpertsuiteProfile failed:',
      (e as { code?: string })?.code ?? 'unknown',
    );
    // Error swallowed — claim still fires. CF may see stale data in error case.
    // Grep for this warning if claims show stale displayName/photoURL.
  }
}

/**
 * Writes to myscrumbudget_profiles — app-local collection.
 * Moved from auth.ts ensureProfile() so returning users' profiles are
 * also refreshed on page load, not only at explicit sign-in.
 *
 * NOTE: this now runs on every auth resolution. getDoc is called each
 * time — Firestore client cache serves most reads. Real cost on
 * cleared-cache sessions. Backlog: move createdAt to a server-side
 * trigger to eliminate the conditional read.
 *
 * Intentional asymmetry with writeSpertsuiteProfile:
 * - Does NOT apply normalizeDisplayName (preserves legacy behavior)
 * - Writes email: '' fallback when email is null (legacy behavior)
 * - Preserves the existing.exists() → createdAt pattern verbatim
 *
 * The body below mirrors src/lib/firebase/auth.ts's ensureProfile
 * exactly (Step 0l audit). This is a MOVE, not a refactor; do not
 * "improve" or normalize behavior during the relocation.
 */
export async function writeMyscrumbudgetProfile(user: User): Promise<void> {
  if (!db) return;
  try {
    const ref = doc(db, PROFILES_COL, user.uid);
    const existing = await getDoc(ref);
    await setDoc(ref, {
      displayName: user.displayName ?? '',  // no normalizeDisplayName — legacy behavior
      email: user.email ?? '',              // '' fallback — legacy behavior
      lastLogin: new Date().toISOString(),
      ...(!existing.exists() ? { createdAt: new Date().toISOString() } : {}),
    }, { merge: true });
  } catch (e) {
    // v0.28.2 (L5): log only the error code (see writeSpertsuiteProfile above).
    console.warn(
      '[profileWrites] writeMyscrumbudgetProfile failed:',
      (e as { code?: string })?.code ?? 'unknown',
    );
  }
}
