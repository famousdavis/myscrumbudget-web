// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted so these are available to the vi.mock factories (which run
// before module-level const initialization).
const mocks = vi.hoisted(() => ({
  firebaseSignOut: vi.fn(async () => undefined),
  mockAuth: { currentUser: null },
  cancelAll: vi.fn(),
  switchRepoImpl: vi.fn(),
  createLocalStorageRepository: vi.fn(() => ({ __local: true })),
  setStorageMode: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  signOut: mocks.firebaseSignOut,
}));
vi.mock('@/lib/firebase/config', () => ({
  auth: mocks.mockAuth,
}));
vi.mock('@/lib/storage/pendingSaveRegistry', () => ({
  cancelAll: mocks.cancelAll,
}));
vi.mock('@/lib/storage/repo', () => ({
  switchRepoImpl: mocks.switchRepoImpl,
}));
vi.mock('@/lib/storage/localStorage', () => ({
  createLocalStorageRepository: mocks.createLocalStorageRepository,
}));
vi.mock('@/lib/storage/storageMode', () => ({
  setStorageMode: mocks.setStorageMode,
}));

import { performSignOutCleanup } from '../signOutCleanup';

const CLEAR_KEYS = [
  'msb:projects',
  'msb:settings',
  'msb:teamPool',
  'msb:changeLog',
  'msb:originRef',
  'msb:exportAttribution',
  'msb:ratesReviewed',
  'msb:hasUploadedToCloud',
];

const PRESERVE_KEYS = [
  'msb-workspace-id',
  'spert_tos_accepted_version',
  'msb:suppressLocalStorageWarning',
  'msb:theme',
  'msb:version',
  'spert_firstRun_seen',
];

describe('performSignOutCleanup', () => {
  let reloadMock: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    mocks.firebaseSignOut.mockReset().mockResolvedValue(undefined);
    mocks.cancelAll.mockReset();
    mocks.switchRepoImpl.mockReset();
    mocks.createLocalStorageRepository.mockReset().mockReturnValue({ __local: true });
    mocks.setStorageMode.mockReset();

    // Seed both CLEAR and PRESERVE keys with sentinel values.
    localStorage.clear();
    for (const k of CLEAR_KEYS) localStorage.setItem(k, `__value_${k}`);
    for (const k of PRESERVE_KEYS) localStorage.setItem(k, `__value_${k}`);

    // Replace window.location.reload via defineProperty (jsdom's location
    // is read-only on newer versions).
    originalLocation = window.location;
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('clears every per-user key and preserves per-browser keys', async () => {
    await performSignOutCleanup();
    for (const k of CLEAR_KEYS) {
      expect(localStorage.getItem(k), `expected ${k} to be cleared`).toBeNull();
    }
    for (const k of PRESERVE_KEYS) {
      expect(localStorage.getItem(k), `expected ${k} preserved`).toBe(`__value_${k}`);
    }
  });

  it('invokes cancelAll before firebaseSignOut (save-race guard)', async () => {
    const order: string[] = [];
    mocks.cancelAll.mockImplementation(() => { order.push('cancelAll'); });
    mocks.firebaseSignOut.mockImplementation(async () => { order.push('firebaseSignOut'); });

    await performSignOutCleanup();

    expect(order.indexOf('cancelAll')).toBeLessThan(order.indexOf('firebaseSignOut'));
  });

  it('swaps the delegating repo to localStorage before firebaseSignOut', async () => {
    const order: string[] = [];
    mocks.switchRepoImpl.mockImplementation(() => { order.push('switchRepoImpl'); });
    mocks.firebaseSignOut.mockImplementation(async () => { order.push('firebaseSignOut'); });

    await performSignOutCleanup();

    expect(order.indexOf('switchRepoImpl')).toBeLessThan(order.indexOf('firebaseSignOut'));
    expect(mocks.switchRepoImpl).toHaveBeenCalledWith({ __local: true });
  });

  it("resets storage mode to 'local'", async () => {
    await performSignOutCleanup();
    expect(mocks.setStorageMode).toHaveBeenCalledWith('local');
  });

  it('reloads the page exactly once', async () => {
    await performSignOutCleanup();
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('still reloads when firebaseSignOut rejects (try/finally guard)', async () => {
    mocks.firebaseSignOut.mockRejectedValueOnce(new Error('network failure'));
    // performSignOutCleanup awaits firebaseSignOut inside a try and always
    // fires reload in the finally; the rejection still propagates to the
    // caller (which in production AuthProvider.signOut is the moment the
    // page is about to unmount anyway).
    await expect(performSignOutCleanup()).rejects.toThrow('network failure');
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('still clears localStorage and swaps repo when firebaseSignOut rejects', async () => {
    mocks.firebaseSignOut.mockRejectedValueOnce(new Error('revoked'));
    await expect(performSignOutCleanup()).rejects.toThrow();
    for (const k of CLEAR_KEYS) {
      expect(localStorage.getItem(k)).toBeNull();
    }
    expect(mocks.switchRepoImpl).toHaveBeenCalled();
    expect(mocks.setStorageMode).toHaveBeenCalledWith('local');
  });
});
