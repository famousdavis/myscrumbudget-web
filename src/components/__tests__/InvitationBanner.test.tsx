// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Pins that the two v0.38.1 outcomes REACH THE DOM as the copy the hook
 * produced. The hook is mocked: its state machine is characterised in
 * `src/hooks/__tests__/useInvitationLanding.hook.test.tsx`; this file only
 * proves the banner renders what it is handed, so a state the banner forgot
 * to branch on cannot pass as "nothing rendered".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

type HookResult = {
  state: 'idle' | 'pre_auth' | 'claiming' | 'claimed' | 'claimed_elsewhere' | 'failed';
  claimedNames: string[];
  claimedElsewhereApps: string[];
  failureMessage: string | null;
  dismiss: () => void;
};

const hook = vi.hoisted(() => ({
  result: {
    state: 'idle',
    claimedNames: [],
    claimedElsewhereApps: [],
    failureMessage: null,
    dismiss: () => {},
  } as HookResult,
}));

vi.mock('@/hooks/useInvitationLanding', () => ({
  useInvitationLanding: () => hook.result,
}));
vi.mock('@/hooks/useSignInWithTosGate', () => ({
  useSignInWithTosGate: () => ({
    handleSignIn: () => {},
    showTosModal: false,
    handleTosAccepted: () => {},
    handleTosCancel: () => {},
    signInError: null,
  }),
}));

import { InvitationBanner } from '../InvitationBanner';

beforeEach(() => {
  hook.result = {
    state: 'idle',
    claimedNames: [],
    claimedElsewhereApps: [],
    failureMessage: null,
    dismiss: () => {},
  };
});

describe('InvitationBanner — v0.38.1 outcomes reach the DOM', () => {
  it('renders nothing in idle', () => {
    const { container } = render(<InvitationBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('claimed_elsewhere names the ONE app the claim landed in, and where to go', () => {
    hook.result = { ...hook.result, state: 'claimed_elsewhere', claimedElsewhereApps: ['SPERT Story Map'] };
    render(<InvitationBanner />);
    expect(screen.getByText(
      'Your invitation was accepted in SPERT Story Map, not in MyScrumBudget. Open SPERT Story Map to see the project.',
    )).toBeInTheDocument();
  });

  it('claimed_elsewhere lists TWO apps with "and" and pluralises', () => {
    hook.result = {
      ...hook.result,
      state: 'claimed_elsewhere',
      claimedElsewhereApps: ['SPERT Story Map', 'SPERT Scheduler'],
    };
    render(<InvitationBanner />);
    expect(screen.getByText(
      'Your invitation was accepted in SPERT Story Map and SPERT Scheduler, not in MyScrumBudget. Open those apps to see the projects.',
    )).toBeInTheDocument();
  });

  it('failed renders exactly the copy the hook produced', () => {
    const msg = 'No pending invitation was found for student@ufl.edu. Check that this is the address the invitation was sent to, or ask the project owner to send a new one.';
    hook.result = { ...hook.result, state: 'failed', failureMessage: msg };
    render(<InvitationBanner />);
    // Rendered TWICE by design: the visible paragraph and the sr-only
    // aria-live region announce the same copy. Pin both, and which is which.
    const nodes = screen.getAllByText(msg);
    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.tagName).sort()).toEqual(['P', 'SPAN']);
    expect(nodes.find(n => n.tagName === 'SPAN')).toHaveAttribute('aria-live', 'polite');
    // The pre-v0.38.1 single copy must be gone from this state.
    expect(screen.queryByText(/didn.t match your account/)).toBeNull();
  });
});
