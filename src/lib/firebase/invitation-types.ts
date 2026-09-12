// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Timestamp } from 'firebase/firestore';

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface PendingInvite {
  tokenId: string;
  inviteeEmail: string;
  role: 'editor' | 'viewer';
  status: InvitationStatus;
  createdAt: Timestamp;
  emailSendCount: number;
  modelName?: string;
}

export interface SendInvitationEmailInput {
  appId: 'myscrumbudget'; // string literal — NOT APP_ID constant (Lesson 15)
  modelId: string;
  emails: string[];
  role: 'editor' | 'viewer';
  isVoting: false;
}

// CF response shapes — verbatim from ARCHITECTURE.md §"CF response shapes".
// added[] and invited[] are PLAIN STRING ARRAYS (email addresses), not objects.
//
// Semantics (from CF source — confirm against actual handlers if behavior changes):
//   added[]   — email matched an existing spertsuite_profiles doc; the user was
//               written DIRECTLY into the project's members map. NO email sent
//               (auto-add path). The user appears in the member list immediately.
//   invited[] — email had no matching spertsuite_profiles doc; an entry was
//               created in spertsuite_invitations with status: 'pending' and
//               an invitation email was sent. The entry appears in the pending
//               list until the user signs in (then claim moves it to members).
//   failed[]  — CF could not process this email (rate limit, malformed input,
//               permission error). reason field describes the failure.
export interface SendInvitationEmailResult {
  added: string[];
  invited: string[];
  failed: { email: string; reason: string }[];
}

export interface ClaimPendingInvitationsResult {
  claimed: { appId: string; modelId: string; modelName: string }[];
}

/**
 * v0.38.1 — the claim's SETTLED channel, dispatched by
 * `claimPendingInvitationsAndNotify` exactly when `spert:models-changed` is
 * NOT: the callable rejected, or it resolved with no rows at all. One event
 * per settlement, never two — `spert:models-changed` is byte-identical to
 * v0.28.0 when `claimed.length > 0`, which is what the PC1 test pins.
 *
 * The name and the detail type live HERE, in the module both the dispatcher
 * and the consumer already import, so the two cannot spell the event
 * differently. Nothing at either end can pin that the event dispatched is the
 * event consumed; the shared constant plus the integration test in
 * `useInvitationLanding.hook.test.tsx` are what close that gap.
 *
 * `email` on the 'none' arm is the signed-in account's address from Firebase
 * Auth — client auth state, NOT a read of the invitation document. Reading
 * the document as invitee hits `email_verified == true` in the rules and
 * re-breaks exactly the users WI-1 fixed (WI-2 PC4).
 */
export const INVITE_CLAIM_SETTLED_EVENT = 'spert:invite-claim-settled';
export type InviteClaimSettledDetail =
  | { outcome: 'none'; email: string | null }
  | { outcome: 'error'; code: string };

/**
 * Mirrors `APP_NAMES_BY_APP_ID` in spert-landing-page
 * `functions/src/invitationMailer.tsx` — the names the invitation EMAIL uses,
 * so the banner and the email a student is holding agree. Keyed by the
 * `appId` the claim CF returns in `claimed[]`. `Partial` so an id the CF
 * onboards before this map learns it falls back to the raw id rather than
 * to `undefined` in copy.
 */
export const SPERT_APP_DISPLAY_NAMES: Readonly<Partial<Record<string, string>>> = {
  spertahp: 'SPERT AHP',
  spertcfd: 'SPERT CFD',
  ganttapp: 'GanttApp',
  spertforecaster: 'SPERT Forecaster',
  spertstorymap: 'SPERT Story Map',
  spertscheduler: 'SPERT Scheduler',
  myscrumbudget: 'MyScrumBudget',
};

export function spertAppDisplayName(appId: string): string {
  return SPERT_APP_DISPLAY_NAMES[appId] ?? appId;
}

export interface RevokeInviteResult { success: boolean; }
export interface ResendInviteResult { success: boolean; }

export type InviteResultChipKind = 'added' | 'invited' | 'failed' | 'invalid-format';
export interface InviteResultChip {
  kind: InviteResultChipKind;
  email: string;
  reason?: string;
}

export interface ParsedEmailResult { valid: string[]; invalid: string[]; }
