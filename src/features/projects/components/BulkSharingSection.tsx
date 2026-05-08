// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useId, useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { ConfirmDialog } from '@/components/BaseDialog';
import { useToast } from '@/components/Toast';
import { getStorageMode } from '@/lib/storage/storageMode';
import {
  getProjectMembers,
  type ProjectMember,
} from '@/lib/firebase/sharing';
import {
  listPendingInvites,
  removeCollaborator,
  callSendInvitationEmail,
  callRevokeInvite,
  callResendInvite,
  mapInvitationError,
} from '@/lib/firebase/invitations';
import { sanitizeFirebaseError } from '@/lib/firebase/errors';
import { parseBulkEmails } from '@/lib/utils/parseBulkEmails';
import type {
  PendingInvite,
  InviteResultChip,
  SendInvitationEmailResult,
} from '@/lib/firebase/invitation-types';

type OwnerStatus = 'loading' | 'owner' | 'not-owner' | 'error';

interface BulkSharingSectionProps {
  projectId: string;
}

export function BulkSharingSection({ projectId }: BulkSharingSectionProps) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const baseId = useId();
  const emailsId = `${baseId}-emails`;
  const roleId = `${baseId}-role`;
  const roleHelpId = `${baseId}-role-help`;

  const isCloud = getStorageMode() === 'cloud';
  // Lazy initial state: skip the loading flicker for local-mode users (matches
  // SharingSection's gating). Cloud users start in 'loading' until the initial
  // fetch resolves.
  const [ownerStatus, setOwnerStatus] = useState<OwnerStatus>(
    () => (isCloud ? 'loading' : 'not-owner'),
  );
  const [members, setMembers] = useState<ProjectMember[] | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[] | null>(null);
  const [bulkEmails, setBulkEmails] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [inviteResult, setInviteResult] = useState<InviteResultChip[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // resendError and resendMsg are SHARED across all pending-invite rows
  // (not per-tokenId). Rendered in a single region above the pending list.
  // Refactor to Record<tokenId, string> if per-row precision becomes a UX
  // requirement later.
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<ProjectMember | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<PendingInvite | null>(null);

  // Initial fetch on mount.
  useEffect(() => {
    if (!isCloud || !user?.uid) return;  // ownerStatus already 'not-owner' from initial state
    void Promise.allSettled([
      getProjectMembers(projectId),
      listPendingInvites(projectId, user.uid),
    ]).then(([memRes, pendRes]) => {
      if (memRes.status === 'fulfilled') {
        const mems = memRes.value ?? [];
        setMembers(mems);
        const isOwner = mems.some(m => m.uid === user.uid && m.role === 'owner');
        setOwnerStatus(isOwner ? 'owner' : 'not-owner');
      } else {
        // Transient network errors surface a visible message instead of
        // silently hiding the section.
        console.warn('[BulkSharingSection] initial getProjectMembers failed:', memRes.reason);
        setOwnerStatus('error');
      }
      if (pendRes.status === 'fulfilled') {
        setPendingInvites(pendRes.value ?? []);
      } else {
        console.warn('[BulkSharingSection] initial listPendingInvites failed:', pendRes.reason);
        setPendingInvites([]);
      }
    });
  }, [projectId, user?.uid, isCloud]);

  if (ownerStatus === 'loading') return null;
  if (ownerStatus === 'not-owner') return null;
  if (ownerStatus === 'error') {
    return (
      <CollapsibleSection title="Sharing">
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn&rsquo;t load sharing details. Refresh the page to try again.
        </p>
      </CollapsibleSection>
    );
  }
  // ownerStatus === 'owner'

  const refreshAll = async () => {
    if (!user?.uid) return;
    const [memRes, pendRes] = await Promise.allSettled([
      getProjectMembers(projectId),
      listPendingInvites(projectId, user.uid),
    ]);
    if (memRes.status === 'fulfilled') setMembers(memRes.value ?? []);
    else console.warn('[BulkSharingSection] member refresh failed:', memRes.reason);
    if (pendRes.status === 'fulfilled') setPendingInvites(pendRes.value ?? []);
    else console.warn('[BulkSharingSection] pending refresh failed:', pendRes.reason);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError(null);
    if (sending) return;
    const { valid, invalid } = parseBulkEmails(bulkEmails);

    if (valid.length === 0) {
      // Do NOT call CF; do NOT clear textarea (Lesson 42)
      setInviteResult(invalid.map(em => ({ kind: 'invalid-format' as const, email: em })));
      return;
    }

    setSending(true);
    let result: SendInvitationEmailResult;
    try {
      result = await callSendInvitationEmail({
        appId: 'myscrumbudget', // string literal — NOT APP_ID constant (Lesson 15)
        modelId: projectId,
        emails: valid,
        role,
        isVoting: false,
      });
    } catch (err) {
      setSendError(mapInvitationError(err, 'send'));
      setSending(false);
      return;
    }

    // "Successful" = at least one email went through (added or invited).
    // If all failed at CF level, retain textarea so user can retry (Lesson 43).
    const sent = result.added.length > 0 || result.invited.length > 0;
    if (sent) setBulkEmails('');

    setInviteResult([
      ...result.added.map(em   => ({ kind: 'added'          as const, email: em })),
      ...result.invited.map(em  => ({ kind: 'invited'        as const, email: em })),
      ...result.failed.map(f    => ({ kind: 'failed'         as const, email: f.email, reason: f.reason })),
      ...invalid.map(em         => ({ kind: 'invalid-format' as const, email: em })),
    ]);

    await refreshAll();
    setSending(false);
  };

  const handleResend = async (tokenId: string, callerUid: string) => {
    setResendError(null);
    setResendMsg(null);
    try {
      await callResendInvite(tokenId);
      setResendMsg('Invitation re-sent.');
      setTimeout(() => setResendMsg(null), 3_000);
      // Refresh pending list only — member list unchanged by resend
      const fresh = await listPendingInvites(projectId, callerUid);
      setPendingInvites(fresh ?? []);
    } catch (err) {
      setResendError(mapInvitationError(err, 'resend'));
    }
  };

  const handleConfirmRemove = async (member: ProjectMember) => {
    setConfirmRemove(null);
    if (!user?.uid) return;
    const result = await removeCollaborator(projectId, member.uid, user.uid);
    if (result.ok) {
      addToast(`${member.displayName || member.email || member.uid} removed.`, 'success');
      await refreshAll();
    } else {
      addToast(result.reason ?? 'Failed to remove member.', 'error');
    }
  };

  const handleConfirmRevoke = async (invite: PendingInvite) => {
    setConfirmRevoke(null);
    try {
      await callRevokeInvite(invite.tokenId);
      if (user?.uid) {
        const fresh = await listPendingInvites(projectId, user.uid);
        setPendingInvites(fresh ?? []);
      }
      addToast(`Invitation to ${invite.inviteeEmail} revoked.`, 'success');
    } catch (err) {
      addToast(mapInvitationError(err, 'revoke'), 'error');
    }
  };

  // Sort members so owner is first, then editors, then viewers.
  const sortedMembers = (members ?? []).slice().sort((a, b) => {
    const order = { owner: 0, editor: 1, viewer: 2 };
    return order[a.role] - order[b.role];
  });
  // Section count: non-owner members + pending invitations
  const sectionCount =
    (members ? members.filter(m => m.role !== 'owner').length : 0) +
    (pendingInvites ? pendingInvites.length : 0);

  return (
    <CollapsibleSection title="Sharing" count={sectionCount > 0 ? sectionCount : undefined}>
      <div className="space-y-5 max-w-3xl">
        {/* ─── Members list ─────────────────────────────────────── */}
        <section>
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Collaborators
          </h3>
          {members === null ? (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Loading collaborators…</p>
          ) : (
            <div className="mt-2 space-y-2">
              {sortedMembers.map(m => (
                <div
                  key={m.uid}
                  className="flex items-center justify-between rounded bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800"
                >
                  <div>
                    <span className="font-medium">{m.displayName || m.email || m.uid}</span>
                    {m.email && m.displayName && (
                      <span className="ml-2 text-zinc-500 dark:text-zinc-400">({m.email})</span>
                    )}
                    <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs dark:bg-zinc-700">
                      {m.role}
                    </span>
                  </div>
                  {m.role !== 'owner' && (
                    <button
                      onClick={() => setConfirmRemove(m)}
                      className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Pending invitations ──────────────────────────────── */}
        <section>
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Pending invitations
          </h3>
          {/* Shared resend status region — rendered ONCE above the list */}
          {resendError && (
            <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{resendError}</p>
          )}
          {resendMsg && (
            <span role="status" aria-live="polite" className="mt-2 inline-block text-sm text-green-700 dark:text-green-400">
              {resendMsg}
            </span>
          )}
          {pendingInvites === null ? (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Loading pending invitations…</p>
          ) : pendingInvites.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No pending invitations.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {pendingInvites.map(inv => {
                const cap = 5;
                const atCap = inv.emailSendCount >= cap;
                return (
                  <div
                    key={inv.tokenId}
                    className="flex items-center justify-between rounded bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800"
                  >
                    <div>
                      <span className="font-medium">{inv.inviteeEmail}</span>
                      <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs dark:bg-zinc-700">
                        {inv.role}
                      </span>
                      <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                        ({inv.emailSendCount}/{cap})
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => user?.uid && handleResend(inv.tokenId, user.uid)}
                        disabled={atCap}
                        className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Resend
                      </button>
                      <button
                        onClick={() => setConfirmRevoke(inv)}
                        className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── Bulk invite form ─────────────────────────────────── */}
        <form onSubmit={handleSend} className="space-y-2">
          <div>
            <label htmlFor={emailsId} className="block text-xs text-zinc-500 dark:text-zinc-400">
              Invite collaborators
            </label>
            <textarea
              id={emailsId}
              name="bulkInviteEmails"
              autoComplete="off"
              placeholder="Enter email addresses separated by commas, spaces, or newlines"
              value={bulkEmails}
              onChange={(e) => {
                setBulkEmails(e.target.value);
                setInviteResult([]);
                setSendError(null);
              }}
              rows={3}
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label htmlFor={roleId} className="block text-xs text-zinc-500 dark:text-zinc-400">Role</label>
              <select
                id={roleId}
                name="bulkInviteRole"
                value={role}
                aria-describedby={roleHelpId}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                className="mt-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <p id={roleHelpId} className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Editors can modify projects. Viewers can only view.
              </p>
            </div>
            <button
              type="submit"
              disabled={sending || !bulkEmails.trim()}
              className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send invitations'}
            </button>
          </div>
          {sendError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{sendError}</p>
          )}
          {inviteResult.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {inviteResult.map((chip, i) => (
                <ResultChip key={`${chip.kind}-${chip.email}-${i}`} chip={chip} />
              ))}
            </div>
          )}
        </form>
      </div>

      {/* ─── Confirmation dialogs ──────────────────────────────── */}
      {confirmRemove && (
        <ConfirmDialog
          title="Remove collaborator?"
          message={`${confirmRemove.displayName || confirmRemove.email || 'this collaborator'} will lose access to this project immediately.`}
          confirmLabel="Remove"
          onConfirm={() => handleConfirmRemove(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
      {confirmRevoke && (
        <ConfirmDialog
          title="Revoke invitation?"
          message={`${confirmRevoke.inviteeEmail} will no longer be able to use this invitation link.`}
          confirmLabel="Revoke"
          onConfirm={() => handleConfirmRevoke(confirmRevoke)}
          onCancel={() => setConfirmRevoke(null)}
        />
      )}
    </CollapsibleSection>
  );

  // sanitizeFirebaseError unused here today (kept imported for parity with
  // SharingSection in case future code paths need it directly).
  void sanitizeFirebaseError;
}

function ResultChip({ chip }: { chip: InviteResultChip }) {
  const { kind, email, reason } = chip;
  const styles = {
    'added':         'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
    'invited':       'bg-blue-50  dark:bg-blue-900/20  border-blue-200  dark:border-blue-800  text-blue-700  dark:text-blue-300',
    'failed':        'bg-red-50   dark:bg-red-900/20   border-red-200   dark:border-red-800   text-red-700   dark:text-red-300',
    'invalid-format':'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
  }[kind];
  const label = {
    'added': 'Added',
    'invited': 'Invited',
    'failed': 'Failed',
    'invalid-format': 'Invalid',
  }[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${styles}`}
      title={reason}
    >
      <span className="font-medium">{label}:</span>
      <span>{email}</span>
    </span>
  );
}
