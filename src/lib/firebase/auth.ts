import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  OAuthProvider,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './config';
import { PROFILES_COL } from './collections';

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
 */
export async function signInWithMicrosoft(): Promise<void> {
  if (!auth) return;
  const provider = new OAuthProvider('microsoft.com');
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  await ensureProfile(result.user);
}

/**
 * Sign in with Google.
 */
export async function signInWithGoogle(): Promise<void> {
  if (!auth) return;
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  await ensureProfile(result.user);
}

/**
 * Sign out.
 */
export async function signOut(): Promise<void> {
  if (!auth) return;
  await firebaseSignOut(auth);
}

/**
 * Create or update user profile document in Firestore.
 * Uses merge:true so existing fields are preserved.
 * createdAt is only written when the profile doc doesn't exist yet.
 */
async function ensureProfile(user: User): Promise<void> {
  if (!db) return;
  const ref = doc(db, PROFILES_COL, user.uid);
  const existing = await getDoc(ref);
  await setDoc(ref, {
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    lastLogin: new Date().toISOString(),
    ...(!existing.exists() ? { createdAt: new Date().toISOString() } : {}),
  }, { merge: true });
}
