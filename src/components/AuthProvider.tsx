// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { isFirebaseAvailable } from '@/lib/firebase/config';
import { db } from '@/lib/firebase/config';
import {
  subscribeToAuth,
  signInWithMicrosoft as doSignInMicrosoft,
  signInWithGoogle as doSignInGoogle,
} from '@/lib/firebase/auth';
import { performSignOutCleanup } from '@/lib/auth/signOutCleanup';
import { writeSpertsuiteProfile, writeMyscrumbudgetProfile } from '@/lib/firebase/profileWrites';
import { claimPendingInvitationsAndNotify } from '@/lib/firebase/claimPendingInvitations';
import { TOS_VERSION, PRIVACY_VERSION, APP_ID } from '@/lib/tos/tosConstants';
import { setTosAcceptedVersion } from '@/lib/tos/tosHelpers';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  firebaseAvailable: boolean;
  signInWithMicrosoft: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Record ToS acceptance in Firestore (shared users collection).
 * Three-way conditional: create, skip, or update based on existing doc.
 */
async function recordTosAcceptance(user: User): Promise<void> {
  if (!db) return;
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    const authProvider = user.providerData[0]?.providerId ?? 'unknown';

    if (!snap.exists()) {
      // Branch A: new user — write full record with appId
      await setDoc(ref, {
        acceptedAt: serverTimestamp(),
        tosVersion: TOS_VERSION,
        privacyPolicyVersion: PRIVACY_VERSION,
        appId: APP_ID,
        authProvider,
      });
    } else if (snap.data()?.tosVersion !== TOS_VERSION) {
      // Branch C: existing user, different ToS version — update without appId
      await setDoc(ref, {
        acceptedAt: serverTimestamp(),
        tosVersion: TOS_VERSION,
        privacyPolicyVersion: PRIVACY_VERSION,
        authProvider,
      }, { merge: true });
    }
    // Branch B (same version) or after A/C: confirm localStorage
    setTosAcceptedVersion(TOS_VERSION);
  } catch (e) {
    console.warn('[AuthProvider] Failed to record ToS acceptance:', e);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Only show loading state if Firebase is configured (otherwise no auth to wait for)
  const [loading, setLoading] = useState(isFirebaseAvailable);

  useEffect(() => {
    if (!isFirebaseAvailable) return;
    const unsubscribe = subscribeToAuth((firebaseUser) => {
      // Canonical callback shape — invariants:
      //   1. setLoading(false) is the FIRST synchronous statement.
      //   2. Callback is NOT async. All async work is void-prefixed fire-and-forget.
      //   3. setUser(firebaseUser) is the LAST synchronous statement.
      //   4. setLoading + setUser land in a single React batch — effects with
      //      deps [user] or [loading] see a clean resolved state, never an
      //      intermediate where loading is true and user is non-null.
      setLoading(false);
      if (firebaseUser && db) {
        // Serialized: spertsuite_profiles write completes BEFORE the claim CF
        // fires. Eliminates any first-sign-in race where the CF might read the
        // profile collection (Step 0h confirmed claimPendingInvitations does not
        // read profiles for the caller, but the serialized shape is strictly
        // safer and the extra microtask is imperceptible).
        void (async () => {
          await writeSpertsuiteProfile(firebaseUser);
          claimPendingInvitationsAndNotify(firebaseUser);
        })();
        // Parallel: writeMyscrumbudgetProfile has no happens-before requirement
        // vs. the claim CF. The legacy collection is consulted only by
        // findUidByEmail in addProjectMember, gated behind the flag-off
        // SharingSection (and removed entirely once the flag flips in PR 3).
        void writeMyscrumbudgetProfile(firebaseUser);
        recordTosAcceptance(firebaseUser).catch(() => {});
      }
      setUser(firebaseUser);
    });
    return unsubscribe;
  }, []);

  const signInWithMicrosoft = useCallback(async () => {
    await doSignInMicrosoft();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await doSignInGoogle();
  }, []);

  const signOut = useCallback(async () => {
    await performSignOutCleanup();
    // Note: performSignOutCleanup triggers window.location.reload() in its
    // finally block, so setUser(null) and any post-await code here is moot —
    // the page is about to unmount. Kept as async/await to preserve the
    // existing Promise-returning contract on useAuth().signOut().
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      firebaseAvailable: isFirebaseAvailable,
      signInWithMicrosoft,
      signInWithGoogle,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
