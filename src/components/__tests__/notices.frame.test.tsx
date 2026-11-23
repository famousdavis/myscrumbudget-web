// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The app-wide notices in the frame's notices slot (FRAME26, v0.45.0). Moved from `ShellTop.test.tsx`, which pinned the
 * same order (v0.44.7: the invitation, the terms notice, the local-storage caution) INSIDE `<main>`, under `TopBar`.
 * The frame puts them in `[data-sf="notices"]`, between the navigation row and `main`, each on the frame's
 * `.sf-notice` with its variant, and every "Got it" on `.sf-notice-dismiss` (contract §3 and §6). The other buttons in a
 * notice (the invitation's "×" and sign-in buttons) keep their own look.
 *
 * The two dismissible notices are the REAL components, driven by their real localStorage keys. The invitation banner
 * is real too; only its hook is stood in for, so each state can be shown.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';

const hook = vi.hoisted(() => ({
  state: 'pre_auth' as 'idle' | 'pre_auth' | 'claiming' | 'claimed' | 'claimed_elsewhere' | 'failed',
}));
vi.mock('@/hooks/useInvitationLanding', () => ({
  useInvitationLanding: () => ({
    state: hook.state, claimedNames: ['Apollo'], claimedElsewhereApps: ['SPERT® Story Map'], failureMessage: 'It failed.', dismiss: () => {},
  }),
}));
vi.mock('@/hooks/useSignInWithTosGate', () => ({
  useSignInWithTosGate: () => ({ handleSignIn: () => {}, showTosModal: false, handleTosAccepted: () => {}, handleTosCancel: () => {}, signInError: null }),
}));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: () => {}, replace: () => {} }) }));
vi.mock('next/link', () => ({
  default: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}));

import { Shell } from './shellTestHarness';

beforeEach(() => {
  localStorage.clear();
  hook.state = 'pre_auth';
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

async function renderShell() {
  const view = render(<Shell><div data-testid="page" /></Shell>);
  await screen.findByTestId('page'); // the page and the invitation render once migration has run
  const slot = view.container.querySelector<HTMLElement>('[data-sf="notices"]')!;
  return { slot, main: view.container.querySelector('main')! };
}

const terms = () => screen.getByText(/free to use/).closest<HTMLElement>('.sf-notice')!;
const caution = () => screen.getByText(/Your data exists only in this browser/).closest<HTMLElement>('.sf-notice')!;
const invitation = () => screen.getByRole('status');

describe('the notices slot', () => {
  it('holds the invitation, then the terms notice, then the caution, before main and outside it', async () => {
    const { slot, main } = await renderShell();
    expect(slot.className).toBe('sf-col sf-notices');
    expect([...slot.children]).toEqual([invitation(), terms(), caution()]);
    expect(main.contains(slot)).toBe(false);
    expect(slot.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main.contains(screen.getByTestId('page'))).toBe(true);
  });

  it("keeps each notice's own dismissal: terms for good, the caution for this page load", async () => {
    await renderShell();
    fireEvent.click(within(terms()).getByRole('button', { name: 'Got it' }));
    expect(localStorage.getItem('spert_firstRun_seen')).toBe('true');
    expect(screen.queryByText(/free to use/)).not.toBeInTheDocument();
    fireEvent.click(within(caution()).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(/Your data exists only in this browser/)).not.toBeInTheDocument();
    // The caution's "Got it" writes nothing: it comes back on the next load.
    expect(localStorage.getItem('msb:suppressLocalStorageWarning')).toBeNull();
  });

  it('is empty once every notice is gone, so the stylesheet hides it', async () => {
    hook.state = 'idle';
    localStorage.setItem('spert_firstRun_seen', 'true');
    localStorage.setItem('msb:suppressLocalStorageWarning', 'true');
    const { slot } = await renderShell();
    expect(slot.children).toHaveLength(0);
  });
});

describe('each notice on the frame', () => {
  it('terms: .sf-notice--info and nothing else on the box; its links carry no colour of their own', async () => {
    await renderShell();
    expect(terms().className).toBe('sf-notice sf-notice--info');
    for (const a of terms().querySelectorAll('a')) expect(a.getAttribute('class'), a.textContent ?? '').toBeNull();
  });

  it('caution: .sf-notice--caution and nothing else on the box', async () => {
    await renderShell();
    expect(caution().className).toBe('sf-notice sf-notice--caution');
  });

  it.each([
    ['pre_auth', 'sf-notice--info'],
    ['claiming', 'sf-notice--info'],
    ['claimed', 'sf-notice--success'],
    ['claimed_elsewhere', 'sf-notice--success'],
    ['failed', 'sf-notice--caution'],
  ] as const)('invitation, %s: %s, full width (no centring), relative for its "×"', async (state, variant) => {
    hook.state = state;
    await renderShell();
    expect(invitation().className).toBe(`sf-notice ${variant} relative`);
    // Its paragraphs take the notice's colour: no text colour of their own.
    for (const p of invitation().querySelectorAll('p')) {
      expect((p.getAttribute('class') ?? '').split(/\s+/).filter((c) => /(?:^|:)text-(?:zinc|amber|gray)-/.test(c))).toEqual([]);
    }
    cleanup();
  });

  it('.sf-notice-dismiss is on exactly the two "Got it", never on the invitation\'s "×" or its sign-in buttons', async () => {
    await renderShell();
    const dismiss = [...document.querySelectorAll('.sf-notice-dismiss')];
    expect(dismiss.map((b) => b.textContent)).toEqual(['Got it', 'Got it']);
    for (const name of [/Dismiss invitation/, /Sign in with Google/, /Sign in with Microsoft/]) {
      expect(screen.getByRole('button', { name }).classList.contains('sf-notice-dismiss')).toBe(false);
    }
    for (const b of dismiss) expect(b.getAttribute('type')).toBe('button');
  });
});
