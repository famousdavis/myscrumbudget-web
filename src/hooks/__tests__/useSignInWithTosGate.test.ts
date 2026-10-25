// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The sign-in Terms gate: it shows the consent modal instead of signing in
 * whenever the acceptance stored in this browser is not the current edition's
 * TOS_VERSION. The editions are named literally, so these fail if the constant
 * is left behind when a new edition is published.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSignInWithTosGate } from '../useSignInWithTosGate';
import { TOS_STORAGE_KEY } from '@/lib/tos/tosConstants';

const mocks = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  signInWithMicrosoft: vi.fn(),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    signInWithGoogle: mocks.signInWithGoogle,
    signInWithMicrosoft: mocks.signInWithMicrosoft,
  }),
}));

async function signInWithGoogle() {
  const { result } = renderHook(() => useSignInWithTosGate());
  await act(async () => {
    result.current.handleSignIn('google');
  });
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.signInWithGoogle.mockResolvedValue(undefined);
  mocks.signInWithMicrosoft.mockResolvedValue(undefined);
});

describe('useSignInWithTosGate — the October 26, 2026 editions', () => {
  it('asks a user who accepted the October 5, 2026 editions to accept again', async () => {
    localStorage.setItem(TOS_STORAGE_KEY, '10-05-2026');
    const result = await signInWithGoogle();

    expect(result.current.showTosModal).toBe(true);
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
  });

  it('does not ask a user who accepted the October 26, 2026 editions', async () => {
    localStorage.setItem(TOS_STORAGE_KEY, '10-26-2026');
    const result = await signInWithGoogle();

    expect(result.current.showTosModal).toBe(false);
    expect(mocks.signInWithGoogle).toHaveBeenCalledTimes(1);
  });
});
