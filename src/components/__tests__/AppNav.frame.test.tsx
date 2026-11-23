// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Adding a guide to public/? Also add it, with a one-line description, to spertsuite.com's
// src/data/help.ts (spert-landing-page). The landing page's daily "Guide list matches the app
// repos" check stays red until you do. The PDF guide house rules say the same.

/**
 * The frame's navigation row (FRAME26, v0.45.0), which replaced the sidebar. Its Help Center tests are the sidebar's
 * (v0.44.11), kept: the URL is written out here, not imported (a test that reads the constant passes whatever the
 * constant says), and "out of sight" is pinned as the `sr-only` class because jsdom applies no CSS. What changed by
 * the contract (§2, William 2026-11-23): Help Center is LAST, after About, and wears `.sf-help`, not its siblings'
 * class; "Dashboard" is "Projects"; the current page is marked by `aria-current="page"` alone (the stylesheet draws the
 * underline), never by a class.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';

let mockPath: string | null = '/';
vi.mock('next/navigation', () => ({ usePathname: () => mockPath }));

import { AppNav } from '../AppNav';

const HELP_URL = 'https://spertsuite.com/help/myscrumbudget';
const NAME = 'Help Center (opens in a new tab)';

afterEach(() => {
  mockPath = '/';
});

function renderNav(path: string | null = '/') {
  mockPath = path;
  render(<AppNav />);
  return screen.getByRole('navigation');
}

const helpLink = (nav: HTMLElement) => within(nav).getByRole('link', { name: NAME });
const zone = (nav: HTMLElement, name: 'nav-work' | 'nav-app') => {
  const z = nav.querySelector<HTMLElement>(`[data-sf="${name}"]`);
  if (!z) throw new Error(`no [data-sf=${name}]`);
  return z;
};
/** What shows of each link in a zone, in DOM order: the sr-only words dropped, the visible arrow kept. */
const shown = (el: HTMLElement) =>
  [...el.querySelectorAll(':scope > a')].map((a) =>
    [...a.childNodes]
      .filter((n) => !(n instanceof HTMLElement && n.classList.contains('sr-only')))
      .map((n) => n.textContent)
      .join('')
      .trim(),
  );

describe('AppNav: zones, order and hooks', () => {
  it('is the frame row: nav.sf-nav > .sf-col.sf-nav-row, with its hooks', () => {
    const nav = renderNav();
    expect(nav.classList.contains('sf-nav')).toBe(true);
    expect(nav.getAttribute('data-sf')).toBe('nav');
    expect(nav.firstElementChild?.className).toBe('sf-col sf-nav-row');
  });

  it('work items on the left: Projects, Team Pool', () => {
    expect(shown(zone(renderNav(), 'nav-work'))).toEqual(['Projects', 'Team Pool']);
  });

  it('the app zone on the right: Settings · About · Help Center ↗, in that order (contract §2)', () => {
    const nav = renderNav();
    expect(shown(zone(nav, 'nav-app'))).toEqual(['Settings', 'About', 'Help Center ↗']);
    expect(zone(nav, 'nav-app').lastElementChild).toBe(helpLink(nav));
  });

  it('every item is a .sf-tab link and nothing else; Help Center is .sf-help', () => {
    const nav = renderNav();
    for (const a of nav.querySelectorAll('a')) {
      const expected = a === helpLink(nav) ? 'sf-help' : 'sf-tab';
      expect(a.className, a.textContent ?? '').toBe(expected);
    }
  });

  it('links to the routes the sidebar linked to', () => {
    const nav = renderNav();
    const href = (name: string) => within(nav).getByRole('link', { name }).getAttribute('href');
    expect([href('Projects'), href('Team Pool'), href('Settings'), href('About')]).toEqual(['/', '/team', '/settings', '/about']);
  });
});

describe('AppNav: the current page', () => {
  const CASES: [string, string | null][] = [
    ['/', 'Projects'],
    ['/projects/new', 'Projects'],
    ['/projects/p-42', 'Projects'],
    ['/projects/p-42/edit', 'Projects'],
    ['/team', 'Team Pool'],
    ['/settings', 'Settings'],
    ['/about', 'About'],
    ['/changelog', null],
    ['/no-such-page', null],
    ['/teams', null],
    ['/help', null],
  ];

  it.each(CASES)('on %s marks %s', (path, expected) => {
    const nav = renderNav(path);
    const items = [...nav.querySelectorAll('a')];
    const current = items.filter((a) => a.getAttribute('aria-current') === 'page');
    if (expected === null) {
      expect(current, `nothing should be marked on ${path}`).toHaveLength(0);
    } else {
      expect(current, `exactly one item should be marked on ${path}`).toHaveLength(1);
      expect(current[0]!.textContent).toBe(expected);
    }
    // Absent, never "false", on every other item; and no item carries a class for it (the stylesheet draws it).
    for (const a of items.filter((x) => !current.includes(x))) expect(a.hasAttribute('aria-current'), a.textContent ?? '').toBe(false);
    cleanup();
  });
});

describe('AppNav: the Help Center link (kept from the sidebar, v0.44.11)', () => {
  it("links to MyScrumBudget's Help Center page, the whole URL", () => {
    const link = helpLink(renderNav());
    expect(link.getAttribute('href')).toBe('https://spertsuite.com/help/myscrumbudget');
    expect(link.getAttribute('href')).toBe(HELP_URL);
  });

  it('opens in a new tab, without the opener or the referrer', () => {
    const link = helpLink(renderNav());
    expect(link.getAttribute('target')).toBe('_blank');
    const rel = (link.getAttribute('rel') ?? '').split(/\s+/);
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('is named "Help Center (opens in a new tab)", with the arrow hidden from screen readers', () => {
    const link = helpLink(renderNav());
    const spans = [...link.querySelectorAll('span')];
    const arrow = spans.find((s) => s.textContent?.includes('↗'));
    expect(arrow, 'the arrow span').toBeDefined();
    expect(arrow!.getAttribute('aria-hidden')).toBe('true');
    const said = spans.find((s) => s.textContent?.includes('opens in a new tab'));
    expect(said, 'the new-tab words').toBeDefined();
    expect(said!.textContent).toBe('(opens in a new tab)');
  });

  it('keeps the new-tab words out of sight: what shows is "Help Center ↗"', () => {
    const link = helpLink(renderNav());
    const said = [...link.querySelectorAll('span')].find((s) => s.textContent?.includes('opens in a new tab'));
    expect(said!.classList.contains('sr-only'), 'the new-tab words carry sr-only').toBe(true);
    const visible = [...link.childNodes].filter((n) => n !== said).map((n) => n.textContent).join('');
    expect(visible.trim()).toBe('Help Center ↗');
  });

  it('is never the current page', () => {
    expect(helpLink(renderNav('/help/myscrumbudget')).hasAttribute('aria-current')).toBe(false);
  });
});
