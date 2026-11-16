// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Adding a guide to public/? Also add it, with a one-line description, to spertsuite.com's
// src/data/help.ts (spert-landing-page). The landing page's daily "Guide list matches the app
// repos" check stays red until you do. The PDF guide house rules say the same.

/**
 * The sidebar's Help Center link (v0.44.11). It opens MyScrumBudget's page in
 * the SPERT® Suite Help Center in a new tab, and sits immediately before About.
 *
 * The URL is written out here, not imported: a test that reads the constant
 * passes whatever the constant says. jsdom applies no CSS, so "out of sight" is
 * pinned as the `sr-only` class; how the link renders, and its contrast, were
 * checked in a real browser and are recorded in the pull request that added
 * this file.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Sidebar } from '../Sidebar';

const HELP_URL = 'https://spertsuite.com/help/myscrumbudget';
const NAME = 'Help Center (opens in a new tab)';

function renderSidebar() {
  render(<Sidebar />);
  return screen.getByRole('navigation');
}

const helpLink = (nav: HTMLElement) => within(nav).getByRole('link', { name: NAME });

/** The text of each item in the sidebar's link list, in DOM order. */
function itemLabels(nav: HTMLElement): string[] {
  const list = nav.querySelector('ul');
  if (!list) throw new Error('the sidebar link list was not rendered');
  return [...list.querySelectorAll(':scope > li > a')].map((a) => {
    // Read only what shows: drop the sr-only words, keep the visible arrow.
    const shown = [...a.childNodes]
      .filter((n) => !(n instanceof HTMLElement && n.classList.contains('sr-only')))
      .map((n) => n.textContent)
      .join('');
    return shown.trim();
  });
}

describe('Sidebar: the Help Center link', () => {
  it('links to MyScrumBudget\'s Help Center page, the whole URL', () => {
    const link = helpLink(renderSidebar());
    expect(link.getAttribute('href')).toBe('https://spertsuite.com/help/myscrumbudget');
    expect(link.getAttribute('href')).toBe(HELP_URL);
  });

  it('opens in a new tab, without the opener or the referrer', () => {
    const link = helpLink(renderSidebar());
    expect(link.getAttribute('target')).toBe('_blank');
    const rel = (link.getAttribute('rel') ?? '').split(/\s+/);
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('is named "Help Center (opens in a new tab)", with the arrow hidden from screen readers', () => {
    const link = helpLink(renderSidebar());
    const spans = [...link.querySelectorAll('span')];
    const arrow = spans.find((s) => s.textContent?.includes('↗'));
    expect(arrow, 'the arrow span').toBeDefined();
    expect(arrow!.getAttribute('aria-hidden')).toBe('true');
    const said = spans.find((s) => s.textContent?.includes('opens in a new tab'));
    expect(said, 'the new-tab words').toBeDefined();
    expect(said!.textContent).toBe('(opens in a new tab)');
  });

  it('keeps the new-tab words out of sight: what shows is "Help Center ↗"', () => {
    const link = helpLink(renderSidebar());
    const said = [...link.querySelectorAll('span')].find((s) =>
      s.textContent?.includes('opens in a new tab'),
    );
    expect(said, 'the new-tab words').toBeDefined();
    expect(said!.classList.contains('sr-only'), 'the new-tab words carry sr-only').toBe(true);
    const shown = [...link.childNodes]
      .filter((n) => n !== said)
      .map((n) => n.textContent)
      .join('');
    expect(shown.trim()).toBe('Help Center ↗');
  });

  it('comes immediately before About, and the other items keep their order', () => {
    const nav = renderSidebar();
    expect(itemLabels(nav)).toEqual([
      'Dashboard',
      'Team Pool',
      'Settings',
      'Help Center ↗',
      'About',
    ]);
    const about = within(nav).getByRole('link', { name: 'About' });
    expect(helpLink(nav).closest('li')?.nextElementSibling).toBe(about.closest('li'));
  });

  it('wears its siblings\' exact class string', () => {
    const nav = renderSidebar();
    const about = within(nav).getByRole('link', { name: 'About' });
    expect(helpLink(nav).getAttribute('class')).toBe(about.getAttribute('class'));
  });
});
