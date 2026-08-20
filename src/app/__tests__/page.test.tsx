// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * First tests for `DashboardPage`. Until now `src/app/` had no test file at all:
 * the route components were a whole layer no instrument in the code-quality
 * campaign reached — 0 of 40 branches covered here, against 17 commits to this
 * function body, the highest churn of any complexity finding in the repo.
 *
 * These are CHARACTERISATION tests. They pin what the page does today so a
 * future change has something to disagree with; they are not a specification,
 * and where behaviour looks odd it is recorded rather than corrected.
 *
 * The headline case is the v0.34.0 archiving invariant, which until now was
 * guarded only by a comment. `useDragReorder` is bound to the FULL project list
 * and must never be bound to the archived-filtered subset, because
 * `reorderProjects` rebuilds storage from exactly the ids it is handed — a
 * filtered drag would permanently DELETE every hidden archived project. The
 * storage half of that is already characterised in localStorage.test.ts; the
 * composition half — which list the Dashboard actually passes — is here.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import DashboardPage from '../page';
import { ToastProvider } from '@/components/Toast';

// DashboardPage and its hooks take the repository from provider context. These
// tests drive the REAL localStorage repository and assert on persisted state,
// so the seam yields one shared instance — see the note in useProject.test.ts.
const { repo } = await vi.hoisted(async () => {
  const { createLocalStorageRepository } = await import('@/lib/storage/localStorage');
  return { repo: createLocalStorageRepository() };
});
vi.mock('@/components/RepositoryProvider', () => {
  const value = { repository: repo, mode: 'local' as const, isCloud: false, switchMode: vi.fn() };
  return { useRepository: () => value };
});
import type { Project } from '@/types/domain';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: unknown; children: ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}));

function makeProject(id: string, name: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    name,
    startDate: '2026-06-15',
    endDate: '2027-07-15',
    activeReforecastId: 'rf-1',
    reforecasts: [
      {
        id: 'rf-1',
        name: 'Baseline',
        createdAt: '2026-06-01T00:00:00Z',
        startDate: '2026-06-15',
        endDate: '2027-07-15',
        reforecastDate: '2026-06-01',
        assignments: [],
        allocations: [],
        productivityWindows: [],
        actualCost: 0,
        baselineBudget: 100000,
      },
    ],
    ...overrides,
  };
}

/**
 * jsdom has no `DataTransfer` constructor, so React's synthetic drag events
 * arrive with `dataTransfer` undefined and `useDragReorder` throws on
 * `e.dataTransfer.effectAllowed`. Passing a stub through the event init is the
 * supported way round it — the limitation is jsdom's, not the component's.
 */
function dragStub() {
  return { setData: () => {}, effectAllowed: '', dropEffect: '' };
}

function renderDashboard() {
  return render(
    <ToastProvider>
      <DashboardPage />
    </ToastProvider>,
  );
}

/** The card root is the `draggable` element; find it via the project's heading. */
function cardFor(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: new RegExp(name) });
  const card = heading.closest('[draggable]');
  if (!card) throw new Error(`no draggable card found for "${name}"`);
  return card as HTMLElement;
}

beforeEach(async () => {
  localStorage.clear();
  await repo.clear();
});

describe('DashboardPage — project grid', () => {
  it('renders a card per project once loading resolves', async () => {
    await repo.saveProject(makeProject('a', 'Apollo'));
    await repo.saveProject(makeProject('b', 'Borealis'));
    renderDashboard();

    await waitFor(() => expect(screen.getByText('Apollo')).toBeInTheDocument());
    expect(screen.getByText('Borealis')).toBeInTheDocument();
  });

  it('shows the Getting Started onboarding guide when there are no projects at all', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Getting Started')).toBeInTheDocument());
    expect(screen.getByText('Review Labor Rates')).toBeInTheDocument();
  });
});

describe('DashboardPage — archived projects', () => {
  it('hides archived projects by default and offers a toggle naming the count', async () => {
    await repo.saveProject(makeProject('a', 'Apollo'));
    await repo.saveProject(makeProject('z', 'Zephyr', { archived: true }));
    renderDashboard();

    await waitFor(() => expect(screen.getByText('Apollo')).toBeInTheDocument());
    expect(screen.queryByText('Zephyr')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Show archived \(1\)/)).toBeInTheDocument();
  });

  it('reveals archived projects when the toggle is checked', async () => {
    await repo.saveProject(makeProject('a', 'Apollo'));
    await repo.saveProject(makeProject('z', 'Zephyr', { archived: true }));
    renderDashboard();

    await waitFor(() => expect(screen.getByText('Apollo')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/Show archived/));

    expect(screen.getByText('Zephyr')).toBeInTheDocument();
  });

  it('shows the all-archived empty state, NOT the onboarding guide', async () => {
    // Regression guard for the v0.34.0 fix: archiving your only project used to
    // resurrect the Getting Started checklist, which reads as data loss.
    await repo.saveProject(makeProject('z', 'Zephyr', { archived: true }));
    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText('All projects are archived.')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
  });
});

describe('DashboardPage — drag-to-reorder is bound to the FULL project list', () => {
  it('reorders visible projects without deleting a hidden archived one', async () => {
    // THE v0.34.0 INVARIANT. Until now this was guarded only by a comment at
    // page.tsx:54-57. If `useDragReorder` were ever rebound to `visibleProjects`,
    // this drag would hand reorderProjects only ['b','a'] and 'z' would be gone
    // from storage forever — silently, with no error and nothing on screen.
    await repo.saveProject(makeProject('a', 'Apollo'));
    await repo.saveProject(makeProject('b', 'Borealis'));
    await repo.saveProject(makeProject('z', 'Zephyr', { archived: true }));

    renderDashboard();
    await waitFor(() => expect(screen.getByText('Apollo')).toBeInTheDocument());
    // Zephyr is hidden — this is precisely the dangerous state.
    expect(screen.queryByText('Zephyr')).not.toBeInTheDocument();

    fireEvent.dragStart(cardFor('Apollo'), { dataTransfer: dragStub() });
    fireEvent.drop(cardFor('Borealis'), { dataTransfer: dragStub() });

    // ⚠️ Wait for the REORDER to land before asking whether anything was lost.
    // Waiting on the id set instead is a race that passes for the wrong reason:
    // at the first poll the write has not happened yet, so all three ids are
    // still present and the assertion succeeds before the damage occurs. Found
    // by falsifying this test — with the drag deliberately bound to the filtered
    // list it failed on the NEXT line instead of this one.
    await waitFor(async () => {
      const ids = (await repo.getProjects()).map((p) => p.id);
      expect(ids.indexOf('a')).toBeGreaterThan(ids.indexOf('b'));
    });

    const stored = await repo.getProjects();
    expect(stored.map((p) => p.id).sort()).toEqual(['a', 'b', 'z']);
    expect(stored.find((p) => p.id === 'z')?.archived).toBe(true);
  });

  it('survives a reorder while archived projects are VISIBLE too', async () => {
    await repo.saveProject(makeProject('a', 'Apollo'));
    await repo.saveProject(makeProject('b', 'Borealis'));
    await repo.saveProject(makeProject('z', 'Zephyr', { archived: true }));

    renderDashboard();
    await waitFor(() => expect(screen.getByText('Apollo')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/Show archived/));

    fireEvent.dragStart(cardFor('Apollo'), { dataTransfer: dragStub() });
    fireEvent.drop(cardFor('Zephyr'), { dataTransfer: dragStub() });

    // Same ordering discipline as above: prove the write landed, then check for loss.
    await waitFor(async () => {
      const ids = (await repo.getProjects()).map((p) => p.id);
      expect(ids.indexOf('a')).toBeGreaterThan(ids.indexOf('z'));
    });

    expect((await repo.getProjects()).map((p) => p.id).sort()).toEqual(['a', 'b', 'z']);
  });
});

describe('DashboardPage — delete confirmation', () => {
  it('asks before deleting and names the project', async () => {
    await repo.saveProject(makeProject('a', 'Apollo'));
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Apollo')).toBeInTheDocument());

    fireEvent.click(within(cardFor('Apollo')).getByLabelText(/Delete/i));

    expect(screen.getByText('Delete Project')).toBeInTheDocument();
    expect(await repo.getProjects()).toHaveLength(1);
  });

  it('cancelling leaves the project in storage', async () => {
    await repo.saveProject(makeProject('a', 'Apollo'));
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Apollo')).toBeInTheDocument());

    fireEvent.click(within(cardFor('Apollo')).getByLabelText(/Delete/i));
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(await repo.getProjects()).toHaveLength(1);
  });
});
