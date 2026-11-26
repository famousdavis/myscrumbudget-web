// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The collection screen on the frame (FRAME26, v0.45.0, contract §3 and §7): the heading row (`h1` "Projects", the
 * toolbar's three `.sf-btn`), the one filter row (only while an archived project exists), the tile grid on `.sf-tiles`,
 * and the empty panels hooked `data-sf="empty"` in place of the grid — never beside one. frame-check measures the
 * geometry in Chrome; this pins the hooks and classes it reads.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import DashboardPage from '../page';
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
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: unknown; children: ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>{children}</a>
  ),
}));

function makeProject(id: string, name: string, overrides: Partial<Project> = {}): Project {
  return {
    id, name, startDate: '2026-06-15', endDate: '2027-07-15', activeReforecastId: 'rf-1',
    reforecasts: [{
      id: 'rf-1', name: 'Baseline', createdAt: '2026-06-01T00:00:00Z', startDate: '2026-06-15', endDate: '2027-07-15',
      reforecastDate: '2026-06-01', assignments: [], allocations: [], productivityWindows: [], actualCost: 0, baselineBudget: 100000,
    }],
    ...overrides,
  };
}

function renderPage() {
  const view = render(<ToastProvider><DashboardPage /></ToastProvider>);
  return view.container;
}
const one = (c: HTMLElement, name: string) => c.querySelectorAll<HTMLElement>(`[data-sf="${name}"]`);

beforeEach(async () => {
  localStorage.clear();
  await repo.clear();
});

describe('Projects on the frame: the heading row', () => {
  it('is the heading row with the h1 "Projects" and the toolbar of three .sf-btn', async () => {
    const c = renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Welcome to MyScrumBudget™' })).toBeInTheDocument());
    const row = one(c, 'headrow')[0]!;
    expect(row.className).toBe('sf-headrow');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Projects');
    expect(h1.getAttribute('data-sf')).toBe('heading');
    const toolbar = one(c, 'toolbar')[0]!;
    expect(toolbar.parentElement).toBe(row);
    expect(toolbar.className).toBe('sf-toolbar');
    const visible = [...toolbar.children].filter((e) => !e.classList.contains('hidden'));
    expect(visible.map((e) => e.textContent?.trim())).toEqual(['Export All', 'Import', 'New Project']);
    for (const b of visible) expect(b.classList.contains('sf-btn'), b.textContent ?? '').toBe(true);
    // The file input stays inside the toolbar, hidden (display: none keeps it out of the gap).
    expect(toolbar.querySelector('input[type="file"]')!.classList.contains('hidden')).toBe(true);
  });
});

describe('Projects on the frame: the grid and the empty panels', () => {
  it('a first visit: the Welcome panel is the empty panel, and there is no grid and no filter row', async () => {
    const c = renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Welcome to MyScrumBudget™' })).toBeInTheDocument());
    expect(one(c, 'empty')).toHaveLength(1);
    expect(one(c, 'empty')[0]!.className).toBe('sf-empty');
    expect(one(c, 'empty')[0]!.textContent).toContain('Welcome to MyScrumBudget™');
    expect(one(c, 'tiles')).toHaveLength(0);
    expect(one(c, 'filters')).toHaveLength(0);
  });

  it('with a project: the grid is .sf-tiles with its hook, and there is no empty panel', async () => {
    await repo.saveProject(makeProject('a', 'Apollo'));
    const c = renderPage();
    await waitFor(() => expect(screen.getByText('Apollo')).toBeInTheDocument());
    const tiles = one(c, 'tiles');
    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.className).toBe('sf-tiles');
    expect(one(c, 'empty')).toHaveLength(0);
    expect(one(c, 'filters')).toHaveLength(0);
  });

  it('every project archived: the filter row (hooked) and the "All projects are archived." panel, no grid', async () => {
    await repo.saveProject(makeProject('a', 'Apollo', { archived: true }));
    const c = renderPage();
    await waitFor(() => expect(screen.getByText('All projects are archived. Select "Show archived (1)" to see them.')).toBeInTheDocument());
    const filters = one(c, 'filters');
    expect(filters).toHaveLength(1);
    expect(filters[0]!.className.split(/\s+/)).toContain('sf-below');
    expect(filters[0]!.textContent).toContain('Show archived (1)');
    expect(one(c, 'empty')).toHaveLength(1);
    expect(one(c, 'empty')[0]!.textContent).toBe('All projects are archived. Select "Show archived (1)" to see them.');
    // One plain line 16 px below the filter row, never the Welcome panel: the collection is not empty (v0.46.0).
    expect(one(c, 'empty')[0]!.tagName).toBe('P');
    expect(one(c, 'empty')[0]!.className.split(/\s+/)).toContain('sf-below');
    expect(one(c, 'empty')[0]!.className.split(/\s+/)).not.toContain('sf-empty');
    expect(one(c, 'tiles')).toHaveLength(0);
  });

  it('an archived project beside an active one: the filter row, then the grid, never an empty panel', async () => {
    await repo.saveProject(makeProject('a', 'Apollo'));
    await repo.saveProject(makeProject('z', 'Zephyr', { archived: true }));
    const c = renderPage();
    await waitFor(() => expect(screen.getByText('Apollo')).toBeInTheDocument());
    const [filters, tiles] = [one(c, 'filters')[0]!, one(c, 'tiles')[0]!];
    expect(filters.compareDocumentPosition(tiles) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(one(c, 'empty')).toHaveLength(0);
  });
});
