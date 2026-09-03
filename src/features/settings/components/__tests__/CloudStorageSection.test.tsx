// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The Settings Sign out button during a local→cloud upload (v0.37.11).
 *
 * ⚠️ THE MIGRATION STATE IS DRIVEN, NOT FORCED. `migrating` is this component's own
 * `useState` and there is no way to set it from outside, so these tests click the real
 * path — Cloud radio → "Upload to Cloud" → `confirmUpload` — with `importAll` held on an
 * unresolved promise. Reaching in to set the flag would test a state the app cannot
 * actually be in, and would not prove the button is reachable while it is set.
 *
 * ⚠️ `switchMode` is a mock here and does NOT change `mode`. That is deliberate and it
 * does not weaken the test: the Sign out button is gated on `{user && (` alone
 * (`CloudStorageSection.tsx:276`), never on the mode, so it is on screen throughout.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { AppState, Project } from '@/types/domain';

const { state } = vi.hoisted(() => ({
  state: {
    importAllResolve: null as null | (() => void),
    importAllReject: null as null | ((e: Error) => void),
    importAllCalls: 0,
    signOutCalls: 0,
    uploadFlagCalls: [] as string[],
  },
}));

const projects = [{ id: 'p1' }, { id: 'p2' }] as unknown as Project[];

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: { uid: 'u1', displayName: 'Ada Lovelace', email: 'ada@example.com' },
    loading: false,
    firebaseAvailable: true,
    signOut: async () => { state.signOutCalls += 1; },
  }),
}));
vi.mock('@/components/Toast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
  addToastGlobal: vi.fn(),
}));
vi.mock('@/components/RepositoryProvider', () => ({
  useRepository: () => ({
    repository: {
      getProjects: async () => projects,
      exportAll: async () => ({ projects } as unknown as AppState),
    },
    mode: 'local' as const,
    switchMode: vi.fn(),
    isCloud: false,
  }),
}));
vi.mock('@/lib/storage/firestoreRepo', () => ({
  createFirestoreRepository: () => ({
    // Never settles until the test lets it — this IS the migration window.
    importAll: () => {
      state.importAllCalls += 1;
      return new Promise<void>((resolve, reject) => {
        state.importAllResolve = resolve;
        state.importAllReject = reject;
      });
    },
  }),
}));
// ⚠️ PARTIAL mock, and the `importOriginal` is load-bearing: `CloudStorageSection`
// imports only the two setters, but replacing the whole module would also replace
// `performSignOutCleanup` for anything else in this graph. Only the two setters are
// observed; their EFFECT is pinned in signOutCleanup.test.ts.
vi.mock('@/lib/auth/signOutCleanup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/signOutCleanup')>();
  return {
    ...actual,
    beginCloudUpload: (...a: []) => { state.uploadFlagCalls.push('begin'); return actual.beginCloudUpload(...a); },
    endCloudUpload: (...a: []) => { state.uploadFlagCalls.push('end'); return actual.endCloudUpload(...a); },
  };
});
vi.mock('@/hooks/useSignInWithTosGate', () => ({
  useSignInWithTosGate: () => ({
    handleSignIn: vi.fn(),
    showTosModal: false,
    handleTosAccepted: vi.fn(),
    handleTosCancel: vi.fn(),
    signInError: null,
  }),
}));

import { CloudStorageSection } from '../CloudStorageSection';

const signOutButton = () => screen.getByRole('button', { name: 'Sign out' }) as HTMLButtonElement;

/** The section is a CollapsibleSection and is closed on mount. */
function expandSection() {
  fireEvent.click(screen.getByRole('button', { name: /Cloud Storage/i }));
}

/** Cloud radio → confirm dialog → "Upload to Cloud". Leaves the upload in flight. */
async function startUpload() {
  await act(async () => {
    fireEvent.click(screen.getByRole('radio', { name: /Cloud \(sync across devices\)/i }));
  });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Upload to Cloud' })).toBeDefined());
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Upload to Cloud' }));
  });
}

describe('CloudStorageSection — Sign out during a local→cloud upload', () => {
  beforeEach(() => {
    state.importAllResolve = null;
    state.importAllReject = null;
    state.importAllCalls = 0;
    state.signOutCalls = 0;
    state.uploadFlagCalls = [];
    localStorage.clear();
  });

  it('[FAILS-TODAY] the Sign out button is DISABLED while an upload is in flight', async () => {
    render(<CloudStorageSection />);
    expandSection();
    expect(signOutButton().disabled).toBe(false);   // idle: available, as it should be

    await startUpload();

    // The upload is genuinely mid-flight — asserted, not assumed, so this cannot
    // pass because the flow never started.
    expect(state.importAllCalls).toBe(1);
    expect(state.importAllResolve).not.toBeNull();
    expect(signOutButton().disabled).toBe(true);
  });

  it('clicking Sign out mid-upload does nothing — the disable is not cosmetic', async () => {
    // A `disabled` attribute that some other handler bypasses would satisfy the
    // assertion above while leaving the defect intact.
    render(<CloudStorageSection />);
    expandSection();
    await startUpload();

    fireEvent.click(signOutButton());
    expect(state.signOutCalls).toBe(0);
  });

  it('the button is usable again once the upload settles', async () => {
    // The guard must not strand the user signed in. Pairs with the release test in
    // signOutCleanup.test.ts, which covers the module-level flag.
    render(<CloudStorageSection />);
    expandSection();
    await startUpload();
    expect(signOutButton().disabled).toBe(true);

    await act(async () => { state.importAllResolve!(); });
    await waitFor(() => expect(signOutButton().disabled).toBe(false));
  });

  it('marks the upload in flight for the WHOLE upload, and releases it on success', async () => {
    /**
     * ⚠️ WHAT THIS DOES AND DOES NOT PROVE, stated rather than implied. It asserts the
     * component PARTICIPATES in the protocol — that it opens the flag before the upload
     * and closes it after. It does NOT assert what the flag then does; that effect is
     * pinned in `signOutCleanup.test.ts`. The two together are the coverage.
     *
     * ⚠️ IT EXISTS BECAUSE NOTHING ELSE FAILS IF THE RELEASE IS DELETED. Every other
     * test here observes `migrating`, which is separate state, and the signOutCleanup
     * tests call the setters directly. Remove `endCloudUpload()` from the finally and,
     * without this test, the whole suite stays green while the app permanently blocks
     * every later sign-out cleanup — the flag would never be lowered again.
     */
    render(<CloudStorageSection />);
    expandSection();
    await startUpload();

    expect(state.uploadFlagCalls).toEqual(['begin']);   // still open, mid-upload

    await act(async () => { state.importAllResolve!(); });
    await waitFor(() => expect(state.uploadFlagCalls).toEqual(['begin', 'end']));
  });

  it('releases the flag even when the upload FAILS', async () => {
    // The failure path is the one that matters: it is the path the defect runs on,
    // and a release that only happens on success would leave the flag raised forever
    // after exactly the upload that went wrong.
    render(<CloudStorageSection />);
    expandSection();
    await startUpload();

    await act(async () => { state.importAllReject!(new Error('permission-denied')); });
    await waitFor(() => expect(state.uploadFlagCalls).toEqual(['begin', 'end']));
  });
});
