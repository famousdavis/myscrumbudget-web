// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Proj = { id: string };

const mocks = vi.hoisted(() => ({
  firebaseSignOut: vi.fn(async () => undefined),
  mockAuth: { currentUser: null as { uid: string } | null },
  cancelAll: vi.fn(),
  cloudGetProjects: vi.fn<() => Promise<{ id: string }[]>>(),
  localGetProjects: vi.fn<() => Promise<{ id: string }[]>>(),
  setStorageMode: vi.fn(),
  getStorageMode: vi.fn<() => 'local' | 'cloud'>(() => 'local'),
}));

vi.mock('firebase/auth', () => ({ signOut: mocks.firebaseSignOut }));
vi.mock('@/lib/firebase/config', () => ({ auth: mocks.mockAuth }));
vi.mock('@/lib/storage/pendingSaveRegistry', () => ({ cancelAll: mocks.cancelAll }));
vi.mock('@/lib/storage/localStorage', () => ({
  createLocalStorageRepository: () => ({ getProjects: mocks.localGetProjects }),
}));
vi.mock('@/lib/storage/firestoreRepo', () => ({
  createFirestoreRepository: () => ({ getProjects: mocks.cloudGetProjects }),
}));
vi.mock('@/lib/storage/storageMode', () => ({
  setStorageMode: mocks.setStorageMode,
  getStorageMode: mocks.getStorageMode,
}));

import { performSignOutCleanup, beginCloudUpload, endCloudUpload } from '../signOutCleanup';

const ALWAYS_CLEAR = ['msb:exportAttribution', 'msb:ratesReviewed', 'msb:hasUploadedToCloud'];
const CLOUD_ONLY_CLEAR = ['msb:projects', 'msb:settings', 'msb:teamPool', 'msb:changeLog', 'msb:originRef'];
const PRESERVE_KEYS = [
  'msb-workspace-id', 'spert_tos_accepted_version', 'msb:suppressLocalStorageWarning',
  'msb:theme', 'msb:version', 'spert_firstRun_seen',
];
const ALL_SEEDED = [...ALWAYS_CLEAR, ...CLOUD_ONLY_CLEAR, ...PRESERVE_KEYS];

function seedAll() {
  localStorage.clear();
  for (const k of ALL_SEEDED) localStorage.setItem(k, `__value_${k}`);
}

describe('performSignOutCleanup', () => {
  let reloadMock: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    mocks.firebaseSignOut.mockReset().mockResolvedValue(undefined);
    mocks.cancelAll.mockReset();
    mocks.setStorageMode.mockReset();
    mocks.getStorageMode.mockReset().mockReturnValue('local');
    // Default: a signed-in user whose cloud copy EXISTS, so the cloud-mode
    // clear is permitted. Tests that exercise the v0.37.0 guard override these.
    mocks.mockAuth.currentUser = { uid: 'u1' };
    mocks.cloudGetProjects.mockReset().mockResolvedValue([{ id: 'cloud-p1' }] as Proj[]);
    mocks.localGetProjects.mockReset().mockResolvedValue([{ id: 'local-p1' }] as Proj[]);

    seedAll();

    originalLocation = window.location;
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  // sessionStorage clear is unconditional — not mode-gated — so tested at
  // top level rather than inside a cloud-mode or local-mode describe block.
  // Three tests cover both modes explicitly so a future regression that
  // mistakenly mode-gates the sessionStorage clear inside the cloud-only
  // branch would be caught.
  it('clears sessionStorage invite key on sign-out (default mode)', async () => {
    sessionStorage.setItem('msb:invite-session', 'tok');
    await performSignOutCleanup();
    expect(sessionStorage.getItem('msb:invite-session')).toBeNull();
  });

  it('clears sessionStorage invite key in local mode', async () => {
    mocks.getStorageMode.mockReturnValue('local');
    sessionStorage.setItem('msb:invite-session', 'tok-local');
    await performSignOutCleanup();
    expect(sessionStorage.getItem('msb:invite-session')).toBeNull();
  });

  it('clears sessionStorage invite key in cloud mode (S1 — unconditional regardless of mode)', async () => {
    mocks.getStorageMode.mockReturnValue('cloud');
    sessionStorage.setItem('msb:invite-session', 'tok-cloud');
    await performSignOutCleanup();
    expect(sessionStorage.getItem('msb:invite-session')).toBeNull();
  });

  describe('cloud mode', () => {
    beforeEach(() => { mocks.getStorageMode.mockReturnValue('cloud'); });

    it('clears ALWAYS_CLEAR and CLOUD_ONLY_CLEAR keys; preserves per-browser keys', async () => {
      await performSignOutCleanup();
      for (const k of ALWAYS_CLEAR) expect(localStorage.getItem(k), `${k} should be cleared`).toBeNull();
      for (const k of CLOUD_ONLY_CLEAR) expect(localStorage.getItem(k), `${k} cleared in cloud mode`).toBeNull();
      for (const k of PRESERVE_KEYS) expect(localStorage.getItem(k), `${k} preserved`).toBe(`__value_${k}`);
    });
  });

  describe('local mode', () => {
    beforeEach(() => { mocks.getStorageMode.mockReturnValue('local'); });

    it('clears ALWAYS_CLEAR keys but preserves user data and fingerprint keys', async () => {
      await performSignOutCleanup();
      for (const k of ALWAYS_CLEAR) expect(localStorage.getItem(k), `${k} should be cleared`).toBeNull();
      for (const k of CLOUD_ONLY_CLEAR) {
        expect(localStorage.getItem(k), `${k} must NOT be cleared in local mode`).toBe(`__value_${k}`);
      }
      for (const k of PRESERVE_KEYS) expect(localStorage.getItem(k), `${k} preserved`).toBe(`__value_${k}`);
    });
  });

  it('reads mode BEFORE setStorageMode (gate fires on pre-reset value)', async () => {
    const order: string[] = [];
    mocks.getStorageMode.mockImplementation(() => { order.push('getStorageMode'); return 'cloud'; });
    mocks.setStorageMode.mockImplementation(() => { order.push('setStorageMode'); });
    await performSignOutCleanup();
    expect(order.indexOf('getStorageMode')).toBeLessThan(order.indexOf('setStorageMode'));
  });

  it('calls cancelAll before firebaseSignOut', async () => {
    const order: string[] = [];
    mocks.cancelAll.mockImplementation(() => { order.push('cancelAll'); });
    mocks.firebaseSignOut.mockImplementation(async () => { order.push('firebaseSignOut'); });
    await performSignOutCleanup();
    expect(order.indexOf('cancelAll')).toBeLessThan(order.indexOf('firebaseSignOut'));
  });

  /**
   * v0.37.0 — the cloud-copy guard on step 2b.
   *
   * ⚠️ THE ASYMMETRY IS THE POINT, and it is why these tests assert the
   * PRESERVED direction more than the cleared one. Clearing is tidy-up: failing
   * to tidy up leaves stale keys and costs nothing. Clearing wrongly destroys
   * the user's only copy. Every uncertain outcome must therefore preserve.
   *
   * This is not hypothetical. While the active repository was a module global
   * reset to localStorage on every page load, a cloud-mode user's work WAS in
   * localStorage, and the unguarded step 2b deleted it as redundant.
   */
  describe('cloud-copy guard on the cloud-only clear (v0.37.0)', () => {
    beforeEach(() => { mocks.getStorageMode.mockReturnValue('cloud'); });

    it('clears the local copy when the cloud copy is confirmed present', async () => {
      mocks.cloudGetProjects.mockResolvedValue([{ id: 'cloud-p1' }]);
      await performSignOutCleanup();
      for (const k of CLOUD_ONLY_CLEAR) expect(localStorage.getItem(k)).toBeNull();
    });

    it('KEEPS the local copy when the cloud is empty and local is not', async () => {
      mocks.cloudGetProjects.mockResolvedValue([]);
      mocks.localGetProjects.mockResolvedValue([{ id: 'local-p1' }]);
      await performSignOutCleanup();
      for (const k of CLOUD_ONLY_CLEAR) {
        expect(localStorage.getItem(k), `${k} must survive an unconfirmed cloud`).toBe(`__value_${k}`);
      }
      // ALWAYS_CLEAR is unaffected by the guard — it is not user data.
      for (const k of ALWAYS_CLEAR) expect(localStorage.getItem(k)).toBeNull();
    });

    it('KEEPS the local copy when the cloud read REJECTS', async () => {
      mocks.cloudGetProjects.mockRejectedValue({ code: 'permission-denied' });
      await performSignOutCleanup();
      for (const k of CLOUD_ONLY_CLEAR) expect(localStorage.getItem(k)).toBe(`__value_${k}`);
    });

    it('KEEPS the local copy when there is no current user to check against', async () => {
      mocks.mockAuth.currentUser = null;
      await performSignOutCleanup();
      expect(mocks.cloudGetProjects).not.toHaveBeenCalled();
      for (const k of CLOUD_ONLY_CLEAR) expect(localStorage.getItem(k)).toBe(`__value_${k}`);
    });

    it('clears when BOTH sides are empty — nothing is at risk', async () => {
      mocks.cloudGetProjects.mockResolvedValue([]);
      mocks.localGetProjects.mockResolvedValue([]);
      await performSignOutCleanup();
      for (const k of CLOUD_ONLY_CLEAR) expect(localStorage.getItem(k)).toBeNull();
    });

    it('KEEPS the local copy when the cloud read never settles (timeout)', async () => {
      // A dead network must not hang sign-out, and a timeout is FAILURE — which
      // takes the preserve branch.
      vi.useFakeTimers();
      try {
        mocks.cloudGetProjects.mockReturnValue(new Promise<Proj[]>(() => {}));
        const done = performSignOutCleanup();
        await vi.advanceTimersByTimeAsync(6000);
        await done;
        for (const k of CLOUD_ONLY_CLEAR) expect(localStorage.getItem(k)).toBe(`__value_${k}`);
        expect(reloadMock).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
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
    await expect(performSignOutCleanup()).rejects.toThrow('network failure');
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('clears always-clear keys and resets the mode even when firebaseSignOut rejects', async () => {
    mocks.getStorageMode.mockReturnValue('cloud');
    mocks.firebaseSignOut.mockRejectedValueOnce(new Error('revoked'));
    await expect(performSignOutCleanup()).rejects.toThrow();
    for (const k of ALWAYS_CLEAR) expect(localStorage.getItem(k)).toBeNull();
    // v0.37.0: resetting the mode IS the repository reset — RepositoryProvider
    // re-derives from it. There is no longer a global to swap.
    expect(mocks.setStorageMode).toHaveBeenCalledWith('local');
  });

  it('second call is a no-op while first is in flight (cleanupInFlight guard)', async () => {
    const first = performSignOutCleanup();
    const second = performSignOutCleanup();
    await Promise.all([first, second]);
    expect(mocks.cancelAll).toHaveBeenCalledTimes(1);
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  /**
   * WI-17 (v0.37.11) — sign-out during a local→cloud upload.
   *
   * `confirmUpload` switches the app to cloud mode BEFORE `importAll` finishes, so for
   * the length of the upload the cloud holds a PREFIX of the local data. Every check in
   * `confirmCloudCopy` asks whether the cloud has projects, not whether it has all of
   * them, so a partial copy reads as a complete one — and the local original, which is
   * the only place the un-uploaded tail exists, was deleted.
   *
   * ⚠️ THIS GROUP IS [FALSIFY-AFTER], NOT [FAILS-TODAY], AND THE DISTINCTION IS REAL.
   * Against v0.37.10 the observable-only form of the first test — cloud non-empty, local
   * non-empty, mode cloud, keys survive — is the EXACT fixture of
   * "clears the local copy when the cloud copy is confirmed present" above, which passes
   * while asserting the opposite. The in-flight flag is the only thing that separates
   * them and it did not exist. A red manufactured by naming a missing identifier would
   * have been indistinguishable from a typo; this is verified by breaking the finished
   * guard instead.
   */
  describe('upload-in-flight guard on the cloud-only clear (v0.37.11)', () => {
    beforeEach(() => {
      mocks.getStorageMode.mockReturnValue('cloud');
      // The module flag outlives a single test — leaking it would silently disable
      // every clear in the tests that follow.
      endCloudUpload();
    });
    afterEach(() => { endCloudUpload(); });

    it('[FALSIFY-AFTER] KEEPS the local copy while an upload is in flight, and clears once it finishes', async () => {
      // ⚠️ BOTH HALVES IN ONE TEST. The first is a pure absence and is asserted
      // elsewhere in this file for a different cause; only the second — the SAME
      // fixture clearing after release — makes it discriminate.
      mocks.cloudGetProjects.mockResolvedValue([{ id: 'cloud-p1' }]);
      mocks.localGetProjects.mockResolvedValue([{ id: 'local-p1' }]);

      beginCloudUpload();
      await performSignOutCleanup();
      for (const k of CLOUD_ONLY_CLEAR) {
        expect(localStorage.getItem(k), `${k} must survive a sign-out mid-upload`)
          .toBe(`__value_${k}`);
      }

      endCloudUpload();
      seedAll();
      await performSignOutCleanup();
      for (const k of CLOUD_ONLY_CLEAR) {
        expect(localStorage.getItem(k), `${k} must clear once the upload has finished`)
          .toBeNull();
      }
    });

    it('does not even ASK the cloud while an upload is in flight', async () => {
      // The guard runs before any network call. Not an optimisation: the answer the
      // cloud would give is affirmative and wrong, so the cheapest correct behaviour
      // is not to ask.
      mocks.cloudGetProjects.mockResolvedValue([{ id: 'cloud-p1' }]);
      beginCloudUpload();
      await performSignOutCleanup();
      expect(mocks.cloudGetProjects).not.toHaveBeenCalled();
    });

    it('the PII and UX keys still clear mid-upload — the guard is narrow by design', async () => {
      // The guard protects user DATA only. Sign-out must still remove export
      // attribution and the UX flags, exactly as the cloud-copy guard above does.
      mocks.cloudGetProjects.mockResolvedValue([{ id: 'cloud-p1' }]);
      beginCloudUpload();
      await performSignOutCleanup();
      for (const k of ALWAYS_CLEAR) expect(localStorage.getItem(k)).toBeNull();
      for (const k of PRESERVE_KEYS) expect(localStorage.getItem(k)).toBe(`__value_${k}`);
    });

    it('a LOCAL-mode sign-out mid-upload is unaffected — it never reached the guard', async () => {
      // Local mode does not run step 2b at all, so the flag must not change anything
      // there. Pins that the new guard did not widen the clear's gate.
      mocks.getStorageMode.mockReturnValue('local');
      beginCloudUpload();
      await performSignOutCleanup();
      for (const k of CLOUD_ONLY_CLEAR) expect(localStorage.getItem(k)).toBe(`__value_${k}`);
    });
  });
});
