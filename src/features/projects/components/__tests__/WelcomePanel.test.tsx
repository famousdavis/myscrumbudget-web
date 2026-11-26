// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The Welcome panel (FRAME26 clean-up, v0.46.0; contract §3 "Welcome panel", §7 "Empty collection"): the frame's
// .sf-empty, its parts in the contract's order, the three Getting Started steps as its body, and Create New Project
// going where the toolbar's New Project goes. MyScrumBudget has no sample (Nov 8), so no Load Sample and no note.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { WelcomePanel } from '../WelcomePanel';
import { RATES_DEEP_LINK } from '@/lib/constants';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

const panel = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-sf="empty"]')!;

describe('WelcomePanel', () => {
  it('is the frame\'s .sf-empty, its parts in the contract\'s order', () => {
    const { container } = render(<WelcomePanel ratesReviewed={false} poolCount={0} />);
    const p = panel(container);
    expect(p.className).toBe('sf-empty');
    expect(Array.from(p.children).map((c) => `${c.tagName.toLowerCase()}.${c.className}`)).toEqual([
      'h2.sf-empty-title', 'p.sf-empty-text', 'p.sf-empty-text', 'div.sf-empty-body', 'div.sf-empty-actions',
    ]);
  });

  it('is titled "Welcome to MyScrumBudget™", the ™ in the brand row\'s .sf-mark--tm', () => {
    const { container } = render(<WelcomePanel ratesReviewed={false} poolCount={0} />);
    const title = panel(container).querySelector('h2')!;
    expect(title.textContent).toBe('Welcome to MyScrumBudget™');
    expect(title.querySelector('span')!.className).toBe('sf-mark sf-mark--tm');
    expect(screen.getByRole('heading', { level: 2, name: 'Welcome to MyScrumBudget™' })).toBe(title);
  });

  it('says what the app is for, then the steps\' line', () => {
    const { container } = render(<WelcomePanel ratesReviewed={false} poolCount={0} />);
    expect(Array.from(panel(container).querySelectorAll('.sf-empty-text')).map((e) => e.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      "Forecast what your project will cost from your team's roles, rates and allocations, and see how the spending tracks against the budget.",
      'Follow these steps to set up your first project.',
    ]);
  });

  it('holds the three Getting Started steps, and step 3 has no button of its own', () => {
    const { container } = render(<WelcomePanel ratesReviewed={false} poolCount={0} />);
    const body = panel(container).querySelector<HTMLElement>('.sf-empty-body')!;
    const links = within(body).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Review Labor Rates', RATES_DEEP_LINK],
      ['Build Your Team Pool', '/team'],
      ['Create Your First Project', '/projects/new'],
    ]);
    expect(within(body).queryByText('Create Project')).toBeNull();
    expect(body.querySelectorAll('li')).toHaveLength(3);
  });

  it('marks steps 1 and 2 done from their own state', () => {
    const { container } = render(<WelcomePanel ratesReviewed poolCount={2} />);
    const marks = Array.from(panel(container).querySelectorAll('li > span')).map((s) => s.textContent);
    expect(marks).toEqual(['✓', '✓', '3']);
  });

  it('has one action, Create New Project, a 36 px .sf-btn in the toolbar\'s primary look, to /projects/new', () => {
    const { container } = render(<WelcomePanel ratesReviewed={false} poolCount={0} />);
    const actions = Array.from(panel(container).querySelectorAll('.sf-empty-actions > *'));
    expect(actions.map((a) => [a.tagName, a.textContent, a.getAttribute('href')])).toEqual([['A', 'Create New Project', '/projects/new']]);
    expect(actions[0]!.className.split(/\s+/)).toEqual(expect.arrayContaining(['sf-btn', 'bg-blue-600', 'text-white']));
    expect(panel(container).querySelector('.sf-empty-note')).toBeNull();
  });
});
