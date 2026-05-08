// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from 'firebase/auth';

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

vi.mock('@/lib/featureFlags', () => ({
  INVITATIONS_ENABLED: true,
}));

vi.mock('@/lib/firebase/config', () => ({
  db: {} as unknown,
  functions: {} as unknown,
}));

const verifiedUser = { uid: 'uid-A', email: 'a@b.com', emailVerified: true } as User;
const unverifiedUser = { uid: 'uid-B', email: 'b@example.com', emailVerified: false } as User;

beforeEach(() => {
  callableImpl.mockReset();
  callableImpl.mockResolvedValue({ data: { claimed: [] } });
});

describe('claimPendingInvitationsAndNotify — guards', () => {
  it('returns immediately when emailVerified is false; CF NOT called', async () => {
    const { claimPendingInvitationsAndNotify } = await import('../claimPendingInvitations');
    claimPendingInvitationsAndNotify(unverifiedUser);
    expect(callableImpl).not.toHaveBeenCalled();
  });

  it('does NOT dispatch event when claimed[] is empty (payload gate, Lesson 27)', async () => {
    const { claimPendingInvitationsAndNotify } = await import('../claimPendingInvitations');
    callableImpl.mockResolvedValue({ data: { claimed: [] } });
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    dispatchSpy.mockClear();
    claimPendingInvitationsAndNotify(verifiedUser);
    await new Promise(r => setTimeout(r, 0));
    expect(dispatchSpy).not.toHaveBeenCalled();
    dispatchSpy.mockRestore();
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

  it('logs CF failure to console without rethrowing', async () => {
    const { claimPendingInvitationsAndNotify } = await import('../claimPendingInvitations');
    callableImpl.mockRejectedValue(Object.assign(new Error('CF down'), { code: 'functions/unavailable' }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    dispatchSpy.mockClear();
    claimPendingInvitationsAndNotify(verifiedUser);
    await new Promise(r => setTimeout(r, 0));
    expect(errorSpy).toHaveBeenCalledWith('[claim] failed:', 'functions/unavailable');
    expect(dispatchSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    dispatchSpy.mockRestore();
  });
});
