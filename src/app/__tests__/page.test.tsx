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
 * and must never be bound to the archived-filtered subset. The storage half of
 * that is characterised in localStorage.test.ts; the composition half — which
 * list the Dashboard actually passes — is here.
 *
 * ⚠️ THE MECHANISM CHANGED AT v0.37.12 AND THIS HEADER USED TO STATE THE OLD ONE
 * — that the localStorage implementation kept only the ids it was handed, so a
 * filtered drag destroyed every hidden archived project outright. True when
 * written, false now: that implementation appends the ids it was NOT handed. A
 * filtered drag no longer deletes; it silently moves every hidden archived
 * project to the END of the order. The rule survives, guarding ORDER not
 * existence.
 *
 * ⚠️ THE OLD WORDING IS DELIBERATELY PARAPHRASED HERE RATHER THAN QUOTED. Quoting
 * it put the retired phrasing back into `src/` verbatim, where the release grep
 * for stale drop-semantics prose matched MY OWN CORRECTION and read 2 instead of
 * 0 — the third time in this campaign a site-count grep has counted its own
 * documentation. A criterion that needs a human to excuse two hits is a weaker
 * instrument than one that reads zero.
 *
 * ⚠️⚠️ AND THE TEST BELOW WENT VACUOUS UNDER THAT FIX WITHOUT ANYONE TOUCHING IT.
 * Its fixture seeded the archived project LAST — the one position where "appended
 * to the end" and "left where it was" are the same list — and its assertion was
 * a `.sort()`ed SET. Both halves had to be repaired: seed `z` FIRST, and assert
 * the FULL ORDER. Measured: with the fix and the old fixture, binding the drag to
 * the filtered list made the whole file pass (9/9) while the caller bug was
 * present. An order-exact assertion ALONE would not have caught it either.
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
    // THE v0.34.0 INVARIANT, guarded by a comment at page.tsx:66-69 and by this
    // test. If `useDragReorder` were ever rebound to `visibleProjects`, this drag
    // would hand reorderProjects only ['b','a'].
    //
    // ⚠️ FIXTURE ORDER IS LOAD-BEARING — 'z' MUST BE SEEDED FIRST, and this is
    // not tidiness. Since v0.37.12 an unhandled id is APPENDED rather than
    // dropped, so with 'z' seeded last the correct binding and the filtered
    // binding produce the IDENTICAL list ['b','a','z'] and no assertion over it,
    // ordered or not, can tell them apart. Seeded first, the correct binding
    // gives ['z','b','a'] and the filtered one gives ['b','a','z'].
    //
    // ⚠️ AND THE ASSERTION MUST BE THE FULL ORDER, not a `.sort()`ed set: a set
    // assertion tests existence, which appending now guarantees for EVERY caller.
    // Both halves are required; either alone passes under the filtered binding.
    await repo.saveProject(makeProject('z', 'Zephyr', { archived: true }));
    await repo.saveProject(makeProject('a', 'Apollo'));
    await repo.saveProject(makeProject('b', 'Borealis'));

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
    expect(stored.map((p) => p.id)).toEqual(['z', 'b', 'a']);
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
