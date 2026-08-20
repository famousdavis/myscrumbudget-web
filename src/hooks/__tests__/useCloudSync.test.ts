// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * First tests for `useCloudSync` — until now 0/40 statements, 0/19 branches.
 *
 * This is a PERSISTENCE SEAM: the module that turns Firestore listener
 * callbacks into in-app reload events. That class is where this repo's
 * user-visible defects have overwhelmingly lived (v0.33.0's flush-inside-updater,
 * v0.29.2's flush-not-awaited, the whole v0.31.0 cluster), and it is the class
 * neither cognitive complexity nor mutation testing reaches, because neither can
 * score code that no test ever runs.
 *
 * ⚠️⚠️ TWO MOCKS ARE REQUIRED, NOT ONE, AND THE SECOND IS THE NON-OBVIOUS ONE.
 *
 * `firebase/firestore` must be mocked so `onSnapshot` hands us its callbacks.
 * But `@/lib/firebase/config` must ALSO be mocked, because `db` is `null` in the
 * test environment: vitest loads no `.env.local`, so `NEXT_PUBLIC_FIREBASE_API_KEY`
 * is undefined, `isFirebaseConfigured` is false, and `db` never initialises. The
 * hook's guard is `if (!isCloud || !user || !db) return;` — so without the config
 * mock the hook RETURNS BEFORE IT EVER CALLS onSnapshot.
 *
 * That failure is silent and flattering. The module still counts as loaded, the
 * suite goes green, and every line inside both listeners sits at zero. It is the
 * same shape as this suite's `runTransaction`-mocked-as-a-bare-`vi.fn()` scar —
 * a mocked boundary that never invokes what it wraps — reached one step earlier:
 * here the code never arrives at the boundary at all.
 *
 * The first test below is therefore a SELF-CHECK ON THE MOCKS, not a test of the
 * hook. It asserts the handlers were captured and that invoking one produces an
 * observable effect. Nothing else in this file means anything if it fails.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const h = vi.hoisted(() => {
  type SnapHandler = (snap: unknown) => void;
  type ErrHandler = (err: unknown) => void;
  const state = {
    /** One entry per onSnapshot call, in subscription order: projects, settings. */
    subs: [] as { onNext: SnapHandler; onError: ErrHandler }[],
    unsubCalls: 0,
    user: { uid: 'u1' } as { uid: string } | null,
    mode: 'cloud' as 'local' | 'cloud',
  };
  return {
    state,
    onSnapshot: (
      _target: unknown,
      onNext: SnapHandler,
      onError: ErrHandler,
    ) => {
      state.subs.push({ onNext, onError });
      return () => {
        state.unsubCalls += 1;
      };
    },
  };
});

vi.mock('firebase/firestore', async () => {
  const actual =
    await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...actual,
    onSnapshot: h.onSnapshot,
    collection: (_db: unknown, name: string) => ({ __collection: name }),
    doc: (_db: unknown, col: string, id: string) => ({ __doc: `${col}/${id}` }),
    query: (target: unknown) => target,
    where: (field: string, op: string, val: unknown) => ({ field, op, val }),
  };
});

// ⚠️ Without this the hook early-returns and nothing below executes. See header.
vi.mock('@/lib/firebase/config', () => ({ db: {} as unknown }));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: h.state.user }),
}));

// The hook now takes the storage mode from provider STATE rather than reading
// localStorage imperatively, so the mode is driven from here. The returned
// object is rebuilt per call deliberately: this hook memoises nothing on it,
// and the tests need `mode` to change between renders.
vi.mock('@/components/RepositoryProvider', () => ({
  useRepository: () => ({
    repository: {} as unknown,
    mode: h.state.mode,
    isCloud: h.state.mode === 'cloud',
    switchMode: () => {},
  }),
}));

import { useCloudSync } from '../useCloudSync';
import { cloudSyncBus } from '@/lib/firebase/cloudSyncBus';
import * as Toast from '@/components/Toast';

/** Snapshot with no local pending writes — a genuine remote change. */
const remote = { metadata: { hasPendingWrites: false } };
/** Snapshot echoing our own write back from the SDK cache. */
const echo = { metadata: { hasPendingWrites: true } };

const PROJECTS = 0;
const SETTINGS = 1;

let events: string[];
let unsubscribeBus: () => void;

beforeEach(() => {
  h.state.subs = [];
  h.state.unsubCalls = 0;
  h.state.user = { uid: 'u1' };
  localStorage.clear();
  h.state.mode = 'cloud';
  events = [];
  unsubscribeBus = cloudSyncBus.subscribe((e) => events.push(e));
});

afterEach(() => {
  unsubscribeBus();
  vi.restoreAllMocks();
});

describe('mock self-check — nothing below is meaningful without this', () => {
  it('the hook actually reaches onSnapshot and its handlers are live', () => {
    renderHook(() => useCloudSync());

    // Reached the boundary at all — this is what the config mock buys.
    expect(h.state.subs).toHaveLength(2);
    expect(typeof h.state.subs[PROJECTS].onNext).toBe('function');
    expect(typeof h.state.subs[PROJECTS].onError).toBe('function');

    // And invoking a captured handler produces an OBSERVABLE effect, so the
    // handlers are wired to the real implementation rather than being inert.
    act(() => h.state.subs[PROJECTS].onNext(remote));
    expect(events).toEqual(['projects']);
  });
});

describe('useCloudSync — subscription guard', () => {
  it('does not subscribe in local mode', () => {
    h.state.mode = 'local';
    renderHook(() => useCloudSync());
    expect(h.state.subs).toHaveLength(0);
  });

  it('does not subscribe without a signed-in user', () => {
    h.state.user = null;
    renderHook(() => useCloudSync());
    expect(h.state.subs).toHaveLength(0);
  });

  it('subscribes to exactly two listeners in cloud mode with a user', () => {
    renderHook(() => useCloudSync());
    expect(h.state.subs).toHaveLength(2);
  });

  it('unsubscribes both listeners on unmount', () => {
    const { unmount } = renderHook(() => useCloudSync());
    expect(h.state.unsubCalls).toBe(0);
    unmount();
    expect(h.state.unsubCalls).toBe(2);
  });
});

describe('useCloudSync — echo guard (reject-first)', () => {
  // A clean-snapshot-only test cannot tell a working guard from a deleted one:
  // both emit. The REJECT is what proves the guard exists, so it comes first.
  it('ignores a projects snapshot carrying our own pending writes', () => {
    renderHook(() => useCloudSync());
    act(() => h.state.subs[PROJECTS].onNext(echo));
    expect(events).toEqual([]);
  });

  it('ignores a settings snapshot carrying our own pending writes', () => {
    renderHook(() => useCloudSync());
    act(() => h.state.subs[SETTINGS].onNext(echo));
    expect(events).toEqual([]);
  });

  it('emits for a genuine remote projects change', () => {
    renderHook(() => useCloudSync());
    act(() => h.state.subs[PROJECTS].onNext(remote));
    expect(events).toEqual(['projects']);
  });
});

describe('useCloudSync — bus emission contract', () => {
  it('one settings snapshot emits BOTH settings and teamPool', () => {
    // Characterisation of an intended design: the two live in the same
    // Firestore document, so one remote write must reload both hooks.
    renderHook(() => useCloudSync());
    act(() => h.state.subs[SETTINGS].onNext(remote));
    expect(events).toEqual(['settings', 'teamPool']);
  });

  it('a projects snapshot never emits settings or teamPool', () => {
    renderHook(() => useCloudSync());
    act(() => h.state.subs[PROJECTS].onNext(remote));
    expect(events).not.toContain('settings');
    expect(events).not.toContain('teamPool');
  });
});

describe('useCloudSync — permission-denied evicts silently (v0.31.0 I2)', () => {
  it('projects permission-denied emits projects and does NOT toast', () => {
    const toast = vi.spyOn(Toast, 'addToastGlobal').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useCloudSync());

    act(() => h.state.subs[PROJECTS].onError({ code: 'permission-denied' }));

    // The emission is what makes useProjects re-fetch and evict to [].
    expect(events).toEqual(['projects']);
    // Silence is deliberate: the user usually caused this (sign-out, role change).
    expect(toast).not.toHaveBeenCalled();
  });

  it('settings permission-denied emits settings and teamPool and does NOT toast', () => {
    const toast = vi.spyOn(Toast, 'addToastGlobal').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useCloudSync());

    act(() => h.state.subs[SETTINGS].onError({ code: 'permission-denied' }));

    expect(events).toEqual(['settings', 'teamPool']);
    expect(toast).not.toHaveBeenCalled();
  });
});

describe('useCloudSync — non-permission errors toast, once per effect run', () => {
  it('a transport error toasts and emits nothing', () => {
    const toast = vi.spyOn(Toast, 'addToastGlobal').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useCloudSync());

    act(() => h.state.subs[PROJECTS].onError({ code: 'unavailable' }));

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][1]).toBe('error');
    expect(events).toEqual([]);
  });

  it('both listeners failing in one tick produce exactly ONE toast', () => {
    // toastedThisCycle is closure-scoped per effect run — this pins that.
    const toast = vi.spyOn(Toast, 'addToastGlobal').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useCloudSync());

    act(() => {
      h.state.subs[PROJECTS].onError({ code: 'unavailable' });
      h.state.subs[SETTINGS].onError({ code: 'unavailable' });
    });

    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('a re-mount can toast again — the suppression does not outlive the effect', () => {
    const toast = vi.spyOn(Toast, 'addToastGlobal').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const first = renderHook(() => useCloudSync());
    act(() => h.state.subs[PROJECTS].onError({ code: 'unavailable' }));
    first.unmount();

    h.state.subs = [];
    renderHook(() => useCloudSync());
    act(() => h.state.subs[PROJECTS].onError({ code: 'unavailable' }));

    expect(toast).toHaveBeenCalledTimes(2);
  });

  it('a projects error with no code falls back to "unknown" and takes the toast path', () => {
    const toast = vi.spyOn(Toast, 'addToastGlobal').mockImplementation(() => {});
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useCloudSync());

    act(() => h.state.subs[PROJECTS].onError('a string, not an error object'));

    expect(toast).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][1]).toBe('unknown');
  });

  it('a settings error with no code falls back to "unknown" too', () => {
    // The two listeners carry independent copies of the `?? 'unknown'` fallback.
    // Covering only the projects one leaves this arm dead — it was the single
    // uncovered branch in the file on first measurement.
    const toast = vi.spyOn(Toast, 'addToastGlobal').mockImplementation(() => {});
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useCloudSync());

    act(() => h.state.subs[SETTINGS].onError(undefined));

    expect(toast).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][1]).toBe('unknown');
  });
});

describe('useCloudSync — listener errors log the code ONLY (v0.28.2 M6a/M6b)', () => {
  // Asserted as a PROPERTY — the sensitive values appear nowhere in the logged
  // arguments at any depth — rather than as a call shape. An argument-count
  // assertion would be a change-detector and would not notice a nested leak.
  const SENSITIVE = {
    code: 'permission-denied',
    message: 'Missing or insufficient permissions',
    uid: 'u1',
    path: 'myscrumbudget_projects/proj-secret-42',
    customData: { serverResponse: 'members.u1 denied on proj-secret-42' },
  };

  function loggedText(spy: { mock: { calls: unknown[][] } }): string {
    return spy.mock.calls
      .flat()
      .map((a: unknown) => {
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ');
  }

  it('the projects listener log contains the code and nothing sensitive', () => {
    vi.spyOn(Toast, 'addToastGlobal').mockImplementation(() => {});
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useCloudSync());

    act(() => h.state.subs[PROJECTS].onError(SENSITIVE));

    const text = loggedText(log);
    expect(text).toContain('permission-denied');
    expect(text).not.toContain('proj-secret-42');
    expect(text).not.toContain('u1');
    expect(text).not.toContain('Missing or insufficient permissions');
  });

  it('the settings listener log contains the code and nothing sensitive', () => {
    vi.spyOn(Toast, 'addToastGlobal').mockImplementation(() => {});
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useCloudSync());

    act(() => h.state.subs[SETTINGS].onError(SENSITIVE));

    const text = loggedText(log);
    expect(text).toContain('permission-denied');
    expect(text).not.toContain('proj-secret-42');
    expect(text).not.toContain('Missing or insufficient permissions');
  });
});
