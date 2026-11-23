// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The SPERT® Suite frame around every MyScrumBudget screen (FRAME26, v0.45.0): its order, its hooks, the brand, the
 * column rule for capped screens, and the one `h1`. Geometry and colour are measured in Chrome by frame-check; this
 * pins the structure those measurements depend on.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import { APP_TAGLINE } from '@/lib/constants';
import { HeadingRow } from '@/components/HeadingRow';

let mockPath = '/';
vi.mock('@/hooks/useInvitationLanding', () => ({
  useInvitationLanding: () => ({ state: 'idle', claimedNames: [], claimedElsewhereApps: [], failureMessage: null, dismiss: () => {} }),
}));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('next/navigation', () => ({ usePathname: () => mockPath, useRouter: () => ({ push: () => {}, replace: () => {} }) }));
vi.mock('next/link', () => ({
  default: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}));

import { Shell } from './shellTestHarness';

beforeEach(() => {
  localStorage.clear();
  mockPath = '/';
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

async function renderShell(path = '/') {
  mockPath = path;
  const view = render(<Shell><HeadingRow>Page heading</HeadingRow><p data-testid="body">body</p></Shell>);
  await screen.findByTestId('body');
  return view.container.querySelector<HTMLElement>('[data-sf="app"]')!;
}
const hook = (app: HTMLElement, name: string) => app.querySelectorAll(`[data-sf="${name}"]`);

describe('AppShell: the frame', () => {
  it('is .sf-app: skip link, header, nav, notices, main, footer, in that order', async () => {
    const app = await renderShell();
    expect(app.className).toBe('sf-app');
    const kids = [...app.children].map((e) => e.getAttribute('data-sf') ?? e.tagName.toLowerCase());
    expect(kids).toEqual(['skip', 'header', 'nav', 'notices', 'main', 'footer']);
  });

  it('carries every frame hook exactly once (favicon twice)', async () => {
    const app = await renderShell();
    for (const name of ['skip', 'brand', 'title', 'tagline', 'utils', 'theme', 'chip', 'nav', 'nav-work', 'nav-app', 'notices', 'main', 'headrow', 'heading', 'footer']) {
      expect(hook(app, name), name).toHaveLength(1);
    }
    expect(hook(app, 'favicon')).toHaveLength(2);
  });

  it('the skip link comes first, says "Skip to main content" and targets main#main-content', async () => {
    const app = await renderShell();
    const skip = app.firstElementChild as HTMLAnchorElement;
    expect(skip.className).toBe('sf-skip');
    expect(skip.textContent).toBe('Skip to main content');
    expect(skip.getAttribute('href')).toBe('#main-content');
    expect(app.querySelector('main')!.id).toBe('main-content');
  });

  it('the brand is a link home with no aria-label, named by its visible title, its favicons decorative', async () => {
    const app = await renderShell();
    const brand = hook(app, 'brand')[0] as HTMLAnchorElement;
    expect(brand.tagName).toBe('A');
    expect(brand.getAttribute('href')).toBe('/');
    expect(brand.hasAttribute('aria-label')).toBe(false);
    expect(within(app.querySelector('header')!).getByRole('link', { name: 'MyScrumBudget™' })).toBe(brand);
    const [light, dark] = [...hook(app, 'favicon')] as HTMLImageElement[];
    expect([light!.getAttribute('alt'), dark!.getAttribute('alt')]).toEqual(['', '']);
    expect(light!.className).toContain('sf-icon sf-icon--light');
    expect(dark!.className).toContain('sf-icon sf-icon--dark');
    expect(light!.getAttribute('src')).toBe('/spert-favicon-myscrumbudget.png');
    expect(dark!.getAttribute('src')).toBe('/spert-favicon-myscrumbudget-dark.png');
  });

  it('the header has no heading; the page has exactly one h1, in main', async () => {
    const app = await renderShell();
    expect(app.querySelector('header')!.querySelectorAll('h1, h2, h3, [role="heading"]')).toHaveLength(0);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(app.querySelector('main')!.contains(h1s[0]!)).toBe(true);
  });

  it('the tagline is APP_TAGLINE; the utilities are the theme button, then the account chip', async () => {
    const app = await renderShell();
    expect(hook(app, 'tagline')[0]!.textContent).toBe(APP_TAGLINE);
    expect(APP_TAGLINE).toBe('Project budget forecasting for any project type');
    const utils = hook(app, 'utils')[0]!;
    expect([...utils.children].map((e) => e.getAttribute('data-sf'))).toEqual(['theme', 'chip']);
  });

  it('main keeps the body font (Geist, font-sans) and is the column', async () => {
    const app = await renderShell();
    const main = app.querySelector('main')!;
    expect(main.className.split(/\s+/)).toEqual(expect.arrayContaining(['sf-col', 'sf-main', 'font-sans']));
  });

  it.each([
    ['/settings', true], ['/about', true], ['/changelog', true],
    ['/', false], ['/team', false], ['/projects/new', false], ['/projects/p1', false], ['/nope', false],
  ] as const)('on %s the body is capped: %s (exception X4)', async (path, capped) => {
    const app = await renderShell(path);
    expect(app.querySelector('main')!.classList.contains('sf-main--capped')).toBe(capped);
    // The heading row is a DIRECT child of main, so a capped body leaves it full width.
    expect(hook(app, 'headrow')[0]!.parentElement).toBe(app.querySelector('main'));
    cleanup();
  });
});
