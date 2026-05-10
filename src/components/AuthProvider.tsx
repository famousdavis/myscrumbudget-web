// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
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
  // v0.28.2 (L8): track the previous Firebase user so the subscriber can
  // detect a passive transition to null (token expiry, refresh failure,
  // server-side revocation) and route it through performSignOutCleanup.
  // Without this, a passive expiry leaves localStorage/storageMode/repo
  // pointing at the previous user's cloud session and a pending debounced
  // save can fire against a revoked credential.
  const previousUserRef = useRef<User | null>(null);

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
      // v0.28.2 (L8): passive sign-out detection. Fire performSignOutCleanup
      // when we transition from a non-null user to null without an explicit
      // signOut() call. The cleanup is idempotent (in-flight guard inside
      // performSignOutCleanup) so the explicit-signOut path that ALSO
      // ultimately fires onAuthStateChanged(null) here is a no-op the
      // second time around.
      if (!firebaseUser && previousUserRef.current) {
        void performSignOutCleanup();
      }
      previousUserRef.current = firebaseUser;
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
        // vs. the claim CF. The legacy myscrumbudget_profiles collection is
        // now read-only (no client write paths after v0.28.2 / L1 deleted
        // findUidByEmail + addProjectMember + the SharingSection caller).
        // We keep writing the profile here so the BulkSharingSection
        // member-list `getProjectMembers` fan-out can resolve emails for
        // existing members.
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
