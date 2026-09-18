// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The pop-up modal's local→cloud upload and the sign-out guard (v0.42.0).
 *
 * ⚠️ WHY THIS FILE EXISTS. `CloudStorageSection` — the Settings surface — has
 * marked its uploads in flight since v0.37.11, so a sign-out during one keeps
 * the local data instead of deleting it while the cloud holds a prefix. The
 * MODAL runs the same upload from the auth chip and never set the flag at all.
 * That gap is older than this release and unrelated to per-user preferences; it
 * is fixed here because this release is the first to touch the upload path.
 *
 * ⚠️ AND THE MODAL IS THE RISKIER OF THE TWO SURFACES, which is what makes the
 * omission worth a release of its own attention: the auth chip is in the top bar
 * of every page, so the modal's upload typically runs with the DASHBOARD mounted
 * underneath it, while the Settings section runs from a page that lists no
 * projects.
 *
 * ⚠️ THE MIGRATION STATE IS DRIVEN, NOT FORCED. `migrating` is the component's
 * own `useState` with no way in from outside, so these tests click the real path
 * — Cloud radio → "Upload to Cloud" → `confirmUpload` — with `importAll` held on
 * an unresolved promise. The flag's EFFECT (a sign-out mid-upload keeps the local
 * keys) is pinned in `signOutCleanup.test.ts`; what is asserted here is that this
 * surface sets and releases it, which is the half that was missing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { AppState, Project } from '@/types/domain';

const { state } = vi.hoisted(() => ({
  state: {
    importAllResolve: null as null | (() => void),
    importAllReject: null as null | ((e: Error) => void),
    importAllCalls: 0,
    uploadFlagCalls: [] as string[],
  },
}));

const projects = [{ id: 'p1' }, { id: 'p2' }] as unknown as Project[];

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: { uid: 'u1', displayName: 'Ada Lovelace', email: 'ada@example.com' },
    loading: false,
    firebaseAvailable: true,
    signOut: async () => {},
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
// ⚠️ PARTIAL mock, and `importOriginal` is load-bearing: the component imports
// only the two setters, but replacing the whole module would also replace
// `performSignOutCleanup` for anything else in this graph. The wrappers record
// the calls AND delegate to the real functions, so the flag genuinely moves.
vi.mock('@/lib/auth/signOutCleanup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/signOutCleanup')>();
  return {
    ...actual,
    beginCloudUpload: (...a: []) => { state.uploadFlagCalls.push('begin'); return actual.beginCloudUpload(...a); },
    endCloudUpload: (...a: []) => { state.uploadFlagCalls.push('end'); return actual.endCloudUpload(...a); },
  };
});

const { CloudStorageModal } = await import('@/components/CloudStorageModal');

/** Click through to the upload and leave it in flight. */
async function startUpload() {
  render(<CloudStorageModal onClose={() => {}} />);
  await act(async () => {
    fireEvent.click(screen.getByRole('radio', { name: /Cloud \(sync across devices\)/i }));
  });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Upload to Cloud' })).toBeDefined());
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Upload to Cloud' }));
  });
  // Asserted, not assumed: these tests are worthless if the flow never started.
  await waitFor(() => expect(state.importAllCalls).toBe(1));
  expect(state.importAllResolve, 'the upload is genuinely mid-flight').not.toBeNull();
}

describe('CloudStorageModal — the upload marks itself in flight (v0.42.0)', () => {
  beforeEach(() => {
    state.importAllResolve = null;
    state.importAllReject = null;
    state.importAllCalls = 0;
    state.uploadFlagCalls.length = 0;
  });

  it('[A28a] marks the upload in flight for the WHOLE upload, and releases it on success', async () => {
    await startUpload();

    expect(state.uploadFlagCalls, 'set before the first cloud write, and still set').toEqual(['begin']);

    await act(async () => { state.importAllResolve!(); });
    await waitFor(() => expect(state.uploadFlagCalls).toEqual(['begin', 'end']));
  });

  it('[A28b] releases the flag even when the upload FAILS', async () => {
    // ⚠️ THE `finally` IS THE POINT. A failed upload is exactly when a leaked
    // flag does harm: it is per page session, so nothing else clears it, and
    // every later sign-out would then keep local data that is already safely in
    // the cloud — the guard failing in the direction nobody notices.
    await startUpload();

    await act(async () => { state.importAllReject!(new Error('network')); });
    await waitFor(() => expect(state.uploadFlagCalls).toEqual(['begin', 'end']));
  });
});
