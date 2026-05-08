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

export interface RevokeInviteResult { success: boolean; }
export interface ResendInviteResult { success: boolean; }

export type InviteResultChipKind = 'added' | 'invited' | 'failed' | 'invalid-format';
export interface InviteResultChip {
  kind: InviteResultChipKind;
  email: string;
  reason?: string;
}

export interface ParsedEmailResult { valid: string[]; invalid: string[]; }
