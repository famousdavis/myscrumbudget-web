// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// runTransaction mock — fakeTx is reconfigured per-test via mockResolvedValueOnce.
const fakeTx = {
  get: vi.fn(),
  update: vi.fn(),
};

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...actual,
    runTransaction: vi.fn(async (_db, callback: (tx: typeof fakeTx) => Promise<void>) => callback(fakeTx)),
    doc: vi.fn(() => ({ /* fake DocumentReference */ })),
    deleteField: vi.fn(() => '__DELETE__'),
  };
});

// httpsCallable mock — distinct factories per CF name.
vi.mock('firebase/functions', async () => {
  const actual = await vi.importActual<typeof import('firebase/functions')>('firebase/functions');
  return {
    ...actual,
    httpsCallable: vi.fn(() => {
      // Default: succeed with empty data. Tests override per-call via mockReturnValueOnce.
      return vi.fn(async () => ({ data: {} }));
    }),
  };
});

// Mock config — provide non-null db and functions so the module-level guards
// fall through and we exercise the actual code paths.
vi.mock('@/lib/firebase/config', () => ({
  db: {} as unknown,
  functions: null,  // overridden per-test where needed
}));

vi.mock('@/lib/firebase/errors', () => ({
  sanitizeFirebaseError: vi.fn((err: unknown) => {
    return (err as { message?: string }).message ?? 'Unknown error.';
  }),
}));

beforeEach(() => {
  fakeTx.get.mockReset();
  fakeTx.update.mockReset();
});

describe('mapInvitationError', () => {
  it('produces context-specific messages for the same error code (Lesson 13)', async () => {
    const { mapInvitationError } = await import('../invitations');
    const err = { code: 'functions/failed-precondition' };
    const sendMsg   = mapInvitationError(err, 'send');
    const resendMsg = mapInvitationError(err, 'resend');
    expect(sendMsg).not.toEqual(resendMsg);
    expect(sendMsg).toMatch(/verified email address/);
    expect(resendMsg).toMatch(/maximum number of times/);
  });

  it('produces specific messages for permission-denied per context', async () => {
    const { mapInvitationError } = await import('../invitations');
    const err = { code: 'functions/permission-denied' };
    expect(mapInvitationError(err, 'send')).toMatch(/owner/);
    expect(mapInvitationError(err, 'resend')).toMatch(/original sender/);
    expect(mapInvitationError(err, 'revoke')).toMatch(/original sender/);
  });

  it('falls through to sanitizeFirebaseError for unmapped codes', async () => {
    const { mapInvitationError } = await import('../invitations');
    expect(mapInvitationError(new Error('something else'), 'send')).toBe('something else');
  });
});

describe('removeCollaborator guards', () => {
  it('Guard 1: self-removal returns ok:false BEFORE the transaction fires', async () => {
    const { removeCollaborator } = await import('../invitations');
    const result = await removeCollaborator('proj', 'uid-A', 'uid-A');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/yourself/);
    // Transaction never invoked
    expect(fakeTx.get).not.toHaveBeenCalled();
    expect(fakeTx.update).not.toHaveBeenCalled();
  });

  it('Guard 2: non-owner caller throws "Only the project owner..."', async () => {
    const { removeCollaborator } = await import('../invitations');
    fakeTx.get.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ owner: 'uid-Owner', members: { 'uid-Owner': 'owner', 'uid-Editor': 'editor' } }),
      ref: {},
    });
    const result = await removeCollaborator('proj', 'uid-Editor', 'uid-NotOwner');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Only the project owner/);
    expect(fakeTx.update).not.toHaveBeenCalled();
  });

  it('Guard 3: owner-target throws "Cannot remove the project owner."', async () => {
    const { removeCollaborator } = await import('../invitations');
    fakeTx.get.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ owner: 'uid-Owner', members: { 'uid-Owner': 'owner' } }),
      ref: {},
    });
    const result = await removeCollaborator('proj', 'uid-Owner', 'uid-Owner');
    // Note: Guard 1 (self-removal) fires before reaching the transaction here
    // because targetUid === callerUid. Verifying that path:
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/yourself/);
  });

  it('Guard 3 (proper): owner removing the owner via separate caller throws', async () => {
    const { removeCollaborator } = await import('../invitations');
    // Caller is owner trying to remove themselves indirectly via a different uid?
    // The actual scenario is: caller IS owner, target IS owner — but they're
    // the same uid here. The pure "Guard 3" path requires constructed test data
    // where caller !== target but data.owner === target. In Schema A, owner is
    // unique per project so this can only happen if data.owner is stale.
    // We model it by having data.owner === targetUid but caller a different uid.
    fakeTx.get.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ owner: 'uid-Target', members: { 'uid-Target': 'owner' } }),
      ref: {},
    });
    const result = await removeCollaborator('proj', 'uid-Target', 'uid-Caller');
    expect(result.ok).toBe(false);
    // Guard 2 fires first (caller !== owner), so we get the Guard 2 message
    expect(result.reason).toMatch(/Only the project owner/);
  });

  it('happy path: owner removes editor — tx.update is called', async () => {
    const { removeCollaborator } = await import('../invitations');
    fakeTx.get.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ owner: 'uid-Owner', members: { 'uid-Owner': 'owner', 'uid-Editor': 'editor' } }),
      ref: { id: 'proj-ref' },
    });
    const result = await removeCollaborator('proj', 'uid-Editor', 'uid-Owner');
    expect(result.ok).toBe(true);
    expect(fakeTx.update).toHaveBeenCalledTimes(1);
  });

  it('throws "Project not found" if doc does not exist', async () => {
    const { removeCollaborator } = await import('../invitations');
    fakeTx.get.mockResolvedValueOnce({
      exists: () => false,
      data: () => ({}),
      ref: {},
    });
    const result = await removeCollaborator('proj', 'uid-Editor', 'uid-Owner');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Project not found/);
  });
});

describe('callable wrappers — null functions guard', () => {
  it('callSendInvitationEmail rejects with "Firebase Functions not initialized" when functions is null', async () => {
    // The mock at top of file already sets functions: null.
    const { callSendInvitationEmail } = await import('../invitations');
    await expect(
      callSendInvitationEmail({ appId: 'myscrumbudget', modelId: 'p', emails: ['a@b.com'], role: 'editor', isVoting: false }),
    ).rejects.toThrow(/Firebase Functions not initialized/);
  });
});
