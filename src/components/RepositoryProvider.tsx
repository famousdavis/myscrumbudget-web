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

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  // Initialised ONCE from localStorage, then owned by React. Reading the mode
  // imperatively on every render is what let mode and repository disagree.
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

  // ⚠️ GATE — cloud mode only, and deliberately not the local path.
  // `AuthProvider` starts with `user === null` and resolves asynchronously, so
  // a cloud-mode boot would otherwise derive localStorage first and flip to
  // Firestore a tick later. Every data hook fetches on mount, so that window
  // is a real localStorage read on a cloud account — and it would make "which
  // repository is active?" a time-dependent question again, which is the
  // ambiguity this whole change exists to remove. Local mode has no auth to
  // wait on and is never gated; it is also the common case.
  if (loading && mode === 'cloud') return null;

  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
}

export function useRepository(): RepositoryContextValue {
  const ctx = useContext(RepositoryContext);
  if (!ctx) throw new Error('useRepository must be used within RepositoryProvider');
  return ctx;
}
