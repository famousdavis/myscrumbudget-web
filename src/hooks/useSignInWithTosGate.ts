// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { sanitizeFirebaseError } from '@/lib/firebase/errors';
import { isTosAccepted } from '@/lib/tos/tosHelpers';

/**
 * Encapsulates the "sign in with TOS gate" pattern previously duplicated
 * inside CloudStorageSection.tsx and CloudStorageModal.tsx.
 *
 * Consumers render their own <TosConsentModal> driven by `showTosModal`,
 * `handleTosAccepted`, and `handleTosCancel`.
 *
 * Behavior identical to the prior per-component implementations:
 * - auth/popup-closed-by-user, auth/cancelled-popup-request → silent return
 * - auth/popup-blocked → "Pop-up was blocked. Allow pop-ups…" inline message
 * - all other errors → sanitizeFirebaseError(err)
 * - signInError clears at the start of every new sign-in attempt
 */
export function useSignInWithTosGate(): {
  handleSignIn: (provider: 'google' | 'microsoft') => void;
  showTosModal: boolean;
  handleTosAccepted: () => void;
  handleTosCancel: () => void;
  signInError: string | null;
} {
  const { signInWithGoogle, signInWithMicrosoft } = useAuth();

  const [signInError, setSignInError] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<'google' | 'microsoft' | null>(null);
  const [showTosModal, setShowTosModal] = useState(false);

  const doSignIn = useCallback(async (provider: 'google' | 'microsoft') => {
    setSignInError(null);
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithMicrosoft();
      }
    } catch (error) {
      const code = (error && typeof error === 'object' && 'code' in error)
        ? (error as { code: string }).code
        : '';
      // Silent returns: user closed the popup, or double-clicked the button
      // (cancelled-popup-request fires when a second popup opens while the
      // first is still in flight). Neither is a real error worth surfacing.
      if (code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request') return;
      if (code === 'auth/popup-blocked') {
        setSignInError('Pop-up was blocked. Allow pop-ups for this site and try again.');
        return;
      }
      setSignInError(sanitizeFirebaseError(error));
    }
  }, [signInWithGoogle, signInWithMicrosoft]);

  const handleSignIn = useCallback((provider: 'google' | 'microsoft') => {
    if (!isTosAccepted()) {
      setPendingProvider(provider);
      setShowTosModal(true);
      return;
    }
    void doSignIn(provider);
  }, [doSignIn]);

  const handleTosAccepted = useCallback(() => {
    setShowTosModal(false);
    if (pendingProvider) void doSignIn(pendingProvider);
    setPendingProvider(null);
  }, [pendingProvider, doSignIn]);

  const handleTosCancel = useCallback(() => {
    setShowTosModal(false);
    setPendingProvider(null);
  }, []);

  return { handleSignIn, showTosModal, handleTosAccepted, handleTosCancel, signInError };
}
