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
import { render, screen, waitFor, fireEvent, within, createEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import DashboardPage from '../page';
import { ToastProvider } from '@/components/Toast';
import { RateTable } from '@/features/settings/components/RateTable';

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

/**
 * The completion marker for a checklist step, read from the step's own <li>.
 *
 * ⚠️ Tests assert the MARKER ITSELF ('1' vs the check), never the ABSENCE of the
 * numeral. "Step 1 does not show a 1" is an absence, and an absence is satisfied
 * by the step — or the whole checklist — not rendering at all, which is exactly
 * what happens once a project exists.
 */
function stepMarker(linkText: string): string {
  const li = screen.getByText(linkText).closest('li');
  if (!li) throw new Error(`no <li> found for step "${linkText}"`);
  return (li.querySelector('span')?.textContent ?? '').trim();
}

/** What the Settings page renders for the rate table, with the props it passes. */
function renderRateTable() {
  return render(
    <RateTable
      rates={[{ role: 'BA', hourlyRate: 75 }]}
      onUpdate={() => {}}
      onRenameRole={async () => true}
      countOrphansIfDeleted={async () => 0}
    />,
  );
}

/** The card root is the `draggable` element; find it via the project's heading. */
function cardFor(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: new RegExp(name) });
  const card = heading.closest('[draggable]');
  if (!card) throw new Error(`no draggable card found for "${name}"`);
  return card as HTMLElement;
}

/** jsdom lays nothing out; every rect is all-zero unless injected. */
function stubRect(el: HTMLElement, r: { left: number; top: number; width: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({ ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => ({}) }) as DOMRect;
}

/**
 * jsdom implements no `DragEvent`, so `fireEvent.drop(el, { clientX })` falls back
 * to a plain `Event` and SILENTLY DISCARDS the coordinates — they arrive
 * `undefined` and every distance becomes NaN, with no error. Define them
 * explicitly on the event.
 */
function dropAt(el: Element, clientX: number, clientY: number) {
  const event = createEvent.drop(el, { dataTransfer: dragStub() });
  Object.defineProperty(event, 'clientX', { value: clientX });
  Object.defineProperty(event, 'clientY', { value: clientY });
  fireEvent(el, event);
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

/**
 * WI-3 (v0.37.16) — the Getting Started checklist could never complete step 1.
 *
 * ⚠️ PLACED HERE AS A SIBLING OF THE ONBOARDING TEST ABOVE, NOT APPENDED AT EOF.
 * The `beforeEach` on line 124 is at FILE scope, outside all of these blocks, so
 * an appended block would in fact still inherit it — measured, because the
 * general warning is about files with an OUTER describe, and this file has none.
 * Kept adjacent anyway: it groups the onboarding concern, and costs nothing.
 */
describe('DashboardPage — Getting Started checklist', () => {
  it('completes step 1 end to end: following the link opens the rate table, which marks the step done', async () => {
    // [FAILS-TODAY] Against v0.37.15 this fails at the FIRST Settings assertion:
    // the link was a bare `/settings`, so the user landed with the Labor Rate
    // Table COLLAPSED, `onOpen` never fired, the flag was never written, and the
    // step stayed at '1'. Reproduced in a production build before the fix.
    const dash = renderDashboard();
    await waitFor(() => expect(screen.getByText('Getting Started')).toBeInTheDocument());
    expect(stepMarker('Review Labor Rates')).toBe('1');

    // The rendered href is the observable — deliberately NOT the exported
    // constant, which would only assert the constant equals itself.
    const href = screen.getByText('Review Labor Rates').getAttribute('href');
    expect(href).toBe('/settings?section=rates');
    dash.unmount();

    // Follow it. jsdom has no router, so put the document at that URL and mount
    // what the Settings page renders there.
    window.history.replaceState({}, '', href as string);
    const settings = renderRateTable();

    // The half the user actually complained about: it is OPEN on arrival.
    expect(screen.getByText('Hourly Rate ($)')).toBeInTheDocument();
    settings.unmount();

    // …and going back shows the step COMPLETED.
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Getting Started')).toBeInTheDocument());
    expect(stepMarker('Review Labor Rates')).toBe('\u2713');
  });

  it('step 2 completes from live pool state, and does not drag step 1 along with it', async () => {
    // [REGRESSION] Step 2 is `pool.length > 0`, derived state with no stored
    // flag. Asserting step 1 is STILL '1' in the same fixture is what keeps the
    // two steps independent — a fix that marked everything reviewed would pass
    // an assertion about step 2 alone.
    await repo.saveTeamPool([{ id: 'p1', name: 'Alice', role: 'BA' }]);
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Getting Started')).toBeInTheDocument());

    expect(stepMarker('Build Your Team Pool')).toBe('\u2713');
    expect(stepMarker('Review Labor Rates')).toBe('1');
  });

  it('the checklist disappears once the first project exists', async () => {
    // [REGRESSION] The other half of the empty-state contract. The all-archived
    // half is pinned separately below and is deliberately not duplicated here.
    await repo.saveProject(makeProject('a', 'Apollo'));
    renderDashboard();

    await waitFor(() => expect(screen.getByText('Apollo')).toBeInTheDocument());
    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
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

  /**
   * ⚠️ THIS TEST IS NEW RATHER THAN A TWEAK OF THE TWO ABOVE, AND THE REASON IS
   * THE WHOLE POINT OF IT. Both existing tests drop on a CARD, so they never
   * enter the container path at all — mutating the container to resolve a
   * POSITION instead of an id leaves both of them green. They guard the card
   * half of the full-list/visible-list bridge; nothing guarded the container
   * half, because until v0.37.17 there was no container half.
   *
   * The fixture inherits the seeded-FIRST discipline from the test above for the
   * same v0.37.12 reason, and adds one of its own: with 'z' hidden, Borealis sits
   * at VISIBLE index 1 and FULL index 2. Those two numbers must differ, or a
   * position-based container would produce the right answer by accident and this
   * test would prove nothing.
   */
  it('a drop in EMPTY GRID SPACE reorders by id, with a hidden archived project intact', async () => {
    await repo.saveProject(makeProject('z', 'Zephyr', { archived: true }));
    await repo.saveProject(makeProject('a', 'Apollo'));
    await repo.saveProject(makeProject('b', 'Borealis'));

    renderDashboard();
    await waitFor(() => expect(screen.getByText('Apollo')).toBeInTheDocument());
    expect(screen.queryByText('Zephyr')).not.toBeInTheDocument();

    const apollo = cardFor('Apollo');
    const borealis = cardFor('Borealis');
    const grid = apollo.parentElement;
    if (!grid) throw new Error('no grid container');

    // Two visible cards in row 1 of a 3-column grid; the third cell is empty.
    // jsdom lays nothing out, so the rects are injected — see the header of
    // useDragReorder.test.tsx for why that is a precondition, not a shortcut.
    stubRect(apollo, { left: 256, top: 340, width: 373, height: 174 });
    stubRect(borealis, { left: 645, top: 340, width: 373, height: 174 });

    fireEvent.dragStart(apollo, { dataTransfer: dragStub() });
    dropAt(grid, 1221, 427); // the empty third cell — owned by no card

    await waitFor(async () => {
      const ids = (await repo.getProjects()).map((p) => p.id);
      expect(ids.indexOf('a')).toBeGreaterThan(ids.indexOf('b'));
    });

    const stored = await repo.getProjects();
    // Resolved by ID: target 'b' is at FULL index 2, so Apollo lands last.
    // Resolved by POSITION it would be visible index 1 -> full ids[1] === 'a',
    // the dragged project itself, and handleDrop would return without reordering.
    expect(stored.map((p) => p.id), 'container must resolve an id, never an index').toEqual(['z', 'b', 'a']);
    expect(stored.find((p) => p.id === 'z')?.archived).toBe(true);
  });

  /**
   * The guard TypeScript cannot give. `ProjectCard` destructures a fixed prop
   * list with no `...rest`, and JSX spreads skip excess-property checking, so an
   * undeclared prop compiles clean and is silently dropped. `handlersFor` has
   * returned `draggable: true` in exactly that state for many releases — invisible
   * only because ProjectCard hardcodes the same value (disposition at
   * ProjectCard.tsx). If `data-drag-id` regressed the same way, the container
   * would hit-test nothing, every unit test above would stay green, and the fix
   * would silently become a no-op.
   */
  it('every rendered card carries data-drag-id in the DOM', async () => {
    await repo.saveProject(makeProject('a', 'Apollo'));
    await repo.saveProject(makeProject('b', 'Borealis'));

    renderDashboard();
    await waitFor(() => expect(screen.getByText('Apollo')).toBeInTheDocument());

    const grid = cardFor('Apollo').parentElement;
    expect(grid?.querySelectorAll('[data-drag-id]')).toHaveLength(2);
    expect(cardFor('Apollo').getAttribute('data-drag-id')).toBe('a');
    expect(cardFor('Borealis').getAttribute('data-drag-id')).toBe('b');
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
