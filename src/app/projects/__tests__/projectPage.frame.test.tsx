// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The project's page on the frame (FRAME26, v0.45.0, contract §7 "Inside a project"): the project's name is the `h1`,
 * cut short with an ellipsis and given in full in `title`; its five actions sit on the heading row as `.sf-btn` in the
 * toolbar's geometry; the row is the FIRST child of the page's root, beside `.print-report`, so the print rules hide it;
 * and with no project to name (not found) the `h1` reads "Project". The real page runs against the real localStorage
 * repository; only the router and the repository's provider are stood in for.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import ProjectPage from '../[id]/page';
import { ToastProvider } from '@/components/Toast';
import type { Project } from '@/types/domain';

const { repo } = await vi.hoisted(async () => {
  const { createLocalStorageRepository } = await import('@/lib/storage/localStorage');
  return { repo: createLocalStorageRepository() };
});
vi.mock('@/components/RepositoryProvider', () => {
  const value = { repository: repo, mode: 'local' as const, isCloud: false, switchMode: vi.fn() };
  return { useRepository: () => value };
});
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }), usePathname: () => '/projects/p1' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: unknown; children: ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>{children}</a>
  ),
}));

const LONG = 'Apollo programme reforecast for the whole of the next financial year';
function makeProject(id: string, name: string): Project {
  return {
    id, name, startDate: '2026-06-15', endDate: '2026-12-15', activeReforecastId: 'rf-1',
    reforecasts: [{
      id: 'rf-1', name: 'Baseline', createdAt: '2026-06-01T00:00:00Z', startDate: '2026-06-15', endDate: '2026-12-15',
      reforecastDate: '2026-06-01', assignments: [], allocations: [], productivityWindows: [], actualCost: 0, baselineBudget: 100000,
    }],
  };
}

/** The page's own `h1`, in its heading row. (PrintableReport carries a second `h1`, `hidden` on screen by CSS, which
 * jsdom does not apply; in a browser it is out of the accessibility tree.) */
async function pageHeading(c: HTMLElement) {
  await waitFor(() => expect(c.querySelector('[data-sf="headrow"] h1')).not.toBeNull());
  return c.querySelector<HTMLElement>('[data-sf="headrow"] h1')!;
}

/** `use(params)` reads a thenable that is already settled without suspending. */
const params = (id: string) => Object.assign(Promise.resolve({ id }), { status: 'fulfilled', value: { id } });

function renderPage(id: string) {
  return render(<ToastProvider><ProjectPage params={params(id)} /></ToastProvider>).container;
}

beforeEach(async () => {
  localStorage.clear();
  await repo.clear();
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

describe('the project page on the frame', () => {
  it("the h1 is the project's name, with the full name in title", async () => {
    await repo.saveProject(makeProject('p1', LONG));
    const c = renderPage('p1');
    await waitFor(() => expect(c.querySelector('[data-sf="headrow"] h1')?.textContent).toBe(LONG));
    const h1 = await pageHeading(c);
    expect(h1.className).toBe('sf-heading');
    expect(h1.getAttribute('title')).toBe(LONG);
    // One h1 on screen: every other h1 is the print report's.
    const others = screen.getAllByRole('heading', { level: 1 }).filter((e) => e !== h1);
    for (const e of others) expect(e.closest('.print-report'), 'a second h1 outside the print report').not.toBeNull();
  });

  it('its five actions are .sf-btn in the toolbar on the heading row, in their order', async () => {
    await repo.saveProject(makeProject('p1', 'Apollo'));
    const c = renderPage('p1');
    await waitFor(() => expect(c.querySelector('[data-sf="headrow"] h1')?.textContent).toBe('Apollo'));
    const toolbar = c.querySelector<HTMLElement>('[data-sf="toolbar"]')!;
    expect(toolbar.parentElement!.getAttribute('data-sf')).toBe('headrow');
    const actions = [...toolbar.children] as HTMLElement[];
    expect(actions.map((a) => a.getAttribute('aria-label') ?? a.textContent?.trim())).toEqual(['Edit', 'Print Report', 'Undo', 'Redo', 'Delete project']);
    for (const a of actions) expect(a.classList.contains('sf-btn'), a.textContent ?? '').toBe(true);
    // The icon-only Delete is 36 × 36 (D16): .sf-btn sets the height, w-9 the width.
    expect(actions[4]!.classList.contains('w-9')).toBe(true);
  });

  it("the heading row is the first child of the page's root, beside .print-report (the print rules hide it)", async () => {
    await repo.saveProject(makeProject('p1', 'Apollo'));
    const c = renderPage('p1');
    await waitFor(() => expect(c.querySelector('[data-sf="headrow"] h1')?.textContent).toBe('Apollo'));
    const row = c.querySelector<HTMLElement>('[data-sf="headrow"]')!;
    const root = row.parentElement!;
    expect(root.firstElementChild).toBe(row);
    expect([...root.children].some((e) => e.classList.contains('print-report'))).toBe(true);
  });

  it('a project that is not there keeps a heading row: h1 "Project", then "Project not found." and "Back to Projects"', async () => {
    const c = renderPage('nope');
    await waitFor(() => expect(screen.getByText('Project not found.')).toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Project');
    expect(c.querySelector('[data-sf="headrow"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Back to Projects' }).getAttribute('href')).toBe('/');
  });
});
