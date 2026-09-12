// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { httpsCallable } from 'firebase/functions';
import type { User } from 'firebase/auth';
import { db, functions } from '@/lib/firebase/config';
import { INVITATIONS_ENABLED } from '@/lib/featureFlags';
import {
  INVITE_CLAIM_SETTLED_EVENT,
  type ClaimPendingInvitationsResult,
  type InviteClaimSettledDetail,
} from '@/lib/firebase/invitation-types';

/**
 * The ONE rejection code logged at debug rather than error, and it must stay
 * exactly one. `functions/failed-precondition` is what the claim CF throws
 * for a caller whose sign-in provider is not allowlisted AND whose email is
 * unverified — after WI-1 that is no Google or Microsoft account, i.e. a
 * population measured at zero on 2026-09-12. Widening this to `unauthenticated`
 * or `internal` silences the channel, which is the defect this release exists
 * to fix, one level down.
 */
export const CLAIM_DOWNGRADED_CODE = 'functions/failed-precondition';

/**
 * Calls the claimPendingInvitations Cloud Function and reports the outcome
 * through exactly one of two window events:
 *
 *   'spert:models-changed'          — resolved with claimed.length > 0.
 *                                     Detail `{ claimed }`, cross-app and
 *                                     unfiltered; the banner filters to
 *                                     `appId === 'myscrumbudget'`. Unchanged
 *                                     since v0.28.0 (WI-2 PC1).
 *   INVITE_CLAIM_SETTLED_EVENT      — resolved with claimed.length === 0
 *                                     (`{ outcome: 'none', email }`), or
 *                                     rejected (`{ outcome: 'error', code }`).
 *
 * Fire-and-forget: returns void, dispatches internally.
 *
 * Guards (silent short-circuits — no toast, no banner):
 * - INVITATIONS_ENABLED off → return. Suite-wide kill switch; keep it.
 * - !db || !functions → return (Firebase not initialized)
 *
 * ⚠️ v0.38.1 — THE `emailVerified` GUARD IS DELETED, AND WHY MATTERS MORE THAN
 * THAT IT IS GONE. It read `if (!firebaseUser.emailVerified) return;` and its
 * comment blamed "Microsoft personal accounts". Measured 2026-09-12: Firebase
 * records EVERY `microsoft.com` sign-in as `emailVerified: false` — 10 of 10
 * in the live project, UF work/school accounts included — so the guard
 * short-circuited the claim for every Microsoft student before any email was
 * ever compared, and the banner's only failure copy was a 30-second timeout
 * that told them the link "didn't match your account". The guard was noise
 * suppression, never policy (its own comment said so); policy is the CF's
 * `email_verified` gate, which WI-1 taught to accept `microsoft.com`. The
 * client CANNOT read the sign-in provider synchronously or reliably
 * (`IdTokenResult.signInProvider` is async and `string | null`), so it does
 * not decide at all: it calls unconditionally, and the one code the CF still
 * refuses with is logged at debug. Do NOT re-add a provider or verified check
 * here — that re-creates the split-brain this release removes.
 *
 * `firebaseUser` is kept in the signature for the call-site contract
 * (`AuthProvider`, and the PC1 test that must pass unmodified) and is used for
 * the 'none' arm's `email`, which the banner shows so a student can see WHICH
 * address the claim was attempted for.
 */
export function claimPendingInvitationsAndNotify(firebaseUser: User): void {
  if (!INVITATIONS_ENABLED) return;
  if (!db || !functions) return;

  const settle = (detail: InviteClaimSettledDetail): void => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent<InviteClaimSettledDetail>(INVITE_CLAIM_SETTLED_EVENT, { detail }),
    );
  };

  void httpsCallable<Record<string, never>, ClaimPendingInvitationsResult>(
    functions,
    'claimPendingInvitations',
  )({})
    .then((res) => {
      const claimed = res.data?.claimed ?? [];
      if (claimed.length === 0) {
        // Payload gate (Lesson 27) preserved for 'spert:models-changed' — it
        // is never dispatched empty. The empty resolve is still a SETTLED
        // negative: the CF found no pending row for this token's email, or
        // every row it found was expired, pointed at a deleted project, or
        // failed its own transaction (the CF logs and continues). All four
        // return the identical `[]`; the banner's copy covers all four.
        console.debug('[claim] settled: none');
        settle({ outcome: 'none', email: firebaseUser.email ?? null });
        return;
      }
      // Observability for the campaign's end-to-end check: the first
      // Microsoft-only sign-in that claims after WI-2 ships is the only
      // evidence the whole chain works, and this line plus the banner say
      // which path fired. Debug level — hidden by the default console filter.
      console.debug('[claim] settled: claimed', claimed.length, claimed.map(c => c.appId).join(','));
      if (typeof window === 'undefined') return;
      window.dispatchEvent(
        new CustomEvent<{ claimed: ClaimPendingInvitationsResult['claimed'] }>(
          'spert:models-changed',
          { detail: { claimed } },
        ),
      );
    })
    .catch((err) => {
      const code = (err as { code?: string }).code ?? 'unknown';
      if (code === CLAIM_DOWNGRADED_CODE) {
        console.debug('[claim] refused:', code);
      } else {
        console.error('[claim] failed:', code);
      }
      // Every rejection settles the banner, the downgraded one included — a
      // student who arrived by invite link must see WHY, keyed on the code
      // and never on the server's message text (PC4; Lesson 13).
      settle({ outcome: 'error', code });
    });
}
