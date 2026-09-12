// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { User } from 'firebase/auth';
import { INVITE_CLAIM_SETTLED_EVENT } from '@/lib/firebase/invitation-types';

// httpsCallable factory returns a single shared mock fn; tests configure its
// return value via mockResolvedValue / mockRejectedValue per case.
const callableImpl = vi.fn();

vi.mock('firebase/functions', async () => {
  const actual = await vi.importActual<typeof import('firebase/functions')>('firebase/functions');
  return {
    ...actual,
    httpsCallable: vi.fn(() => callableImpl),
  };
});

// v0.38.1: the flag is a live getter so ONE test can turn the suite-wide kill
// switch off. The module reads the binding at call time, so flipping the
// backing field between calls is observable without re-importing.
const flags = vi.hoisted(() => ({ enabled: true }));
vi.mock('@/lib/featureFlags', () => ({
  get INVITATIONS_ENABLED() { return flags.enabled; },
}));

vi.mock('@/lib/firebase/config', () => ({
  db: {} as unknown,
  functions: {} as unknown,
}));

const verifiedUser = { uid: 'uid-A', email: 'a@b.com', emailVerified: true } as User;
const unverifiedUser = { uid: 'uid-B', email: 'b@example.com', emailVerified: false } as User;

/** Every event dispatched on window during one call, by type, in order. */
function captureDispatches(): { spy: ReturnType<typeof vi.spyOn>; types: () => string[]; details: () => unknown[] } {
  const spy = vi.spyOn(window, 'dispatchEvent');
  spy.mockClear();
  return {
    spy,
    types: () => spy.mock.calls.map(c => (c[0] as Event).type),
    details: () => spy.mock.calls.map(c => (c[0] as CustomEvent).detail),
  };
}

beforeEach(() => {
  flags.enabled = true;
  callableImpl.mockReset();
  callableImpl.mockResolvedValue({ data: { claimed: [] } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('claimPendingInvitationsAndNotify — guards', () => {
  // v0.38.1 (WI-2): INVERTED. Until v0.38.0 this test was "returns immediately
  // when emailVerified is false; CF NOT called", and it pinned the defect:
  // Firebase records EVERY microsoft.com sign-in as emailVerified: false, so
  // the guard short-circuited every Microsoft student before the CF ever
  // compared an email. The client no longer decides; the CF does.
  it('calls the CF even when emailVerified is false — the client no longer decides (v0.38.1)', async () => {
    const { claimPendingInvitationsAndNotify } = await import('../claimPendingInvitations');
    claimPendingInvitationsAndNotify(unverifiedUser);
    expect(callableImpl).toHaveBeenCalledTimes(1);
  });

  it('still returns immediately when INVITATIONS_ENABLED is false — the kill switch survived the guard deletion', async () => {
    const { claimPendingInvitationsAndNotify } = await import('../claimPendingInvitations');
    flags.enabled = false;
    claimPendingInvitationsAndNotify(verifiedUser);
    expect(callableImpl, 'kill switch off must mean NO callable').not.toHaveBeenCalled();
    // Positive control in the same test: the getter is live, so flipping it
    // back makes the very next call reach the CF. Without this, a getter that
    // silently read a stale `true` would make the assertion above vacuous.
    flags.enabled = true;
    claimPendingInvitationsAndNotify(verifiedUser);
    expect(callableImpl, 'kill switch on must mean the callable fires').toHaveBeenCalledTimes(1);
  });

  // v0.38.1 (WI-2, Q1 ruling): MODIFIED. Was "does NOT dispatch event when
  // claimed[] is empty (payload gate, Lesson 27)". The Lesson 27 gate is
  // preserved — spert:models-changed is never dispatched empty — but an
  // empty resolve is now a SETTLED negative and the banner must hear it
  // instead of waiting 30 s for a timer that carries no information.
  it('an empty claimed[] dispatches the SETTLED event ({outcome: none, email}) and never spert:models-changed', async () => {
    const { claimPendingInvitationsAndNotify } = await import('../claimPendingInvitations');
    callableImpl.mockResolvedValue({ data: { claimed: [] } });
    const d = captureDispatches();
    claimPendingInvitationsAndNotify(verifiedUser);
    await new Promise(r => setTimeout(r, 0));
    expect(d.types(), 'exactly one event, and it is the settled one').toEqual([INVITE_CLAIM_SETTLED_EVENT]);
    expect(d.details()[0]).toEqual({ outcome: 'none', email: 'a@b.com' });
    d.spy.mockRestore();
  });

  it('dispatches spert:models-changed event with correct detail on success', async () => {
    const { claimPendingInvitationsAndNotify } = await import('../claimPendingInvitations');
    callableImpl.mockResolvedValue({
      data: {
        claimed: [{ appId: 'myscrumbudget', modelId: 'm1', modelName: 'Project A' }],
      },
    });
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    dispatchSpy.mockClear();
    claimPendingInvitationsAndNotify(verifiedUser);
    await new Promise(r => setTimeout(r, 0));
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('spert:models-changed');
    expect(event.detail.claimed).toEqual([
      { appId: 'myscrumbudget', modelId: 'm1', modelName: 'Project A' },
    ]);
    dispatchSpy.mockRestore();
  });

  // v0.38.1 (WI-2): MODIFIED. Was "logs CF failure to console without
  // rethrowing" and asserted NO dispatch. A rejection now settles the banner
  // through the settled event, keyed on the code, so the student who arrived
  // by invite link reads why instead of a 30-second timeout.
  it('a rejection logs at console.error and dispatches the SETTLED event ({outcome: error, code}) exactly once', async () => {
    const { claimPendingInvitationsAndNotify } = await import('../claimPendingInvitations');
    callableImpl.mockRejectedValue(Object.assign(new Error('CF down'), { code: 'functions/unavailable' }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = captureDispatches();
    claimPendingInvitationsAndNotify(verifiedUser);
    await new Promise(r => setTimeout(r, 0));
    expect(errorSpy).toHaveBeenCalledWith('[claim] failed:', 'functions/unavailable');
    expect(d.types(), 'one settled event, no models-changed').toEqual([INVITE_CLAIM_SETTLED_EVENT]);
    expect(d.details()[0]).toEqual({ outcome: 'error', code: 'functions/unavailable' });
    d.spy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('claimPendingInvitationsAndNotify — the downgrade is exactly one code wide (v0.38.1, Q2 ruling)', () => {
  it('functions/failed-precondition is logged at console.debug, NOT console.error, and still settles the banner', async () => {
    const { claimPendingInvitationsAndNotify } = await import('../claimPendingInvitations');
    callableImpl.mockRejectedValue(Object.assign(new Error('refused'), { code: 'functions/failed-precondition' }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const d = captureDispatches();
    claimPendingInvitationsAndNotify(verifiedUser);
    await new Promise(r => setTimeout(r, 0));
    expect(errorSpy, 'the downgraded code must NOT reach console.error').not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith('[claim] refused:', 'functions/failed-precondition');
    expect(d.details(), 'downgraded in the console, NOT silenced for the banner')
      .toEqual([{ outcome: 'error', code: 'functions/failed-precondition' }]);
    d.spy.mockRestore();
  });

  // POSITIVE CONTROL. Without this the downgrade is indistinguishable from
  // silencing the channel — which is the defect this release exists to fix,
  // one level down. `unauthenticated` is the code the brief names as the one
  // a too-wide key would swallow.
  it('functions/unauthenticated is still logged at console.error (positive control)', async () => {
    const { claimPendingInvitationsAndNotify } = await import('../claimPendingInvitations');
    callableImpl.mockRejectedValue(Object.assign(new Error('no auth'), { code: 'functions/unauthenticated' }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    claimPendingInvitationsAndNotify(verifiedUser);
    await new Promise(r => setTimeout(r, 0));
    expect(errorSpy).toHaveBeenCalledWith('[claim] failed:', 'functions/unauthenticated');
    expect(debugSpy, 'only failed-precondition is downgraded').not.toHaveBeenCalledWith('[claim] refused:', expect.anything());
  });
});
