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
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

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
