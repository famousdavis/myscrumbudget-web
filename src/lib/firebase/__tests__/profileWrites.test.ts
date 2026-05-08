// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from 'firebase/auth';

const setDocSpy = vi.fn();
const getDocSpy = vi.fn();
const docSpy = vi.fn(() => ({ /* fake DocumentReference */ }));
const serverTimestampSpy = vi.fn(() => '__SERVER_TIMESTAMP__');

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  // Wrappers around the spies were previously of the form
  //   setDoc: (...args: unknown[]) => setDocSpy(...args)
  // which trips the new TS2556 check ("spread argument must have a tuple
  // type or be passed to a rest parameter") under bare `tsc --noEmit`.
  // The wrappers were unnecessary indirection — vi.mock factories accept
  // the spies directly, the call sites still invoke the spies with the
  // original arg lists, and assertions like
  //   expect(setDocSpy).toHaveBeenCalledWith(...)
  // continue to work unchanged.
  return {
    ...actual,
    setDoc: setDocSpy,
    getDoc: getDocSpy,
    doc: docSpy,
    serverTimestamp: serverTimestampSpy,
  };
});

vi.mock('@/lib/firebase/config', () => ({
  db: {} as unknown,
}));

vi.mock('@/lib/utils/getFirstName', () => ({
  // Return input verbatim for predictable assertions; we're not testing
  // normalizeDisplayName itself here.
  normalizeDisplayName: (s: string) => `NORMALIZED:${s}`,
}));

beforeEach(() => {
  setDocSpy.mockReset();
  getDocSpy.mockReset();
  docSpy.mockClear();
});

describe('writeSpertsuiteProfile', () => {
  it('returns early without writing when user.email is null', async () => {
    const { writeSpertsuiteProfile } = await import('../profileWrites');
    const user = { uid: 'uid-A', email: null, displayName: 'A', photoURL: null } as unknown as User;
    await writeSpertsuiteProfile(user);
    expect(setDocSpy).not.toHaveBeenCalled();
  });

  it('writes spertsuite_profiles with normalized displayName, lowercased email, no uid field', async () => {
    const { writeSpertsuiteProfile } = await import('../profileWrites');
    setDocSpy.mockResolvedValueOnce(undefined);
    const user = {
      uid: 'uid-A',
      email: 'A@B.COM',
      displayName: 'Ada Lovelace',
      photoURL: 'https://example.com/a.jpg',
    } as User;
    await writeSpertsuiteProfile(user);
    expect(setDocSpy).toHaveBeenCalledTimes(1);
    const [, payload, opts] = setDocSpy.mock.calls[0];
    expect(payload.displayName).toBe('NORMALIZED:Ada Lovelace');
    expect(payload.email).toBe('a@b.com'); // lowercased
    expect(payload.photoURL).toBe('https://example.com/a.jpg');
    expect(payload.updatedAt).toBe('__SERVER_TIMESTAMP__');
    expect('uid' in payload).toBe(false); // No uid field — doc ID IS the uid
    expect(opts).toEqual({ merge: true });
  });

  it('photoURL falls back to null when absent', async () => {
    const { writeSpertsuiteProfile } = await import('../profileWrites');
    setDocSpy.mockResolvedValueOnce(undefined);
    const user = {
      uid: 'uid-A',
      email: 'a@b.com',
      displayName: '',
      photoURL: undefined,
    } as unknown as User;
    await writeSpertsuiteProfile(user);
    const [, payload] = setDocSpy.mock.calls[0];
    expect(payload.photoURL).toBeNull();
  });

  it('swallows errors with console.warn, does not throw', async () => {
    const { writeSpertsuiteProfile } = await import('../profileWrites');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setDocSpy.mockRejectedValueOnce(new Error('quota exceeded'));
    const user = { uid: 'uid-A', email: 'a@b.com', displayName: 'X', photoURL: null } as User;
    await expect(writeSpertsuiteProfile(user)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('writeMyscrumbudgetProfile', () => {
  it('writes createdAt on first write (existing doc does not exist)', async () => {
    const { writeMyscrumbudgetProfile } = await import('../profileWrites');
    getDocSpy.mockResolvedValueOnce({ exists: () => false });
    setDocSpy.mockResolvedValueOnce(undefined);
    const user = {
      uid: 'uid-A',
      email: 'a@b.com',
      displayName: 'Ada',
      photoURL: null,
    } as User;
    await writeMyscrumbudgetProfile(user);
    const [, payload] = setDocSpy.mock.calls[0];
    expect('createdAt' in payload).toBe(true);
    expect(payload.lastLogin).toBeDefined();
    // Legacy behavior: NOT normalized
    expect(payload.displayName).toBe('Ada');
  });

  it('omits createdAt on subsequent writes (existing doc exists)', async () => {
    const { writeMyscrumbudgetProfile } = await import('../profileWrites');
    getDocSpy.mockResolvedValueOnce({ exists: () => true });
    setDocSpy.mockResolvedValueOnce(undefined);
    const user = { uid: 'uid-A', email: 'a@b.com', displayName: 'Ada', photoURL: null } as User;
    await writeMyscrumbudgetProfile(user);
    const [, payload] = setDocSpy.mock.calls[0];
    expect('createdAt' in payload).toBe(false);
    expect(payload.lastLogin).toBeDefined();
  });

  it('writes empty-string email when user.email is null (legacy compatibility)', async () => {
    const { writeMyscrumbudgetProfile } = await import('../profileWrites');
    getDocSpy.mockResolvedValueOnce({ exists: () => false });
    setDocSpy.mockResolvedValueOnce(undefined);
    const user = { uid: 'uid-A', email: null, displayName: 'Ada', photoURL: null } as unknown as User;
    await writeMyscrumbudgetProfile(user);
    const [, payload] = setDocSpy.mock.calls[0];
    expect(payload.email).toBe('');
  });
});
