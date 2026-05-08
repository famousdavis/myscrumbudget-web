// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { httpsCallable } from 'firebase/functions';
import type { User } from 'firebase/auth';
import { db, functions } from '@/lib/firebase/config';
import { INVITATIONS_ENABLED } from '@/lib/featureFlags';
import type { ClaimPendingInvitationsResult } from '@/lib/firebase/invitation-types';

/**
 * Calls the claimPendingInvitations Cloud Function and dispatches a
 * 'spert:models-changed' window event when the user has any newly
 * claimed invitations.
 *
 * Fire-and-forget: returns void, dispatches event internally.
 *
 * Guards (silent short-circuits — no toast, no banner):
 * - INVITATIONS_ENABLED off → return
 * - emailVerified === false → return (Microsoft personal accounts)
 * - !db || !functions → return (Firebase not initialized)
 *
 * The CF identifies the caller by auth.token.email and claims across
 * all SPERT apps. claimed[] may include items from non-MSB apps;
 * InvitationBanner's Effect 5 filters to MSB-only before display.
 */
export function claimPendingInvitationsAndNotify(firebaseUser: User): void {
  if (!INVITATIONS_ENABLED) return;
  if (!firebaseUser.emailVerified) return;
  if (!db || !functions) return;

  void httpsCallable<Record<string, never>, ClaimPendingInvitationsResult>(
    functions,
    'claimPendingInvitations',
  )({})
    .then((res) => {
      const claimed = res.data?.claimed ?? [];
      if (claimed.length === 0) return;            // payload gate (Lesson 27)
      if (typeof window === 'undefined') return;
      window.dispatchEvent(
        new CustomEvent<{ claimed: ClaimPendingInvitationsResult['claimed'] }>(
          'spert:models-changed',
          { detail: { claimed } },
        ),
      );
    })
    .catch((err) => {
      console.error('[claim] failed:', (err as { code?: string }).code ?? 'unknown');
    });
}
