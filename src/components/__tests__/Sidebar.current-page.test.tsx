// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The sidebar marks the current page (FRAME26 stage 0, MSB-4). Before this, no
 * item carried `aria-current` and all five looked the same on every route.
 *
 * The rule: exactly one item on every screen an item leads to, and none
 * elsewhere (/changelog). Every /projects/... route belongs to the collection,
 * "Dashboard". Help Center leaves the app and is never marked.
 *
 * The visible cue is not colour alone (WCAG 1.4.1): a 2 px accent bar inside the
 * item's left edge, plus the accent text colour, at the same weight. jsdom
 * applies no CSS, so the class tokens are pinned, compared as WHOLE tokens; the
 * bar measured 4.36 : 1 on #fafafa and 4.37 : 1 on #09090b in Chrome.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';

let mockPath: string | null = '/';
vi.mock('next/navigation', () => ({ usePathname: () => mockPath }));

import { Sidebar } from '../Sidebar';

const CASES: [string, string | null][] = [
  ['/', 'Dashboard'],
  ['/projects/new', 'Dashboard'],
  ['/projects/p-42', 'Dashboard'],
  ['/projects/p-42/edit', 'Dashboard'],
  ['/team', 'Team Pool'],
  ['/settings', 'Settings'],
  ['/about', 'About'],
  ['/changelog', null],
];

const CUE = ['shadow-[inset_2px_0_0_#0070f3]', 'text-[#155dfc]', 'dark:text-[#51a2ff]'];

function items() {
  const nav = screen.getByRole('navigation');
  const list = nav.querySelector('ul');
  if (!list) throw new Error('the sidebar link list was not rendered');
  return [...list.querySelectorAll<HTMLAnchorElement>(':scope > li > a')];
}
const label = (a: HTMLElement) => (a.firstChild?.textContent ?? '').trim();
const tokens = (a: HTMLElement) => a.className.split(/\s+/);

describe('Sidebar: the current page', () => {
  it.each(CASES)('on %s marks %s', (path, expected) => {
    mockPath = path;
    render(<Sidebar />);
    const all = items();
    expect(all, 'the list should hold five items').toHaveLength(5);
    const current = all.filter((a) => a.getAttribute('aria-current') === 'page');
    if (expected === null) {
      expect(current, `nothing should be marked on ${path}`).toHaveLength(0);
    } else {
      expect(current, `exactly one item should be marked on ${path}`).toHaveLength(1);
      expect(label(current[0])).toBe(expected);
    }
    for (const a of all) {
      const isCur = a.getAttribute('aria-current') === 'page';
      for (const t of CUE) {
        if (isCur) expect(tokens(a), `${label(a)} is current but lacks ${t}`).toContain(t);
        else expect(tokens(a), `${label(a)} is not current but carries ${t}`).not.toContain(t);
      }
      // Same weight either way, so nothing moves when the page changes.
      expect(tokens(a)).toContain('font-medium');
    }
    cleanup();
  });

  it('never marks Help Center, even on a path that starts like it', () => {
    mockPath = '/help';
    render(<Sidebar />);
    const help = within(screen.getByRole('navigation')).getByRole('link', { name: /Help Center/ });
    expect(help.getAttribute('aria-current')).toBeNull();
    expect(items().filter((a) => a.getAttribute('aria-current'))).toHaveLength(0);
  });

  it('a route that only shares a prefix is not current (/teams is not /team)', () => {
    mockPath = '/teams';
    render(<Sidebar />);
    expect(items().filter((a) => a.getAttribute('aria-current'))).toHaveLength(0);
  });
});
