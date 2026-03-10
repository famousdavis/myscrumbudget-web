import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  OAuthProvider,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './config';

const PROFILES_COLLECTION = 'myscrumbudget_profiles';

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
 * Uses merge:true so createdAt is only set on first sign-in.
 */
async function ensureProfile(user: User): Promise<void> {
  if (!db) return;
  const ref = doc(db, PROFILES_COLLECTION, user.uid);
  await setDoc(ref, {
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    lastLogin: new Date().toISOString(),
    ...(!user.metadata.creationTime ? {} : { createdAt: new Date().toISOString() }),
  }, { merge: true });
}
