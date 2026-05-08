// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  OAuthProvider,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { auth } from './config';

/**
 * Subscribe to auth state changes.
 * Returns unsubscribe function.
 */
export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

/**
 * Sign in with Microsoft (Azure AD).
 *
 * Profile-write side effect (myscrumbudget_profiles + spertsuite_profiles)
 * is now handled by AuthProvider's onAuthStateChanged callback, which fires
 * after the popup resolves. Returning users on page reload also get their
 * profiles refreshed there — previously only the explicit signInWithPopup
 * path wrote profiles.
 */
export async function signInWithMicrosoft(): Promise<void> {
  if (!auth) return;
  const provider = new OAuthProvider('microsoft.com');
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
}

/**
 * Sign in with Google.
 * See signInWithMicrosoft for profile-write semantics.
 */
export async function signInWithGoogle(): Promise<void> {
  if (!auth) return;
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

/**
 * Sign out.
 */
export async function signOut(): Promise<void> {
  if (!auth) return;
  await firebaseSignOut(auth);
}
