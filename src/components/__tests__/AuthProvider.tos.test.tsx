// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The Terms check AuthProvider runs when an auth state resolves.
 *
 * A first sign-in comes through TosConsentModal, which stores the current
 * edition in this browser before the popup opens, so the provider writes the
 * acceptance record. A session restored without that local acceptance must
 * not be stamped with the current edition: the provider trusts the record only
 * if it already names the current edition, and otherwise signs the user out so
 * the next sign-in shows the modal (as GanttApp and SPERT CFD do).
 *
 * Firestore is an in-memory fake keyed by document path; the profile writes,
 * the invitation claim and the sign-out cleanup are spies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { TOS_STORAGE_KEY, TOS_VERSION, PRIVACY_VERSION, APP_ID } from '@/lib/tos/tosConstants';

type DocData = Record<string, unknown>;

const h = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>();
  return {
    store,
    SERVER_TIMESTAMP: Object.freeze({ sentinel: 'serverTimestamp' }),
    listener: null as ((user: unknown) => void) | null,
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    performSignOutCleanup: vi.fn(),
    writeSpertsuiteProfile: vi.fn(),
    writeMyscrumbudgetProfile: vi.fn(),
    claimPendingInvitationsAndNotify: vi.fn(),
  };
});

vi.mock('@/lib/firebase/config', () => ({
  db: { name: 'db' },
  isFirebaseAvailable: true,
}));

vi.mock('@/lib/firebase/auth', () => ({
  subscribeToAuth: (callback: (user: unknown) => void) => {
    h.listener = callback;
    return () => {};
  },
  signInWithGoogle: vi.fn(),
  signInWithMicrosoft: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }),
  getDoc: h.getDoc,
  setDoc: h.setDoc,
  serverTimestamp: () => h.SERVER_TIMESTAMP,
}));

vi.mock('@/lib/auth/signOutCleanup', () => ({
  performSignOutCleanup: h.performSignOutCleanup,
}));

vi.mock('@/lib/firebase/profileWrites', () => ({
  writeSpertsuiteProfile: h.writeSpertsuiteProfile,
  writeMyscrumbudgetProfile: h.writeMyscrumbudgetProfile,
}));

vi.mock('@/lib/firebase/claimPendingInvitations', () => ({
  claimPendingInvitationsAndNotify: h.claimPendingInvitationsAndNotify,
}));

import { AuthProvider, useAuth } from '../AuthProvider';

const UID = 'uid-ada';
const ACCEPTANCE_PATH = `users/${UID}`;
const USER = {
  uid: UID,
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  providerData: [{ providerId: 'google.com' }],
} as unknown as User;

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

/** Mount the provider and resolve the auth state to `user`. */
async function resolveAuth(user: User | null) {
  const { result } = renderHook(() => useAuth(), { wrapper });
  await act(async () => {
    h.listener?.(user);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return result;
}

function acceptanceWrites() {
  return h.setDoc.mock.calls.filter(([ref]) => ref.path === ACCEPTANCE_PATH);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  h.store.clear();
  h.listener = null;
  h.getDoc.mockImplementation(async (ref: { path: string }) => {
    const data = h.store.get(ref.path);
    return { exists: () => data !== undefined, data: () => (data === undefined ? undefined : { ...data }) };
  });
  h.setDoc.mockImplementation(async (ref: { path: string }, data: DocData, options?: { merge?: boolean }) => {
    h.store.set(ref.path, options?.merge ? { ...h.store.get(ref.path), ...data } : { ...data });
  });
  h.performSignOutCleanup.mockResolvedValue(undefined);
  h.writeSpertsuiteProfile.mockResolvedValue(undefined);
  h.writeMyscrumbudgetProfile.mockResolvedValue(undefined);
});

describe('AuthProvider — a session restored without the current acceptance in this browser', () => {
  it('signs out, writing nothing, when the record names the October 5, 2026 editions', async () => {
    localStorage.setItem(TOS_STORAGE_KEY, '10-05-2026');
    h.store.set(ACCEPTANCE_PATH, { tosVersion: '10-05-2026' });
    const result = await resolveAuth(USER);

    expect(h.performSignOutCleanup).toHaveBeenCalledTimes(1);
    expect(acceptanceWrites()).toHaveLength(0);
    expect(h.store.get(ACCEPTANCE_PATH)).toEqual({ tosVersion: '10-05-2026' });
    expect(h.writeSpertsuiteProfile).not.toHaveBeenCalled();
    expect(h.writeMyscrumbudgetProfile).not.toHaveBeenCalled();
    expect(h.claimPendingInvitationsAndNotify).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it('signs out, writing nothing, when there is no acceptance record', async () => {
    const result = await resolveAuth(USER);

    expect(h.performSignOutCleanup).toHaveBeenCalledTimes(1);
    expect(acceptanceWrites()).toHaveLength(0);
    expect(h.store.has(ACCEPTANCE_PATH)).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('stays signed in, writing nothing, when the record names the current edition', async () => {
    localStorage.setItem(TOS_STORAGE_KEY, '10-05-2026');
    h.store.set(ACCEPTANCE_PATH, { tosVersion: TOS_VERSION });
    const result = await resolveAuth(USER);

    expect(h.performSignOutCleanup).not.toHaveBeenCalled();
    expect(acceptanceWrites()).toHaveLength(0);
    expect(localStorage.getItem(TOS_STORAGE_KEY)).toBe(TOS_VERSION);
    expect(h.writeSpertsuiteProfile).toHaveBeenCalledWith(USER);
    expect(result.current.user).toBe(USER);
    expect(result.current.loading).toBe(false);
  });

  it('stays signed in when the record cannot be read', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.getDoc.mockRejectedValue(Object.assign(new Error('offline'), { code: 'unavailable' }));
    const result = await resolveAuth(USER);

    expect(h.performSignOutCleanup).not.toHaveBeenCalled();
    expect(result.current.user).toBe(USER);
  });

  it('lets the user through without recording an acceptance when only the check’s read fails', async () => {
    // The check's read fails, so the user is let through; a later read then
    // finds the October 5 record. Nobody saw the new Terms, so nothing may be
    // stamped with the current edition, here or in this browser.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(TOS_STORAGE_KEY, '10-05-2026');
    h.store.set(ACCEPTANCE_PATH, { tosVersion: '10-05-2026' });
    h.getDoc.mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }));
    const result = await resolveAuth(USER);

    expect(result.current.user).toBe(USER);
    expect(h.performSignOutCleanup).not.toHaveBeenCalled();
    expect(acceptanceWrites()).toHaveLength(0);
    expect(h.store.get(ACCEPTANCE_PATH)).toEqual({ tosVersion: '10-05-2026' });
    expect(localStorage.getItem(TOS_STORAGE_KEY)).toBe('10-05-2026');
  });

  it('does not sign the user back in when the check finishes after they signed out', async () => {
    let answer: (value: unknown) => void = () => {};
    h.getDoc.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    const result = await resolveAuth(USER);
    await act(async () => {
      h.listener?.(null);
    });
    await act(async () => {
      answer({ exists: () => true, data: () => ({ tosVersion: TOS_VERSION }) });
    });

    expect(result.current.user).toBeNull();
  });
});

describe('AuthProvider — the current acceptance is in this browser', () => {
  it('records the acceptance of a first sign-in made through the consent modal', async () => {
    localStorage.setItem(TOS_STORAGE_KEY, TOS_VERSION); // TosConsentModal sets it before the popup
    const result = await resolveAuth(USER);

    await waitFor(() => expect(acceptanceWrites()).toHaveLength(1));
    expect(acceptanceWrites()[0][1]).toStrictEqual({
      acceptedAt: h.SERVER_TIMESTAMP,
      tosVersion: TOS_VERSION,
      privacyPolicyVersion: PRIVACY_VERSION,
      appId: APP_ID,
      authProvider: 'google.com',
    });
    expect(h.performSignOutCleanup).not.toHaveBeenCalled();
    expect(result.current.user).toBe(USER);
  });

  it('updates a record that names the October 5, 2026 editions after the user accepts the new ones', async () => {
    localStorage.setItem(TOS_STORAGE_KEY, TOS_VERSION);
    h.store.set(ACCEPTANCE_PATH, { tosVersion: '10-05-2026', appId: APP_ID });
    await resolveAuth(USER);

    await waitFor(() => expect(acceptanceWrites()).toHaveLength(1));
    expect(h.store.get(ACCEPTANCE_PATH)).toMatchObject({ tosVersion: TOS_VERSION, appId: APP_ID });
    expect(h.performSignOutCleanup).not.toHaveBeenCalled();
  });
});

describe('AuthProvider — signed out', () => {
  it('resolves to no user without reading or writing the record', async () => {
    const result = await resolveAuth(null);

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(h.getDoc).not.toHaveBeenCalled();
    expect(h.setDoc).not.toHaveBeenCalled();
  });
});
