// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import {
  collection, query, where, getDocs, runTransaction, doc, deleteField,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/config';
import { PROJECTS_COL, SUITE_INVITATIONS_COL } from '@/lib/firebase/collections';
import { sanitizeFirebaseError } from '@/lib/firebase/errors';
import type {
  PendingInvite,
  SendInvitationEmailInput,
  SendInvitationEmailResult,
  RevokeInviteResult,
  ResendInviteResult,
} from '@/lib/firebase/invitation-types';

/**
 * Lists pending invitations the caller has sent for a given project.
 *
 * Uses the (inviterUid, modelId) composite index — NOT (appId, modelId).
 * No appId+modelId index exists; querying that way silently returns empty
 * results (Lesson 52).
 *
 * Filters to status === 'pending' client-side (revoked/accepted/expired
 * invites are silently dropped). expireInvitations CF transitions stale
 * pending → expired daily at 03:00 UTC.
 */
export async function listPendingInvites(
  projectId: string,
  callerUid: string,
): Promise<PendingInvite[]> {
  if (!db) return [];
  const q = query(
    collection(db, SUITE_INVITATIONS_COL),
    where('inviterUid', '==', callerUid),
    where('modelId', '==', projectId),
  );
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ tokenId: d.id, ...d.data() } as PendingInvite));
  const filtered = all.filter(inv => inv.status === 'pending');
  if (all.length !== filtered.length) {
    console.debug(
      `[invitations] listPendingInvites: filtered out ${all.length - filtered.length} non-pending invite(s)`,
    );
  }
  return filtered;
}

/**
 * Removes a collaborator from a project. Three guards (Lesson 50):
 *   Guard 1: self-removal pre-check (before transaction)
 *   Guard 2: caller-must-be-owner (defense-in-depth, in transaction)
 *   Guard 3: target-must-not-be-owner (in transaction)
 *
 * runTransaction is currently unused elsewhere in MSB — first use.
 */
export async function removeCollaborator(
  projectId: string,
  targetUid: string,
  callerUid: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!db) return { ok: false, reason: 'Cloud storage is not available.' };
  // Guard 1
  if (targetUid === callerUid) {
    return { ok: false, reason: 'Cannot remove yourself from a project.' };
  }
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db!, PROJECTS_COL, projectId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Project not found.');
      const data = snap.data();
      // Guard 2 — defense-in-depth; UI is owner-gated, so this should never fire
      if (data.owner !== callerUid) {
        console.warn('[invitations] non-owner attempted remove — UI gating bypass?');
        throw new Error('Only the project owner can remove members.');
      }
      // Guard 3
      if (data.owner === targetUid) throw new Error('Cannot remove the project owner.');
      tx.update(ref, { [`members.${targetUid}`]: deleteField() });
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

function requireFunctions() {
  if (!functions) throw new Error('Firebase Functions not initialized.');
  return functions;
}

// async wrappers — synchronous requireFunctions() throw becomes a rejected
// Promise, matching the documented contract that callers see rejections
// (not synchronous throws) when Firebase Functions is unavailable.
export async function callSendInvitationEmail(
  input: SendInvitationEmailInput,
): Promise<SendInvitationEmailResult> {
  const r = await httpsCallable<SendInvitationEmailInput, SendInvitationEmailResult>(
    requireFunctions(), 'sendInvitationEmail',
  )(input);
  return r.data;
}

export async function callRevokeInvite(tokenId: string): Promise<RevokeInviteResult> {
  const r = await httpsCallable<{ tokenId: string }, RevokeInviteResult>(
    requireFunctions(), 'revokeInvite',
  )({ tokenId });
  return r.data;
}

export async function callResendInvite(tokenId: string): Promise<ResendInviteResult> {
  const r = await httpsCallable<{ tokenId: string }, ResendInviteResult>(
    requireFunctions(), 'resendInvite',
  )({ tokenId });
  return r.data;
}

/**
 * Maps a CF error to a user-friendly message.
 *
 * Context discriminator: the same error code (e.g., 'functions/failed-precondition')
 * means different things per call site (Lesson 13). Tests assert the same
 * code produces different messages across contexts.
 */
export function mapInvitationError(err: unknown, context: 'send' | 'resend' | 'revoke'): string {
  const code = (err as { code?: string }).code ?? '';
  if (context === 'send') {
    if (code === 'functions/resource-exhausted')
      return "You've reached today's invitation limit (25/day). Try again tomorrow.";
    if (code === 'functions/permission-denied')
      return 'Only the project owner can send invitations.';
    if (code === 'functions/failed-precondition')
      return 'You must be signed in with a verified email address to send invitations.';
  }
  if (context === 'resend') {
    if (code === 'functions/failed-precondition')
      return 'This invitation has already been re-sent the maximum number of times (5).';
    if (code === 'functions/permission-denied')
      return 'Only the original sender can re-send this invitation.';
    if (code === 'functions/not-found')
      return 'This invitation no longer exists.';
  }
  if (context === 'revoke') {
    if (code === 'functions/permission-denied')
      return 'Only the original sender can revoke this invitation.';
    if (code === 'functions/not-found')
      return 'This invitation no longer exists.';
  }
  return sanitizeFirebaseError(err);
}
