// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Characterisation of the bulk-invite sharing section.
 *
 * Justified on the COMPONENT, not on its security guards: 441 lines, 0/135
 * statements, 0/102 branches, 0/31 functions, and the last file in the
 * never-loaded set that any planned item reaches. Like `firestoreRepo.ts` it is
 * invisible to BOTH installed instruments — zero coverage, and zero complexity
 * findings at max cc 11 against a threshold of 15. "Invisible to both" does not
 * mean trivial; it means sitting just under every bar.
 *
 * ⚠️ THE FALSE GREEN IS LIVE HERE, AND IT IS THE DEFAULT. Three of the four
 * render outcomes occur BEFORE the component's JSX:
 *
 *     ownerStatus 'loading'    -> return null
 *     ownerStatus 'not-owner'  -> return null      <- the LOCAL-MODE default
 *     ownerStatus 'error'      -> an error card
 *     ownerStatus 'owner'      -> the 186-line body
 *
 * `not-owner` is the lazy initial state whenever `getStorageMode()` is not
 * 'cloud', which is what a test renders into unless it says otherwise. So a
 * naive `render(<BulkSharingSection/>)` returns null, executes the gate and
 * nothing else, and PASSES — raising measured coverage while asserting nothing.
 * Same shape as the jsdom-canvas trap in v0.36.7.
 *
 * ⚠️ AND THERE IS A FIFTH OUTCOME THE LINE-225 FRAMING MISSES. Crossing the
 * ownership gate is still not enough: the body is wrapped in
 * `CollapsibleSection`, which defaults to CLOSED, so an owner initially gets a
 * collapsed header and nothing else. That is the more dangerous state of the
 * two, because the DOM is NOT empty — a test asserting "something rendered"
 * passes here while the 186-line body has never executed. Every body test below
 * expands the section first.
 *
 * ⚠️ INVERTED PRE-REGISTRATION: any coverage above ~15% without a passing
 * owner-state assertion means the gate was never crossed, and the numbers
 * describe the gate rather than the component.
 *
 * ⚠️ THE MOCK SET IS DERIVED FROM THE GATE, not from the double-mock idiom. The
 * gate is `getStorageMode() === 'cloud'` AND `useAuth().user.uid` AND
 * `getProjectMembers` resolving with this user as owner. None of those is
 * Firestore; the Firebase config mock is necessary (the invitations module
 * imports it) but nowhere near sufficient.
 *
 * ⚠️ SERVER-SIDE BEHAVIOUR IS OUT OF REACH AND NOTHING HERE CLAIMS IT. The M2
 * role guard and the L10 resend cap both carry comments asserting a Cloud
 * Function and Firestore rules enforce them; those live in another repository.
 * This is the third boundary of that kind in this campaign (M2, the invite send
 * path, and the rules named out of scope). These tests pin what the CLIENT does.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';

/** Expand the CollapsibleSection wrapper — the body does not exist until then. */
async function expandSharing() {
  const toggle = await screen.findByRole('button', { name: /Sharing/ });
  await act(async () => { fireEvent.click(toggle); });
}
import type { ProjectMember } from '@/lib/firebase/sharing';
import type { PendingInvite } from '@/lib/firebase/invitation-types';

const OWNER_UID = 'uid_owner';

let storageMode: 'local' | 'cloud' = 'cloud';
let currentUser: { uid: string } | null = { uid: OWNER_UID };
let membersResult: (() => Promise<ProjectMember[]>) = async () => [
  { uid: OWNER_UID, role: 'owner', email: 'owner@example.com', displayName: 'Owner One' },
];
let pendingResult: (() => Promise<PendingInvite[]>) = async () => [];

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {}, functions: {}, app: null, isFirebaseAvailable: false }));
vi.mock('@/lib/storage/storageMode', () => ({ getStorageMode: () => storageMode }));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('@/lib/firebase/sharing', () => ({ getProjectMembers: () => membersResult() }));

const toasts: { message: string; variant: string }[] = [];
vi.mock('@/components/Toast', () => ({
  useToast: () => ({ addToast: (message: string, variant: string) => { toasts.push({ message, variant }); } }),
}));

const sendSpy = vi.fn();
vi.mock('@/lib/firebase/invitations', () => ({
  listPendingInvites: () => pendingResult(),
  removeCollaborator: async () => ({ ok: true }),
  callSendInvitationEmail: (args: unknown) => sendSpy(args),
  callRevokeInvite: async () => {},
  callResendInvite: async () => {},
  mapInvitationError: (err: unknown, op: string) => `mapped:${op}`,
}));

const { BulkSharingSection } = await import('../BulkSharingSection');

function owner(over: Partial<ProjectMember> = {}): ProjectMember {
  return { uid: OWNER_UID, role: 'owner', email: 'owner@example.com', displayName: 'Owner One', ...over };
}

beforeEach(() => {
  storageMode = 'cloud';
  currentUser = { uid: OWNER_UID };
  membersResult = async () => [owner()];
  pendingResult = async () => [];
  toasts.length = 0;
  sendSpy.mockReset();
  sendSpy.mockResolvedValue({ added: [], invited: [], failed: [] });
});

describe('the render gate — read this before any coverage number', () => {
  it('renders NOTHING in local mode (the default a naive test lands in)', () => {
    storageMode = 'local';
    const { container } = render(<BulkSharingSection projectId="p1" />);
    // If this ever renders markup, the gate has moved and every assertion
    // below is testing something other than what it claims.
    expect(container).toBeEmptyDOMElement();
  });

  it('renders NOTHING for a signed-in user who is not the owner', async () => {
    membersResult = async () => [owner({ uid: 'someone_else' })];
    const { container } = render(<BulkSharingSection projectId="p1" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders an error card when the member fetch REJECTS', async () => {
    membersResult = async () => { throw new Error('network'); };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<BulkSharingSection projectId="p1" />);
    // The error card is also inside the collapsible, so expand to see it.
    await expandSharing();
    expect(await screen.findByText(/Couldn’t load sharing details/)).toBeInTheDocument();
    warn.mockRestore();
  });

  it('renders a COLLAPSED header for an owner — the fifth outcome', async () => {
    // Non-empty DOM, body never executed. A test asserting "something rendered"
    // is satisfied here and has exercised almost none of the component.
    render(<BulkSharingSection projectId="p1" />);
    expect(await screen.findByRole('button', { name: /Sharing/ })).toBeInTheDocument();
    expect(screen.queryByText('Collaborators')).not.toBeInTheDocument();
  });

  it('CROSSES THE GATE for an owner and renders the real body', async () => {
    // The load-bearing test. Everything below assumes this passes; if it does
    // not, coverage measured here belongs to the gate, not the component.
    render(<BulkSharingSection projectId="p1" />);
    await expandSharing();

    // Specific markup from past line 225 — not merely "something rendered".
    expect(await screen.findByText('Collaborators')).toBeInTheDocument();
    expect(screen.getByText('Pending invitations')).toBeInTheDocument();
    expect(screen.getByLabelText('Invite collaborators')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send invitations' })).toBeInTheDocument();
    // And the owner's own row, proving the fetched data reached the DOM.
    expect(screen.getByText('Owner One')).toBeInTheDocument();
  });
});

/**
 * ⚠️ RENDER-STATE ENUMERATION, done mechanically rather than by inspection after
 * a failing test exposed one the charter's "four outcomes" framing missed.
 *
 *   4 render return paths:  loading -> null · not-owner -> null · error card · body
 *   2 of the 4 are wrapped in CollapsibleSection (error card, body)
 *   => 6 OBSERVABLE RENDER STATES, because each collapsible has a collapsed and
 *      an expanded state.
 *
 * The collapsed states are the dangerous ones: the DOM is NOT empty, so a test
 * asserting "something rendered" passes while the body has never executed. Both
 * are pinned above; the error card's collapsed state is the sixth, and it was
 * initially missed even though a test had already had to expand past it.
 */

describe('the invite flow', () => {
  async function typeAndSend(text: string) {
    fireEvent.change(screen.getByLabelText('Invite collaborators'), { target: { value: text } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send invitations' }));
    });
  }

  it('an over-cap address alone renders the amber Invalid chip and RETAINS the textarea', async () => {
    // Closes a gap left by v0.36.11: that release's changelog promises this
    // behaviour to users and nothing tested it. parseBulkEmails was unit-tested;
    // the chip rendering lives here, in a file that was at 0/135.
    const over = `${'a'.repeat(400)}@example.com`;
    render(<BulkSharingSection projectId="p1" />);
    await expandSharing();
    await typeAndSend(over);

    // The textarea legitimately contains the same text, so the chip assertion
    // is scoped to the chip rather than to the document.
    const chip = screen.getByText('Invalid:').parentElement!;
    expect(chip).toHaveTextContent(over);
    // Retained, so the user can correct it (Lesson 42).
    expect(screen.getByLabelText('Invite collaborators')).toHaveValue(over);
    // And the Cloud Function is never called — nothing valid to send.
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('an over-cap address ALONGSIDE a valid one clears the box — the qualification v0.36.11 omitted', async () => {
    // ⚠️ v0.36.11's changelog says the box "keeps its contents" without
    // qualification. That holds only when NOTHING valid was pasted. Here the
    // send succeeds, the textarea is cleared, and the over-cap address survives
    // only as a chip — its text is gone from the box. Pinned as the behaviour
    // actually is, rather than as the changelog described it.
    const over = `${'b'.repeat(400)}@example.com`;
    sendSpy.mockResolvedValue({ added: ['good@example.com'], invited: [], failed: [] });

    render(<BulkSharingSection projectId="p1" />);
    await expandSharing();
    await typeAndSend(`good@example.com, ${over}`);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][0].emails).toEqual(['good@example.com']);
    expect(screen.getByLabelText('Invite collaborators')).toHaveValue('');
    // The chip remains even though the address text does not.
    expect(screen.getByText('Invalid:')).toBeInTheDocument();
    expect(screen.getByText('Added:')).toBeInTheDocument();
  });

  it('retains the textarea when every address fails at the server (Lesson 43)', async () => {
    sendSpy.mockResolvedValue({ added: [], invited: [], failed: [{ email: 'a@b.com', reason: 'rate limit' }] });
    render(<BulkSharingSection projectId="p1" />);
    await expandSharing();
    await typeAndSend('a@b.com');

    expect(screen.getByText('Failed:')).toBeInTheDocument();
    expect(screen.getByLabelText('Invite collaborators')).toHaveValue('a@b.com');
  });

  it('surfaces a mapped error when the send call rejects', async () => {
    sendSpy.mockRejectedValue(new Error('boom'));
    render(<BulkSharingSection projectId="p1" />);
    await expandSharing();
    await typeAndSend('a@b.com');

    expect(await screen.findByRole('alert')).toHaveTextContent('mapped:send');
    // Not stuck in the sending state after a rejection.
    expect(screen.getByRole('button', { name: 'Send invitations' })).toBeEnabled();
  });

  it('forwards the selected role, and forwards editor by default (M2, CLIENT side only)', async () => {
    // ⚠️ This pins what the CLIENT sends. The M2 guard collapses any
    // unrecognised role to 'editor' as defence-in-depth against a tampered
    // bundle — that path is NOT reachable through the DOM, because the select
    // offers only editor and viewer, which is precisely why the guard is
    // described as redundant by design. The Cloud Function's own validation is
    // asserted in a comment at the site and lives in another repository; nothing
    // here claims anything about it.
    render(<BulkSharingSection projectId="p1" />);
    await expandSharing();
    await typeAndSend('a@b.com');
    expect(sendSpy.mock.calls[0][0].role).toBe('editor');

    sendSpy.mockClear();
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'viewer' } });
    await typeAndSend('c@d.com');
    expect(sendSpy.mock.calls[0][0].role).toBe('viewer');
  });
});

describe('collaborators, pending invitations and their dialogs', () => {
  const invite = (over: Partial<PendingInvite> = {}): PendingInvite => ({
    tokenId: 't1', inviteeEmail: 'pending@example.com', role: 'editor', emailSendCount: 1, ...over,
  } as PendingInvite);

  it('lists non-owner members with a Remove control and none for the owner', async () => {
    membersResult = async () => [owner(), owner({ uid: 'u2', role: 'editor', displayName: 'Edith' })];
    render(<BulkSharingSection projectId="p1" />);
    await expandSharing();

    expect(await screen.findByText('Edith')).toBeInTheDocument();
    // Exactly one Remove button — the owner's row has none.
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
  });

  it('removing a collaborator confirms first, then toasts on success', async () => {
    membersResult = async () => [owner(), owner({ uid: 'u2', role: 'editor', displayName: 'Edith' })];
    render(<BulkSharingSection projectId="p1" />);
    await expandSharing();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    expect(screen.getByText('Remove collaborator?')).toBeInTheDocument();
    // Scoped to the dialog: the member row carries a Remove button too.
    const removeDialog = screen.getByRole('dialog');
    await act(async () => { fireEvent.click(within(removeDialog).getByRole('button', { name: 'Remove' })); });
    await waitFor(() => expect(toasts.some(t => t.message.includes('Edith'))).toBe(true));
  });

  it('disables Resend at the 5-send cap and leaves it enabled below (L10, UX only)', async () => {
    // ⚠️ The cap is enforced server-side; the disabled attribute is UX. This
    // asserts the UI reflects the count, NOT that the cap is enforced — that
    // enforcement lives in a Cloud Function this repo cannot reach.
    pendingResult = async () => [invite({ tokenId: 'below', emailSendCount: 4 }), invite({ tokenId: 'atcap', inviteeEmail: 'capped@example.com', emailSendCount: 5 })];
    render(<BulkSharingSection projectId="p1" />);
    await expandSharing();

    await screen.findByText('capped@example.com');
    const resends = screen.getAllByRole('button', { name: 'Resend' });
    expect(resends[0]).toBeEnabled();   // 4/5
    expect(resends[1]).toBeDisabled();  // 5/5
    expect(screen.getByText('(4/5)')).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no pending invitations', async () => {
    render(<BulkSharingSection projectId="p1" />);
    await expandSharing();
    expect(await screen.findByText('No pending invitations.')).toBeInTheDocument();
  });

  it('resending reports success in the shared status region', async () => {
    pendingResult = async () => [invite()];
    render(<BulkSharingSection projectId="p1" />);
    await expandSharing();
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Resend' })); });

    expect(await screen.findByRole('status')).toHaveTextContent('Invitation re-sent.');
  });

  it('revoking confirms first, then toasts', async () => {
    pendingResult = async () => [invite()];
    render(<BulkSharingSection projectId="p1" />);
    await expandSharing();
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }));

    expect(screen.getByText('Revoke invitation?')).toBeInTheDocument();
    const revokeDialog = screen.getByRole('dialog');
    await act(async () => { fireEvent.click(within(revokeDialog).getByRole('button', { name: 'Revoke' })); });
    await waitFor(() => expect(toasts.some(t => t.message.includes('pending@example.com'))).toBe(true));
  });

  it('counts non-owner members plus pending invites in the section badge', async () => {
    membersResult = async () => [owner(), owner({ uid: 'u2', role: 'editor' })];
    pendingResult = async () => [invite(), invite({ tokenId: 't2' })];
    render(<BulkSharingSection projectId="p1" />);
    // 1 non-owner member + 2 pending = 3, and the owner is excluded.
    expect(await screen.findByText('3')).toBeInTheDocument();
  });
});
