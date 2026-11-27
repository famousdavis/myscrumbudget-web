// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Adding a guide to public/? Also add it, with a one-line description, to spertsuite.com's
// src/data/help.ts (spert-landing-page). The landing page's daily guide-list check stays red until you do.

/**
 * The About page (FRAME26 pass 3, v0.47.0): the SPERT® Suite's shared About layout (contract FRAME-CONTRACT.md §3 About
 * page and §7 About), rendered inside the real frame (`Shell`, as `layout.tsx` assembles it). Every word below is pinned
 * HERE, copied from the approved sources, never read from the page: §7's shared words, MyScrumBudget's own words
 * (FRAME26-ABOUT-WORDS.md, 2026-11-27), and MyScrumBudget's Help Center entry (spert-landing-page src/data/help.ts,
 * hub v2.15.2). The year's hydration is in `src/components/__tests__/CopyrightYear.hydration.test.tsx`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { APP_VERSION } from '@/lib/constants';

vi.mock('@/hooks/useInvitationLanding', () => ({
  useInvitationLanding: () => ({ state: 'idle', claimedNames: [], claimedElsewhereApps: [], failureMessage: null, dismiss: () => {} }),
}));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/about', useRouter: () => ({ push: () => {}, replace: () => {} }) }));
vi.mock('next/link', () => ({
  default: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}));

import { Shell } from '@/components/__tests__/shellTestHarness';
import AboutPage from '../page';

const TITLE = 'MyScrumBudget™';
const REPO = 'famousdavis/myscrumbudget-web';
const HELP_ENTRY = {
  slug: 'myscrumbudget',
  guides: [
    {
      file: 'MyScrumBudget_Quick_Reference_Guide.pdf',
      title: 'Quick Reference Guide',
      description: 'What MyScrumBudget is and how it forecasts a project’s labor costs, burn rate and variance from your team’s allocations.',
    },
    {
      file: 'MyScrumBudget_Charter_Budget_Guide.pdf',
      title: 'Charter Budget Reference Guide',
      description: 'How the Charter Budget adds a risk-based contingency to your estimate, giving a budget you can put in a project charter.',
    },
  ],
};

/** Text as it is SEEN: screen-reader-only text left out, runs of whitespace one space, typographic quotes straight (§7). */
function seen(el: Element): string {
  const c = el.cloneNode(true) as Element;
  c.querySelectorAll('.sf-sr').forEach((x) => x.remove());
  return (c.textContent ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}
const norm = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => vi.useRealTimers());

async function renderAbout() {
  const view = render(<Shell><AboutPage /></Shell>);
  await screen.findByRole('heading', { level: 1 });
  const main = view.container.querySelector<HTMLElement>('[data-sf="main"]')!;
  const about = main.querySelector<HTMLElement>('.sf-about')!;
  const sections = Array.from(about.children).filter((e): e is HTMLElement => e.tagName === 'SECTION');
  const section = (h2: string) => sections.find((s) => seen(s.querySelector(':scope > h2')!) === h2)!;
  const paras = (s: HTMLElement) => Array.from(s.querySelectorAll(':scope > p')).map(seen);
  return { container: view.container, main, about, sections, section, paras };
}

describe('the About page (contract §3 About page, §7 About)', () => {
  it('the h1 is "About MyScrumBudget™" with the ™ as the frame\'s mark, and .sf-about is main\'s next child after the heading row', async () => {
    const { main, about } = await renderAbout();
    const h1s = main.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(h1s[0]!.textContent).toBe('About MyScrumBudget™');
    expect(h1s[0]!.querySelector('.sf-mark.sf-mark--tm')!.textContent).toBe('™');
    const row = h1s[0]!.closest('[data-sf="headrow"]')!;
    expect(row.parentElement).toBe(main);
    expect(about.parentElement, 'the About page is main\'s own child, with no wrapper').toBe(main);
    expect(row.nextElementSibling, 'nothing between the heading row and the About page: no tagline line').toBe(about);
    expect(about).toHaveAttribute('data-sf', 'about');
    expect(main.querySelector('.sf-below')).toBeNull();
  });

  it('has its sections in §7\'s order, each a <section> opening with its h2; no Connect AI', async () => {
    const { sections } = await renderAbout();
    expect(sections.map((s) => s.firstElementChild!.tagName)).toEqual(['H2', 'H2', 'H2', 'H2', 'H2']);
    expect(sections.map((s) => seen(s.querySelector(':scope > h2')!))).toEqual([
      `What is ${TITLE}?`, 'How it works', 'Guides', 'Your data and storage', 'Version and license',
    ]);
  });

  it('What is MyScrumBudget™?: the approved paragraph', async () => {
    const { section, paras } = await renderAbout();
    expect(paras(section(`What is ${TITLE}?`))).toEqual([
      'MyScrumBudget™ is a web-based budget forecasting tool for any project type. It replaces the original GPL-licensed Excel spreadsheet with a modern, interactive web application. Project managers can track team allocations, calculate costs, create reforecasts, and visualize budget performance — all in the browser.',
    ]);
  });

  it('How it works: the seven kept steps, as one numbered list', async () => {
    const { section } = await renderAbout();
    const s = section('How it works');
    expect(Array.from(s.children).map((e) => e.tagName)).toEqual(['H2', 'OL']);
    expect(Array.from(s.querySelectorAll('ol > li')).map(seen)).toEqual([
      'Configure labor rates and working hours in Settings',
      'Create a project with start/end dates and a baseline budget',
      'Assign team members from the global team pool',
      'Enter monthly allocation percentages in the allocation grid',
      'View calculated costs, ETC, EAC, variance, burn rate, and NPV',
      'Create reforecasts to track budget changes over time',
      'Apply productivity windows to adjust hours and cost calculations',
    ]);
  });

  it('Guides: one row per Help Center guide, verbatim and in order, each opening its PDF from this origin in a new tab', async () => {
    const { about } = await renderAbout();
    const list = about.querySelector('ul.sf-guides')!;
    expect(list).toHaveAttribute('data-sf', 'guides');
    const rows = Array.from(list.children);
    expect(rows).toHaveLength(HELP_ENTRY.guides.length);
    rows.forEach((row, i) => {
      const g = HELP_ENTRY.guides[i]!;
      expect(row).toHaveClass('sf-guide');
      expect(seen(row.querySelector('.sf-guide-body > h3.sf-guide-title')!)).toBe(g.title);
      expect(seen(row.querySelector('.sf-guide-body > p.sf-guide-text')!)).toBe(norm(g.description));
      const open = row.querySelector('a.sf-guide-open')!;
      expect(open).toHaveAttribute('href', `/${g.file}`);
      expect(open).toHaveAttribute('target', '_blank');
      expect(open).toHaveAttribute('rel', 'noopener noreferrer');
      expect(seen(open)).toBe('Open PDF ↗');
      expect(open.querySelector('[aria-hidden="true"]')!.textContent).toBe(' ↗');
      expect(open.querySelector('.sf-sr')!.textContent).toBe(`: ${g.title} (opens in a new tab)`);
    });
  });

  it('Guides: then the shared More help line, to this app\'s Help Center page', async () => {
    const { section } = await renderAbout();
    const more = section('Guides').querySelector(':scope > ul.sf-guides + p > a')!;
    expect(more).toHaveAttribute('href', `https://spertsuite.com/help/${HELP_ENTRY.slug}`);
    expect(more).toHaveAttribute('target', '_blank');
    expect(more).toHaveAttribute('rel', 'noopener noreferrer');
    expect(seen(more)).toBe('More help in the Help Center ↗');
    expect(more.querySelector('.sf-sr')!.textContent).toBe(' (opens in a new tab)');
  });

  it('Your data and storage: the two shared paragraphs word for word, and none of the app\'s own', async () => {
    const { section, paras } = await renderAbout();
    expect(paras(section('Your data and storage'))).toEqual([
      `Unless you sign in and choose cloud storage, ${TITLE} keeps your projects in this browser, on this device, and sends them to no server. Clearing this site's data deletes them, so export a backup from time to time.`,
      'If you sign in, with Google or with a Microsoft work or school account, and choose cloud storage, your projects are saved to your account in Google Firebase, over encrypted (HTTPS) connections. You can then open them on any device and share them with other people.',
    ]);
  });

  it('Version and license: the five shared paragraphs word for word, with this version and the footer\'s year', async () => {
    const { container, about } = await renderAbout();
    const legal = about.querySelector('section.sf-about-legal')!;
    expect(legal).toHaveAttribute('data-sf', 'about-legal');
    const year = /©\s*(\d{4})/.exec(container.querySelector('[data-sf="footer"]')!.textContent!)![1];
    expect(year).toBe(String(new Date().getFullYear()));
    expect(Array.from(legal.querySelectorAll('p')).map(seen)).toEqual([
      `Version ${APP_VERSION} · What's new`,
      'Created by William W. Davis, MSPM, PMP · Source code on GitHub ↗',
      `© ${year} William W. Davis, MSPM, PMP. ${TITLE} is free software: you may use, change and share it under the GNU General Public License, version 3, with the additional terms its LICENSE ↗ adds under Section 7 of that license: attribution and legal notices, trademarks, the marking of modified versions, endorsement, and indemnification.`,
      'SPERT®, Statistical PERT® and Estimation Made Easy® are registered trademarks of famousdavis, LLC. GanttApp™ and MyScrumBudget™ are trademarks of famousdavis, LLC.',
      'THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW. EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM "AS IS" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM IS WITH YOU. SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL NECESSARY SERVICING, REPAIR OR CORRECTION.',
    ]);
  });

  it('Version and license: What\'s new opens the changelog, as the footer\'s Version does; source and LICENSE go to myscrumbudget-web', async () => {
    const { container, about } = await renderAbout();
    const links = Array.from(about.querySelectorAll('.sf-about-legal a'));
    const by = (re: RegExp) => links.find((a) => re.test(seen(a)))!;
    expect(by(/^What.s new$/)).toHaveAttribute('href', '/changelog');
    expect(by(/^What.s new$/)).not.toHaveAttribute('target');
    const footerVersion = Array.from(container.querySelectorAll('[data-sf="footer"] a')).find((a) => /^Version /.test(a.textContent!))!;
    expect(by(/^What.s new$/).getAttribute('href')).toBe(footerVersion.getAttribute('href'));
    expect(by(/^Source code on GitHub/)).toHaveAttribute('href', `https://github.com/${REPO}`);
    expect(by(/^LICENSE/)).toHaveAttribute('href', `https://github.com/${REPO}/blob/main/LICENSE`);
    for (const a of [by(/^Source code on GitHub/), by(/^LICENSE/)]) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
      expect(a.querySelector('.sf-sr')!.textContent).toBe(' (opens in a new tab)');
    }
  });

  it('every ® and ™ on the page is the glyph alone in a .sf-mark, the ™ also .sf-mark--tm; no <sup>, no letters "TM"', async () => {
    const { main } = await renderAbout();
    expect(main.querySelectorAll('sup')).toHaveLength(0);
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const marks: Text[] = [];
    for (let t = walker.nextNode(); t; t = walker.nextNode()) if (/[®™]|TM\b/.test(t.textContent ?? '')) marks.push(t as Text);
    expect(marks.length).toBeGreaterThan(0);
    for (const t of marks) {
      expect(t.textContent).toMatch(/^[®™]$/);
      expect(t.parentElement).toHaveClass('sf-mark');
      if (t.textContent === '™') expect(t.parentElement).toHaveClass('sf-mark--tm');
    }
  });

  it('carries no style or colour of its own: no style attribute, and no class outside the frame\'s, inside .sf-about', async () => {
    const { about } = await renderAbout();
    expect(about.querySelectorAll('[style]')).toHaveLength(0);
    const classes = new Set(Array.from(about.querySelectorAll('[class]')).flatMap((e) => Array.from(e.classList)));
    for (const c of Array.from(classes)) expect(c, `class ${c}`).toMatch(/^sf-/);
  });

  it('Y1: with the clock at 2027 the footer and About both read © 2027', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2027, 0, 1, 9, 0, 0));
    const { container, about } = await renderAbout();
    expect(container.querySelector('[data-sf="footer"]')!.textContent).toMatch(/© 2027 William W\. Davis/);
    expect(seen(about.querySelectorAll('.sf-about-legal p')[2]!)).toMatch(/^© 2027 William W\. Davis/);
  });
});
