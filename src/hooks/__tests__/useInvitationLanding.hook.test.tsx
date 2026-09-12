// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * State-machine characterisation of `useInvitationLanding` (v0.38.1, WI-2).
 *
 * Re-opens the owner-signed coverage decline of 2026-08-16 on the ground that
 * decline itself named: a shipped defect. Every Microsoft sign-in is
 * `emailVerified: false` in Firebase, the client guard short-circuited the
 * claim for all of them, and the banner's only failure copy was a 30-second
 * timeout that blamed the student's email.
 *
 * WHAT THIS FILE CAN AND CANNOT PROVE. The hook never calls the Cloud
 * Function — it consumes window events — so the state-machine tests below
 * drive it with `window.dispatchEvent` and prove what the banner does with an
 * event. They cannot prove that the event `claimPendingInvitationsAndNotify`
 * DISPATCHES is the one the hook CONSUMES. The `integration` block at the
 * bottom is what closes that gap: it renders the hook and calls the REAL
 * module against a mocked callable, so the event crosses the same seam it
 * crosses in production.
 *
 * Labels: [FAILS-TODAY] fails at v0.38.0 on a real assertion (the state the
 * hook is stuck in); [REGRESSION] passes today and pins behaviour the change
 * must not move.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { INVITE_CLAIM_SETTLED_EVENT } from '@/lib/firebase/invitation-types';
import type { InviteClaimSettledDetail } from '@/lib/firebase/invitation-types';

type FakeUser = { uid: string; email: string | null; emailVerified: boolean };

const auth = vi.hoisted(() => ({ user: null as FakeUser | null }));
const repo = vi.hoisted(() => ({
  mode: 'local' as 'local' | 'cloud',
  switchMode: vi.fn(),
}));
const callableImpl = vi.hoisted(() => vi.fn());

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: auth.user, loading: false }),
}));
vi.mock('@/components/RepositoryProvider', () => ({
  useRepository: () => ({
    mode: repo.mode,
    switchMode: repo.switchMode,
    isCloud: repo.mode === 'cloud',
    repository: null,
  }),
}));
vi.mock('firebase/functions', async () => {
  const actual = await vi.importActual<typeof import('firebase/functions')>('firebase/functions');
  return { ...actual, httpsCallable: vi.fn(() => callableImpl) };
});
vi.mock('@/lib/firebase/config', () => ({
  db: {} as unknown,
  functions: {} as unknown,
  auth: null,
  app: null,
  isFirebaseAvailable: false,
}));

import {
  useInvitationLanding,
  INVITE_SESSION_KEY,
  CLAIM_TIMEOUT_MESSAGE,
  claimNoneMessage,
} from '../useInvitationLanding';
import { mapInvitationError } from '@/lib/firebase/invitations';
import { claimPendingInvitationsAndNotify } from '@/lib/firebase/claimPendingInvitations';

const MSB_ROW = { appId: 'myscrumbudget', modelId: 'm1', modelName: 'Apollo Budget' };
const STORYMAP_ROW = { appId: 'spertstorymap', modelId: 's1', modelName: 'Roadmap' };
const SCHEDULER_ROW = { appId: 'spertscheduler', modelId: 'sc1', modelName: 'Plan' };
const STUDENT: FakeUser = { uid: 'uid-ms', email: 'student@ufl.edu', emailVerified: false };

function modelsChanged(claimed: { appId: string; modelId: string; modelName: string }[]): void {
  window.dispatchEvent(new CustomEvent('spert:models-changed', { detail: { claimed } }));
}
function settled(detail: InviteClaimSettledDetail): void {
  window.dispatchEvent(new CustomEvent(INVITE_CLAIM_SETTLED_EVENT, { detail }));
}
/** Mount with a token in session and a signed-in user — the 'claiming' precondition. */
function mountClaiming() {
  sessionStorage.setItem(INVITE_SESSION_KEY, 'tok');
  auth.user = STUDENT;
  const h = renderHook(() => useInvitationLanding());
  expect(h.result.current.state, 'precondition: claiming').toBe('claiming');
  return h;
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  auth.user = null;
  repo.mode = 'local';
  repo.switchMode.mockReset();
  callableImpl.mockReset();
  callableImpl.mockResolvedValue({ data: { claimed: [] } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useInvitationLanding — state machine', () => {
  it('[REGRESSION] starts idle with no session token, pre_auth with one', () => {
    const a = renderHook(() => useInvitationLanding());
    expect(a.result.current.state).toBe('idle');
    a.unmount();

    sessionStorage.setItem(INVITE_SESSION_KEY, 'tok');
    const b = renderHook(() => useInvitationLanding());
    expect(b.result.current.state).toBe('pre_auth');
  });

  it('[REGRESSION] pre_auth → claiming when the user resolves, and the zero-local-projects cloud flip fires once', async () => {
    sessionStorage.setItem(INVITE_SESSION_KEY, 'tok');
    const h = renderHook(() => useInvitationLanding());
    expect(h.result.current.state).toBe('pre_auth');
    auth.user = STUDENT;
    h.rerender();
    expect(h.result.current.state).toBe('claiming');
    await waitFor(() => expect(repo.switchMode).toHaveBeenCalledWith('cloud'));
    h.rerender();
    expect(repo.switchMode, 'one flip attempt per mount').toHaveBeenCalledTimes(1);
  });

  it('[REGRESSION] claiming → claimed on spert:models-changed with an MSB row; token consumed', () => {
    const h = mountClaiming();
    act(() => modelsChanged([MSB_ROW]));
    expect(h.result.current.state).toBe('claimed');
    expect(h.result.current.claimedNames).toEqual(['Apollo Budget']);
    expect(sessionStorage.getItem(INVITE_SESSION_KEY)).toBeNull();
  });

  it('[FAILS-TODAY] PC3: a SUCCESSFUL cross-app claim reaches claimed_elsewhere, names the app, consumes the token, and disarms the timer', () => {
    vi.useFakeTimers();
    const h = mountClaiming();
    act(() => modelsChanged([STORYMAP_ROW]));
    expect(h.result.current.state, 'the claim WORKED — it must not sit in claiming until the timer blames the email')
      .toBe('claimed_elsewhere');
    expect(h.result.current.claimedElsewhereApps).toEqual(['SPERT Story Map']);
    expect(h.result.current.failureMessage).toBeNull();
    expect(sessionStorage.getItem(INVITE_SESSION_KEY)).toBeNull();
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(h.result.current.state, 'the 30 s timer must not overwrite a successful outcome').toBe('claimed_elsewhere');
  });

  it('[FAILS-TODAY] PC3: two other apps are both named, de-duplicated, in claim order', () => {
    const h = mountClaiming();
    act(() => modelsChanged([STORYMAP_ROW, SCHEDULER_ROW, { ...STORYMAP_ROW, modelId: 's2' }]));
    expect(h.result.current.state).toBe('claimed_elsewhere');
    expect(h.result.current.claimedElsewhereApps).toEqual(['SPERT Story Map', 'SPERT Scheduler']);
  });

  it('[REGRESSION] a mixed claim with an MSB row is "claimed" with the MSB names only', () => {
    const h = mountClaiming();
    act(() => modelsChanged([STORYMAP_ROW, MSB_ROW]));
    expect(h.result.current.state).toBe('claimed');
    expect(h.result.current.claimedNames).toEqual(['Apollo Budget']);
  });

  // [FALSIFY-AFTER]: the field does not exist at v0.38.0, so this cannot fail
  // there on a real assertion. Verified by mutation (hoist the elsewhere-apps
  // write above the MSB check) on the finished artifact.
  it('[FALSIFY-AFTER] a mixed claim does NOT also populate claimedElsewhereApps', () => {
    const h = mountClaiming();
    act(() => modelsChanged([STORYMAP_ROW, MSB_ROW]));
    expect(h.result.current.state).toBe('claimed');
    expect(h.result.current.claimedElsewhereApps).toEqual([]);
  });

  it('[FAILS-TODAY] PC2: a REJECTED claim fails at once with the code-mapped copy, not the timeout copy', () => {
    vi.useFakeTimers();
    const h = mountClaiming();
    act(() => settled({ outcome: 'error', code: 'functions/unavailable' }));
    expect(h.result.current.state, 'must not wait for the 30 s timer').toBe('failed');
    expect(h.result.current.failureMessage).toBe(mapInvitationError({ code: 'functions/unavailable' }, 'claim'));
    expect(h.result.current.failureMessage).not.toBe(CLAIM_TIMEOUT_MESSAGE);
    expect(sessionStorage.getItem(INVITE_SESSION_KEY), 'consumed — retry is re-clicking the link').toBeNull();
  });

  it('[FAILS-TODAY] PC2: a claim that found NOTHING fails at once, naming the signed-in address', () => {
    const h = mountClaiming();
    act(() => settled({ outcome: 'none', email: 'student@ufl.edu' }));
    expect(h.result.current.state).toBe('failed');
    expect(h.result.current.failureMessage).toBe(claimNoneMessage('student@ufl.edu'));
    expect(h.result.current.failureMessage).toContain('student@ufl.edu');
    expect(sessionStorage.getItem(INVITE_SESSION_KEY)).toBeNull();
  });

  it('[REGRESSION] the 30 s timer still fails the banner when nothing settles, and consumes the token', () => {
    vi.useFakeTimers();
    const h = mountClaiming();
    act(() => { vi.advanceTimersByTime(29_999); });
    expect(h.result.current.state).toBe('claiming');
    act(() => { vi.advanceTimersByTime(1); });
    expect(h.result.current.state).toBe('failed');
    expect(sessionStorage.getItem(INVITE_SESSION_KEY)).toBeNull();
  });

  // [FALSIFY-AFTER]: cannot run at v0.38.0 — none of the three copies exists
  // there — so it is verified by mutation on the finished artifact, not by a
  // red at HEAD. Three DISTINCT strings is the whole of PC2/PC3: a timer
  // fire, an empty answer and a rejection must not read alike.
  it('[FALSIFY-AFTER] the timeout copy is the one the timer produces, and is distinct from the empty-answer and rejection copies', () => {
    vi.useFakeTimers();
    const h = mountClaiming();
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(h.result.current.failureMessage).toBe(CLAIM_TIMEOUT_MESSAGE);
    expect(CLAIM_TIMEOUT_MESSAGE).not.toBe(claimNoneMessage('student@ufl.edu'));
    expect(CLAIM_TIMEOUT_MESSAGE).not.toBe(mapInvitationError({ code: 'functions/unavailable' }, 'claim'));
    expect(claimNoneMessage('student@ufl.edu')).not.toBe(mapInvitationError({ code: 'functions/unavailable' }, 'claim'));
  });

  it('[REGRESSION] Lesson 27 gate: a settled event with NO session token is ignored, so a normal sign-in never sees a failure banner', () => {
    auth.user = STUDENT;
    const h = renderHook(() => useInvitationLanding());
    expect(h.result.current.state).toBe('idle');
    act(() => settled({ outcome: 'error', code: 'functions/unavailable' }));
    act(() => settled({ outcome: 'none', email: 'student@ufl.edu' }));
    expect(h.result.current.state, 'idle renders nothing, so no copy can reach the DOM').toBe('idle');
  });

  it('[FAILS-TODAY] dismiss after a SETTLED failure returns to idle, consumes the token, and clears the failure copy', () => {
    const h = mountClaiming();
    act(() => settled({ outcome: 'error', code: 'functions/internal' }));
    expect(h.result.current.state, 'the settled channel does not exist at v0.38.0').toBe('failed');
    act(() => h.result.current.dismiss());
    expect(h.result.current.state).toBe('idle');
    expect(h.result.current.failureMessage).toBeNull();
    expect(sessionStorage.getItem(INVITE_SESSION_KEY)).toBeNull();
  });

  it('[REGRESSION] Effect 2b: sign-out mid-claim resets to idle and drops the token', () => {
    const h = mountClaiming();
    auth.user = null;
    h.rerender();
    expect(h.result.current.state).toBe('idle');
    expect(sessionStorage.getItem(INVITE_SESSION_KEY)).toBeNull();
  });
});

describe('integration — the event the module dispatches is the event the hook consumes', () => {
  it('[FAILS-TODAY] an unverified (Microsoft-shaped) user reaches the CF and CLAIMS — the client no longer decides', async () => {
    callableImpl.mockResolvedValue({ data: { claimed: [MSB_ROW] } });
    const h = mountClaiming();
    expect(STUDENT.emailVerified, 'fixture: Microsoft shape').toBe(false);
    claimPendingInvitationsAndNotify(STUDENT as unknown as User);
    await waitFor(() => expect(h.result.current.state).toBe('claimed'));
    expect(callableImpl).toHaveBeenCalledTimes(1);
    expect(h.result.current.claimedNames).toEqual(['Apollo Budget']);
  });

  it('[FAILS-TODAY] a cross-app resolve from the real module reaches claimed_elsewhere', async () => {
    callableImpl.mockResolvedValue({ data: { claimed: [STORYMAP_ROW] } });
    const h = mountClaiming();
    claimPendingInvitationsAndNotify(STUDENT as unknown as User);
    await waitFor(() => expect(h.result.current.state).toBe('claimed_elsewhere'));
    expect(h.result.current.claimedElsewhereApps).toEqual(['SPERT Story Map']);
  });

  it('[FAILS-TODAY] a rejection from the real module reaches failed with the code-mapped copy', async () => {
    callableImpl.mockRejectedValue(Object.assign(new Error('refused'), { code: 'functions/failed-precondition' }));
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    const h = mountClaiming();
    claimPendingInvitationsAndNotify(STUDENT as unknown as User);
    await waitFor(() => expect(h.result.current.state).toBe('failed'));
    expect(h.result.current.failureMessage)
      .toBe(mapInvitationError({ code: 'functions/failed-precondition' }, 'claim'));
  });

  it('[FAILS-TODAY] an empty resolve from the real module reaches failed naming the caller email', async () => {
    callableImpl.mockResolvedValue({ data: { claimed: [] } });
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    const h = mountClaiming();
    claimPendingInvitationsAndNotify(STUDENT as unknown as User);
    await waitFor(() => expect(h.result.current.state).toBe('failed'));
    expect(h.result.current.failureMessage).toBe(claimNoneMessage('student@ufl.edu'));
  });
});
