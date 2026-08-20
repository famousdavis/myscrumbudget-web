// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The regression guard for the v0.37.0 cloud-storage defect.
 *
 * ⚠️ WHAT THE DEFECT WAS. The active repository was a module global in
 * `src/lib/storage/repo.ts`, initialised to localStorage on every module load
 * and mutated only from user-action handlers — none of which ran on the boot
 * path, and two of which called `window.location.reload()` immediately after
 * mutating it. So after ANY page load, cloud mode read and wrote localStorage
 * while the UI showed the cloud badge. Nothing threw; the data went to the
 * wrong store, silently.
 *
 * ⚠️ WHY THIS FILE IS THE DELIVERABLE AND THE REFACTOR IS THE MEANS. No test
 * of this shape could be written against a module global mutated from event
 * handlers — "which repository is active on a fresh cloud-mode boot?" had no
 * addressable answer. Making the answer addressable is the fix; this file is
 * what collects on it. The FIRST test below is the one that matters: a fresh
 * mount, cloud mode, authenticated user, and NO prior mode-switch action.
 *
 * ⚠️ THE FACTORIES ARE REAL, only spied. A branded stub (`{ __impl: 'cloud' }`)
 * would pass just as well against a provider that returns the wrong thing for
 * the right reason, because the brand would be whatever the test author wrote.
 * Here the assertions are identity assertions against what the REAL factory
 * returned, plus the uid it was called with.
 *
 * ⚠️ `db` is null under vitest (no `.env.local`), and
 * `createFirestoreRepository` opens with `if (!db) throw` — so the config mock
 * below is load-bearing, not decorative. Same trap as firestoreRepo.test.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEffect, useRef } from 'react';
import { render, screen, act } from '@testing-library/react';
import { setStorageMode } from '@/lib/storage/storageMode';

const auth = vi.hoisted(() => ({
  state: { user: null as { uid: string } | null, loading: false },
}));

vi.mock('@/lib/firebase/config', () => ({ db: {} }));
// `createFirestoreRepository` builds one DocumentReference at construction
// time, and the real `doc()` rejects a stub db. Only that one call is replaced;
// the repository factory itself stays real, and no Firestore I/O is performed
// by any test in this file — construction is the whole of what is exercised.
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return { ...actual, doc: (_db: unknown, col: string, id: string) => ({ __doc: `${col}/${id}` }) };
});
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: auth.state.user, loading: auth.state.loading }),
}));
vi.mock('@/lib/storage/firestoreRepo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage/firestoreRepo')>();
  return { createFirestoreRepository: vi.fn(actual.createFirestoreRepository) };
});
vi.mock('@/lib/storage/localStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage/localStorage')>();
  return { ...actual, createLocalStorageRepository: vi.fn(actual.createLocalStorageRepository) };
});

import { RepositoryProvider, useRepository } from '../RepositoryProvider';
import { createFirestoreRepository } from '@/lib/storage/firestoreRepo';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import type { Repository } from '@/lib/storage/repository';

const makeCloud = vi.mocked(createFirestoreRepository);
const makeLocal = vi.mocked(createLocalStorageRepository);

/**
 * What the last consumer COMMIT saw.
 *
 * ⚠️ Published from an effect, not during render. React's compiler lint rule
 * rejects a component mutating anything declared outside it during render —
 * correctly, since render must be pure — and that includes writing properties
 * of an outer object, not just reassigning a binding. `render()` and `act()`
 * both flush effects, so every assertion below still reads the current commit.
 *
 * `instance` is a per-mount ref identity. Comparing it across a mode flip is a
 * direct test of "the component did not remount", where a render counter would
 * only be circumstantial — a remount also increments a counter.
 */
const capture = {
  seen: null as { repository: Repository; mode: string; isCloud: boolean } | null,
  switchMode: null as ((m: 'local' | 'cloud') => void) | null,
  instance: null as object | null,
  commits: 0,
};

function Probe() {
  const ctx = useRepository();
  const instanceRef = useRef({});
  useEffect(() => {
    capture.seen = { repository: ctx.repository, mode: ctx.mode, isCloud: ctx.isCloud };
    capture.switchMode = ctx.switchMode;
    capture.instance = instanceRef.current;
    capture.commits += 1;
  });
  return <div data-testid="probe">rendered</div>;
}

function mount() {
  return render(<RepositoryProvider><Probe /></RepositoryProvider>);
}

/** The value the spied cloud factory most recently returned. */
function lastCloudResult() {
  const results = makeCloud.mock.results;
  return results[results.length - 1]?.value;
}
function lastLocalResult() {
  const results = makeLocal.mock.results;
  return results[results.length - 1]?.value;
}

beforeEach(() => {
  localStorage.clear();
  auth.state.user = null;
  auth.state.loading = false;
  capture.seen = null;
  capture.switchMode = null;
  capture.instance = null;
  capture.commits = 0;
  makeCloud.mockClear();
  makeLocal.mockClear();
});

describe('mock self-check — nothing below means anything without this', () => {
  it('the two factories are distinguishable and both are really invoked', () => {
    setStorageMode('local');
    mount();
    expect(makeLocal).toHaveBeenCalledTimes(1);
    expect(makeCloud).not.toHaveBeenCalled();
    // The spies wrap the REAL factories, so a returned value is a real
    // Repository — not a brand this test invented.
    expect(typeof lastLocalResult().getProjects).toBe('function');
  });
});

describe('RepositoryProvider — derivation on a FRESH MOUNT', () => {
  it('cloud mode + authenticated user yields the Firestore repository', () => {
    // ⚠️ THE REGRESSION GUARD. No mode-switch action has run in this test —
    // this is a boot, exactly the path where the old module global was
    // localStorage and stayed localStorage.
    setStorageMode('cloud');
    auth.state.user = { uid: 'uid-boot-1' };

    mount();

    expect(makeCloud).toHaveBeenCalledTimes(1);
    expect(makeCloud).toHaveBeenCalledWith('uid-boot-1');
    expect(capture.seen!.repository).toBe(lastCloudResult());
    expect(capture.seen!.isCloud).toBe(true);
    // And it is NOT the localStorage implementation — asserted directly rather
    // than inferred, because "is cloud" and "is not local" failed together in
    // the defect and must be able to fail apart here.
    expect(makeLocal).not.toHaveBeenCalled();
  });

  it('local mode yields the localStorage repository', () => {
    setStorageMode('local');
    auth.state.user = { uid: 'uid-boot-1' };

    mount();

    expect(capture.seen!.repository).toBe(lastLocalResult());
    expect(capture.seen!.isCloud).toBe(false);
    expect(makeCloud).not.toHaveBeenCalled();
  });

  it('cloud mode with NO user yields localStorage and never builds a Firestore repo', () => {
    // A Firestore repository has no meaning without a uid. Deriving one anyway
    // would be constructing a store nobody can read.
    setStorageMode('cloud');
    auth.state.user = null;

    mount();

    expect(capture.seen!.repository).toBe(lastLocalResult());
    expect(capture.seen!.isCloud).toBe(false);
    expect(makeCloud).not.toHaveBeenCalled();
  });

  it('gates rendering while auth is still resolving in cloud mode', () => {
    // Deriving localStorage during the auth-restore window and flipping a tick
    // later would put the boot-state question back in play — every data hook
    // fetches on mount.
    setStorageMode('cloud');
    auth.state.loading = true;
    auth.state.user = null;

    mount();

    expect(screen.queryByTestId('probe')).toBeNull();
    expect(makeCloud).not.toHaveBeenCalled();
  });

  it('does NOT gate local mode — there is no auth to wait for', () => {
    setStorageMode('local');
    auth.state.loading = true;

    mount();

    expect(screen.getByTestId('probe')).toBeTruthy();
  });
});

describe('RepositoryProvider — mode changes are provider actions', () => {
  it('a mode change flips the yielded repository WITHOUT a remount', () => {
    setStorageMode('local');
    auth.state.user = { uid: 'uid-flip' };
    mount();

    expect(capture.seen!.repository).toBe(lastLocalResult());
    const instanceBefore = capture.instance;
    const commitsBefore = capture.commits;

    act(() => capture.switchMode!('cloud'));

    expect(makeCloud).toHaveBeenCalledWith('uid-flip');
    expect(capture.seen!.repository).toBe(lastCloudResult());
    expect(capture.seen!.mode).toBe('cloud');
    // It re-rendered...
    expect(capture.commits).toBeGreaterThan(commitsBefore);
    // ...and it is the SAME component instance, so no remount occurred. The
    // page reload the mode-switch handlers still perform is therefore belt and
    // braces, not the mechanism.
    expect(capture.instance).toBe(instanceBefore);
  });

  it('a mode change persists the mode so the NEXT boot derives the same way', () => {
    // The half the old code got right and the reload then discarded.
    setStorageMode('local');
    auth.state.user = { uid: 'uid-persist' };
    mount();

    act(() => capture.switchMode!('cloud'));

    expect(localStorage.getItem('msb:storageMode')).toBe('cloud');
  });
});

describe('RepositoryProvider — identity stability', () => {
  it('yields the SAME repository across re-renders that change neither input', () => {
    // ⚠️ Load-bearing, not cosmetic. Consumer hooks memoise `reload` on the
    // repository and their mount effect on `reload`, so an unstable identity is
    // an unbounded re-fetch loop rather than a visible failure. Found the hard
    // way while migrating useProjects' tests.
    setStorageMode('cloud');
    auth.state.user = { uid: 'uid-stable' };
    const { rerender } = mount();
    const first = capture.seen!.repository;

    rerender(<RepositoryProvider><Probe /></RepositoryProvider>);
    rerender(<RepositoryProvider><Probe /></RepositoryProvider>);

    expect(capture.seen!.repository).toBe(first);
    expect(makeCloud).toHaveBeenCalledTimes(1);
  });

  it('rebuilds when the user identity changes', () => {
    setStorageMode('cloud');
    auth.state.user = { uid: 'uid-a' };
    const { rerender } = mount();
    const first = capture.seen!.repository;

    auth.state.user = { uid: 'uid-b' };
    rerender(<RepositoryProvider><Probe /></RepositoryProvider>);

    expect(capture.seen!.repository).not.toBe(first);
    expect(makeCloud).toHaveBeenLastCalledWith('uid-b');
  });
});

describe('useRepository outside the provider', () => {
  it('throws rather than silently handing back a default', () => {
    // A default here would be a localStorage repository — i.e. exactly the
    // defect, reintroduced as a convenience.
    expect(() => render(<Probe />)).toThrow(/must be used within RepositoryProvider/);
  });
});
