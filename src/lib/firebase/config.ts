import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, memoryLocalCache, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Firebase is only initialized when config is present.
 * When env vars are missing (e.g., deployment without Firebase),
 * `db` and `auth` are null and the app operates in local-only mode.
 * The Settings UI hides the cloud toggle when Firebase is unavailable.
 */
const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

const app = isFirebaseConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp())
  : null;

// Use initializeFirestore (not getFirestore) for cache configuration.
// memoryLocalCache avoids stale IndexedDB cache issues (see ARCHITECTURE.md §21.5).
// HMR guard: initializeFirestore throws if called twice with different options.
let db: Firestore | null = null;
if (app) {
  try {
    db = initializeFirestore(app, { localCache: memoryLocalCache() });
  } catch {
    // Already initialized during HMR — return existing instance
    db = getFirestore(app);
  }
}

const auth: Auth | null = app ? getAuth(app) : null;

/** True when Firebase SDK is initialized and available. */
const isFirebaseAvailable = isFirebaseConfigured && app !== null;

export { db, auth, isFirebaseAvailable };
