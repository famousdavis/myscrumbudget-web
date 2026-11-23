// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import {
  createContext, useCallback, useContext, useMemo, useState, type ReactNode,
} from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createFirestoreRepository } from '@/lib/storage/firestoreRepo';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import { getStorageMode, setStorageMode, type StorageMode } from '@/lib/storage/storageMode';
import type { Repository } from '@/lib/storage/repository';

/**
 * The active repository, DERIVED from (storage mode, authenticated user).
 *
 * ⚠️ WHY THIS EXISTS — the defect it replaces (v0.37.0).
 * Until v0.36.16 the active repository was a module-global inside
 * `src/lib/storage/repo.ts`, initialised to localStorage on every module load
 * and mutated imperatively by four call sites. None of those sites ran on the
 * boot path, and two of them called `window.location.reload()` immediately
 * after mutating the global — destroying the value they had just set. The
 * result: after ANY page load, cloud mode read and wrote localStorage while
 * the UI displayed the cloud badge. Nothing failed; the data simply went to
 * the wrong store, silently.
 *
 * The property that makes this shape safe is not that it is "more React". It
 * is that "which repository is active?" became a QUESTION WITH AN ANSWER. The
 * regression test in `__tests__/RepositoryProvider.test.tsx` mounts this
 * provider in cloud mode with a user and asserts the yielded repository is the
 * Firestore implementation — an assertion that could not be written at all
 * against a module global mutated from event handlers. A fix whose correctness
 * cannot be asserted is not a fix.
 *
 * ⚠️ DERIVATION IS TOTAL — there is no fallback. If `mode === 'cloud'` and a
 * user is present, this constructs the Firestore repository or it throws.
 * Falling back to localStorage on failure would reproduce the exact defect
 * above: a UI claiming cloud while writes land locally. Under vitest `db` is
 * null (no `.env.local` is loaded) and `createFirestoreRepository` throws on
 * entry, so any test exercising the cloud path must mock
 * `@/lib/firebase/config` — see the header of `firestoreRepo.test.ts`.
 */
interface RepositoryContextValue {
  /** The repository every data hook must read and write through. */
  repository: Repository;
  /** The persisted storage mode. Provider state, not a localStorage read. */
  mode: StorageMode;
  /**
   * True only when the derived repository is the Firestore implementation.
   * `mode === 'cloud'` alone is NOT sufficient — cloud mode with no resolved
   * user derives localStorage, which is the state this flag exists to keep
   * visible rather than implied.
   */
  isCloud: boolean;
  /** Persist a new storage mode and re-derive the repository from it. */
  switchMode: (next: StorageMode) => void;
}

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

/**
 * What the provider holds: the derived value, plus whether a consumer may see
 * it yet. Internal: only `RepositoryGate` reads it.
 */
interface RepositoryState {
  value: RepositoryContextValue;
  /** False only while a cloud session's auth is still resolving. */
  ready: boolean;
}
const RepositoryStateContext = createContext<RepositoryState | null>(null);

/**
 * ⚠️ THE PROVIDER NEVER BLANKS, AND THE CONTEXT COMES FROM `RepositoryGate`
 * (FRAME26, v0.45.0). Until v0.44.14 this provider itself returned `null`
 * while a cloud session's auth resolved, and it sat inside `MigrationGuard`,
 * around the page only. The SPERT® Suite frame puts the account chip and the
 * notices OUTSIDE `<main>`, so the providers now wrap the whole frame (the
 * layout), and a provider that returned `null` there would blank the brand,
 * the navigation and the footer for every cloud user until auth resolved.
 *
 * So the state and the derivation live here, at the root, and the `null` moved
 * to `RepositoryGate`, which wraps exactly what this provider used to: the page
 * body, the invitation banner and the Cloud Storage modal. The gate is ALSO
 * what provides `RepositoryContext`, so `useRepository()` outside a gate throws
 * exactly as it threw outside the provider before. The guarantee above — no
 * consumer ever sees a repository before a cloud session's auth resolves — is
 * still true BY CONSTRUCTION, not by where someone remembered to put a gate.
 *
 * ⚠️ `useState(() => getStorageMode())` reads localStorage, so the server
 * (always `'local'`) and a cloud user's browser disagree on the first render.
 * Nothing renders that value outside a gate, and every gate sits inside a
 * `MigrationGuard`, which renders nothing on the server and on the first
 * client render, so the disagreement never reaches the DOM.
 * `shell.hydration.test.tsx` holds this.
 */
export function RepositoryProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<StorageMode>(() => getStorageMode());

  const uid = user?.uid ?? null;

  const repository = useMemo<Repository>(
    () => (mode === 'cloud' && uid
      ? createFirestoreRepository(uid)
      : createLocalStorageRepository()),
    [mode, uid],
  );

  const switchMode = useCallback((next: StorageMode) => {
    setStorageMode(next);
    setMode(next);
  }, []);

  const value = useMemo<RepositoryContextValue>(
    () => ({ repository, mode, isCloud: mode === 'cloud' && uid !== null, switchMode }),
    [repository, mode, uid, switchMode],
  );

  const ready = !(loading && mode === 'cloud');
  const state = useMemo<RepositoryState>(() => ({ value, ready }), [value, ready]);

  return <RepositoryStateContext.Provider value={state}>{children}</RepositoryStateContext.Provider>;
}

/**
 * Renders its children only once a consumer may see the repository: never
 * while a cloud session's auth is still resolving (deriving localStorage then
 * and flipping a tick later would put the boot-state question back in play —
 * every data hook fetches on mount). Local mode is never gated: there is no
 * auth to wait for. Every gate shares the provider's one state, so a mode
 * switch made under one gate is seen under every other.
 */
export function RepositoryGate({ children }: { children: ReactNode }) {
  const state = useContext(RepositoryStateContext);
  if (!state) throw new Error('RepositoryGate must be used within RepositoryProvider');
  if (!state.ready) return null;
  return <RepositoryContext.Provider value={state.value}>{children}</RepositoryContext.Provider>;
}

export function useRepository(): RepositoryContextValue {
  const ctx = useContext(RepositoryContext);
  if (!ctx) throw new Error('useRepository must be used within RepositoryProvider, under a RepositoryGate');
  return ctx;
}
