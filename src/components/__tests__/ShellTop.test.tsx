// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The order at the top of every page (v0.44.7): the header row, then the
 * invitation banner, the terms notice and the local-storage caution, then the
 * page. Before this release the two notices rendered ABOVE `TopBar`, and no
 * test rendered the layout at all, so nothing pinned any of this.
 *
 * `TopBar` and `InvitationBanner` need the auth providers, so they are stood in
 * for by markers. The two notices are the REAL components, driven by their real
 * localStorage keys, so a test that finds them also shows they still appear.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/TopBar', () => ({ TopBar: () => <div data-testid="topbar" /> }));
vi.mock('@/components/InvitationBanner', () => ({
  InvitationBanner: () => <div data-testid="invitation" />,
}));

import { ShellTop } from '../ShellTop';

beforeEach(() => {
  localStorage.clear();
});

function order(container: HTMLElement, page: HTMLElement): string[] {
  const marks = [
    ['topbar', screen.getByTestId('topbar')],
    ['invitation', screen.getByTestId('invitation')],
    ['terms', screen.getByText(/free to use/).closest('div')],
    ['caution', screen.getByText(/Your data exists only in this browser/).closest('div')],
    ['page', page],
  ] as const;
  for (const [name, el] of marks) {
    expect(el, `${name} is rendered`).not.toBeNull();
    expect(container.contains(el), `${name} is inside the shell`).toBe(true);
  }
  return [...marks]
    .sort(([, a], [, b]) =>
      a!.compareDocumentPosition(b!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    )
    .map(([name]) => name);
}

describe('ShellTop', () => {
  it('renders the header row, then the invitation banner, the terms notice, the caution, then the page', () => {
    const { container } = render(
      <ShellTop>
        <div data-testid="page" />
      </ShellTop>,
    );
    expect(order(container, screen.getByTestId('page'))).toEqual([
      'topbar',
      'invitation',
      'terms',
      'caution',
      'page',
    ]);
  });

  it('keeps each notice’s own dismissal: terms for good, the caution for this page load', () => {
    render(
      <ShellTop>
        <div data-testid="page" />
      </ShellTop>,
    );
    const [termsGotIt, cautionGotIt] = screen.getAllByRole('button', { name: /Got it/i });

    fireEvent.click(termsGotIt);
    expect(localStorage.getItem('spert_firstRun_seen')).toBe('true');
    expect(screen.queryByText(/free to use/)).not.toBeInTheDocument();

    fireEvent.click(cautionGotIt);
    expect(screen.queryByText(/Your data exists only in this browser/)).not.toBeInTheDocument();
    // The caution's "Got it" writes nothing: it comes back on the next load.
    expect(localStorage.getItem('msb:suppressLocalStorageWarning')).toBeNull();
    expect(screen.getByTestId('page')).toBeInTheDocument();
  });
});
