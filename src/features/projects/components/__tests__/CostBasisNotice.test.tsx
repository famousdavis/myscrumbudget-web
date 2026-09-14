// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The two cost-basis signals (v0.41.0) — acceptance rows A1–A7 and B1–B4.
 *
 * ⚠️ WHY THE COMPONENT RESOLVES `effectiveLaborRates` ITSELF rather than taking
 * the rates as a prop: there is no project-detail-page test host, and v0.37.5
 * measured that standing one up costs more than the item it would guard. Had the
 * page computed the basis and passed it down, row A4 ("evaluates against the
 * PUBLISHED card") would be a test of a value the fixture supplied — vacuous, and
 * the v0.37.6 gap verbatim. Resolving inside the component makes A4 a real
 * property of the component. What remains untested is ONE page line, typechecked;
 * that residual is stated at the page, not claimed closed.
 *
 * ⚠️⚠️ ROW D1 IS DELIBERATELY ABSENT FROM THIS FILE, AND THE REASON CHANGED WHEN
 * IT WAS MEASURED. The plan was "`RoleSelect.test.tsx` already asserts it, so a
 * duplicate would be vacuous". The mutation says something stronger and less
 * comfortable: removing `RoleSelect`'s `value !== ''` guard fails NOTHING and
 * produces a byte-identical DOM, because `''` is falsy at the two JSX sites that
 * consume `orphanedRole`. No test can discriminate the two builds, so a D1 test
 * here would be vacuous BY CONSTRUCTION rather than by duplication. The full
 * finding is at `RoleSelect.tsx`; the v0.37.6 defect class itself is pinned by
 * the `?? []` mutation, which fails nine tests across six files.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Project, Settings, TeamMember, LaborRate, CostSnapshot } from '@/types/domain';
import type { ProjectWithOwnership } from '@/lib/utils/costSnapshot';
import { AllocationGrid } from '@/features/reforecast/components/AllocationGrid';
import { CostBasisNotice } from '../CostBasisNotice';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

/*
 * ⚠️ `isCloud` COMES FROM THE PROVIDER, NOT FROM `getStorageMode()`, and the
 * distinction is a defect the browser found in this component's first build —
 * see the note at `CostBasisNotice.tsx`. `RepositoryProvider` derives
 * `mode === 'cloud' && uid !== null`, so setting the storage-mode key alone is
 * NOT the state under test. Row B5 is the case that separates them.
 */
const repoContext = vi.hoisted(() => ({ isCloud: true }));
vi.mock('@/components/RepositoryProvider', () => ({
  useRepository: () => ({
    repository: {}, mode: repoContext.isCloud ? 'cloud' : 'local',
    isCloud: repoContext.isCloud, switchMode: vi.fn(),
  }),
}));

const ROSTER: TeamMember[] = [
  { id: 'tm-1', name: 'Alice', role: 'BA' },
  { id: 'tm-2', name: 'Bob', role: 'Dev' },
  { id: 'tm-3', name: 'Cara', role: 'Ops' },
];

const rates = (...roles: string[]): LaborRate[] =>
  roles.map((role) => ({ role, hourlyRate: 100 }));

const settingsWith = (laborRates: LaborRate[]): Settings => ({
  laborRates,
  holidays: [],
  discountRateAnnual: 0.03,
  trafficLightThresholds: { amberPercent: 5, redPercent: 10, violetPercent: 20 },
});

const card = (laborRates: LaborRate[]): CostSnapshot => ({
  laborRates,
  holidays: [],
  discountRateAnnual: 0.07,
});

function project(over: Partial<Project> & { _isOwner?: true } = {}): Project {
  const { _isOwner, ...rest } = over;
  const p: ProjectWithOwnership = {
    id: 'p1',
    name: 'Shared project',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    reforecasts: [],
    activeReforecastId: null,
    ...rest,
  };
  if (_isOwner) p._isOwner = true;
  return p;
}

/** Presence/absence by identity. The COPY is asserted separately, by exact text. */
const unpriced = () => document.querySelector('[data-signal="unpriced-roles"]');
const noCard = () => document.querySelector('[data-signal="no-rate-card"]');

const UNPRICED_3 = "3 team members' roles have no labor rate, so they are costed at $0.";
const UNPRICED_2 = "2 team members' roles have no labor rate, so they are costed at $0.";
const UNPRICED_1 = "1 team member's role has no labor rate, so they are costed at $0.";
const NO_CARD = 'This project has no published rate card, so you are seeing your own rates.';

beforeEach(() => {
  localStorage.clear();
  repoContext.isCloud = true;
});

describe('item 1 — the unpriced-roles aggregate', () => {
  it('[A1] counts the roster roles the published card does not price, and agrees with the grid', () => {
    // ⚠️ THE GRID IS RENDERED ALONGSIDE ON PURPOSE. The aggregate is only
    // trustworthy if it names the same members the per-row markers do; a count
    // asserted on its own could drift from the markers beside it with nothing
    // to say so. This is the only row that pins the agreement.
    const p = project({ _costSnapshot: card(rates('BA')) });
    render(
      <>
        <CostBasisNotice project={p} settings={settingsWith(rates('BA'))} members={ROSTER} />
        <AllocationGrid
          months={['2026-01']}
          teamMembers={ROSTER}
          allocationMap={new Map()}
          onAllocationChange={vi.fn()}
          onAllocationsChange={vi.fn()}
          pool={[]}
          laborRates={p._costSnapshot!.laborRates}
        />
      </>,
    );

    expect(screen.getByText(UNPRICED_2), 'N = 2, counted over the ROSTER').toBeDefined();
    // The two roles the card does not price wear the marker; the one it does, does not.
    expect(screen.getByText('(Dev)').className, 'Dev is marked').toContain('text-red-600');
    expect(screen.getByText('(Ops)').className, 'Ops is marked').toContain('text-red-600');
    expect(screen.getByText('(BA)').className, 'BA is NOT marked').not.toContain('text-red-600');
  });

  it('[A2] renders NOTHING at N = 0 — the element is absent, not empty', () => {
    render(
      <CostBasisNotice
        project={project({ _costSnapshot: card(rates('BA')) })}
        settings={settingsWith(rates('BA'))}
        members={[ROSTER[0]]}
      />,
    );
    expect(unpriced(), 'a component that always renders "0 team members…" fails here').toBeNull();
    expect(screen.queryByText(/team member/), 'and no count sentence is on screen').toBeNull();
  });

  it('[A3] renders NOTHING while the rates are still loading, and flags NOBODY', () => {
    // ⚠️ `settings` null AND no card, so `effectiveLaborRates` is `undefined`.
    // The wrong build is `?? []`, which makes every role unpriced mid-fetch —
    // the v0.37.6 defect. This page discards `useSettings`' `loading`, so this
    // is a real first render, not a hypothetical.
    render(<CostBasisNotice project={project()} settings={null} members={ROSTER} />);
    expect(unpriced(), 'undefined means "not loaded", which flags nobody').toBeNull();
    // ⚠️ THE NO-CARD LINE IS A DIFFERENT MATTER AND MUST STILL SHOW: it does not
    // depend on the rates having loaded, and suppressing it here would make the
    // frame arrive later than the thing it frames.
    expect(noCard(), 'item 2 does not wait on settings').not.toBeNull();
  });

  it('[A4] evaluates against the PUBLISHED card, not the reader’s own settings', () => {
    // The reader prices all three roles; the card prices one. Reading
    // `settings.laborRates` directly would report 0 while the grid shows two
    // red rows.
    render(
      <CostBasisNotice
        project={project({ _costSnapshot: card(rates('BA')) })}
        settings={settingsWith(rates('BA', 'Dev', 'Ops'))}
        members={ROSTER}
      />,
    );
    expect(screen.getByText(UNPRICED_2), 'N = 2 from the card, not 0 from the reader').toBeDefined();
  });

  it('[A5] the majority cell — a collaborator with NO card sees BOTH signals in one render', () => {
    // ⚠️⚠️ TWO DUTIES, DIFFERENT INSTRUMENT CLASSES, DELIBERATELY NOT SPLIT INTO
    // TWO TESTS. Co-presence is this row's unique duty and it only exists inside
    // a single render: B1 covers item 2 alone, A1/A4 cover the arithmetic alone.
    //
    //   DUTY 1 is a PRECONDITION, and it REFUSES NOTHING in this diff — with no
    //   card, `effectiveLaborRates` IS the reader's settings, so N = 1 under the
    //   correct build and under "item 1 alone" alike. It is here because without
    //   it, duty 2 passes with item 1 ABSENT and co-presence is not established.
    //
    //   DUTY 2 is the only half that refuses anything, and it is the ONLY guard
    //   on the coupling: item 1's count in this cell describes the READER, not
    //   the project, and item 2's line is what stops that being a misdiagnosis.
    //   The reason lives in production code at `CostBasisNotice.tsx`; deleting
    //   this assertion to get the row green removes the whole guarantee.
    render(
      <CostBasisNotice
        project={project()}
        settings={settingsWith(rates('BA', 'Dev'))}
        members={ROSTER}
      />,
    );
    expect(screen.getByText(UNPRICED_1), 'DUTY 1 (precondition): item 1 IS rendering, at N = 1').toBeDefined();
    expect(screen.getByText(NO_CARD), 'DUTY 2 (the composition guard): and item 2 frames it').toBeDefined();
  });

  it('[A6] a PUBLISHED card with no usable rates suppresses item 1 — the markers carry it', () => {
    // ⚠️ REACHABLE, and through the real read path: `sanitizeCostSnapshot`'s
    // element-drop rule yields `laborRates: []` from a card written non-empty.
    // Suppressed because the count would be the whole roster with no frame —
    // item 2 is correctly silent, a card IS present.
    const p = project({ _costSnapshot: card([]) });
    render(
      <>
        <CostBasisNotice project={p} settings={settingsWith(rates('BA', 'Dev'))} members={ROSTER} />
        <AllocationGrid
          months={['2026-01']}
          teamMembers={ROSTER}
          allocationMap={new Map()}
          onAllocationChange={vi.fn()}
          onAllocationsChange={vi.fn()}
          pool={[]}
          laborRates={[]}
        />
      </>,
    );

    expect(unpriced(), 'shipping the maximal count with no frame is the wrong build').toBeNull();
    expect(noCard(), 'and item 2 stays silent — a card IS published').toBeNull();
    // What the user DOES get, and the whole reason silence is honest here.
    for (const role of ['BA', 'Dev', 'Ops']) {
      expect(screen.getByText(`(${role})`).className, `${role} still wears the marker`)
        .toContain('text-red-600');
    }
  });

  it('[A7] the READER’s own card is empty — same count, opposite handling', () => {
    // ⚠️⚠️ THE ROW THAT MAKES CLAUSE 1 LOAD-BEARING. Identical basis (`[]`) and
    // identical count (3) to A6, and the opposite disposition, because there is
    // no published card: item 2 fires and frames it, so item 1 must NOT be
    // suppressed. Measured: the one-clause form ("suppress on an empty BASIS")
    // suppresses A6 AND this row. Nothing else in the table refuses it.
    //
    // Reachable: `RateTable.confirmDelete` has no last-row guard, so a reader
    // really can delete their way to an empty rate table.
    render(<CostBasisNotice project={project()} settings={settingsWith([])} members={ROSTER} />);

    expect(screen.getByText(UNPRICED_3), 'item 1 shows the full count').toBeDefined();
    expect(screen.getByText(NO_CARD), 'and item 2 frames it').toBeDefined();
  });

  it('[copy] both number forms are exact — singular agrees, plural agrees', () => {
    // ⚠️ EXACT STRINGS, NOT `toContain`. v0.38.0 shipped "1 unreadable entry WAS
    // left out because THEY could not be read" past an assertion that stopped
    // before the disagreement, at two sites.
    const { unmount } = render(
      <CostBasisNotice project={project()} settings={settingsWith(rates('Dev', 'Ops'))} members={ROSTER} />,
    );
    expect(unpriced()!.textContent, 'singular').toBe(UNPRICED_1);
    unmount();

    render(<CostBasisNotice project={project()} settings={settingsWith([])} members={ROSTER} />);
    expect(unpriced()!.textContent, 'plural').toBe(UNPRICED_3);
  });
});

describe('item 2 — the "no published rate card" line', () => {
  it('[B1] fires for a collaborator on a project with no card', () => {
    render(<CostBasisNotice project={project()} settings={settingsWith(rates('BA', 'Dev', 'Ops'))} members={ROSTER} />);
    expect(noCard()!.textContent).toBe(NO_CARD);
  });

  it('[B2] is suppressed for the OWNER', () => {
    // ⚠️ Gating on the card alone would tell a REFUSED owner — one whose own
    // rate table is unsaved, so their save publishes nothing — that "this
    // project has no published rate card", on their own project, with no action
    // available to them. That is the false-positive direction.
    render(
      <CostBasisNotice
        project={project({ _isOwner: true })}
        settings={settingsWith(rates('BA', 'Dev', 'Ops'))}
        members={ROSTER}
      />,
    );
    expect(noCard()).toBeNull();
  });

  it('[B5] is suppressed when the mode says cloud but nobody is signed in', () => {
    // ⚠️⚠️ THE ROW THE BROWSER EARNED. `RepositoryProvider` serves the
    // LOCALSTORAGE repository whenever `uid` is null, so "mode is still cloud,
    // the session has ended" is a state where every project is local, carries no
    // card and no ownership flag — and a gate written as
    // `getStorageMode() === 'cloud'` lets all three conditions through. Measured
    // on `next start`: the first build rendered the line on a purely local
    // project in exactly this state.
    //
    // ⚠️⚠️ THE STORAGE-MODE KEY IS SEEDED DELIBERATELY, AND IT IS INERT UNDER THE
    // CORRECT BUILD — that is the whole construction. The component no longer
    // reads localStorage, so this seed changes nothing today; it exists so the
    // fixture can DISAGREE with the provider. Swap the gate back to
    // `getStorageMode() === 'cloud'` and this row fails while B3 still passes,
    // because under B3's fixture the two sources agree. Without the seed the two
    // rows would be the same assertion written twice.
    localStorage.setItem('msb:storageMode', 'cloud');
    repoContext.isCloud = false;
    render(<CostBasisNotice project={project()} settings={settingsWith(rates('BA'))} members={ROSTER} />);
    expect(noCard(), 'a storage-mode-only gate fires here on a local project').toBeNull();
  });

  it('[B3] is suppressed in LOCAL mode', () => {
    // ⚠️⚠️ THE PRECONDITION, AND ITS WRONG BUILD IS NOT "SLIGHTLY TOO WIDE".
    // In local mode nothing ever attaches `_isOwner`, so the owner gate above is
    // INERT — true for every local reader including the sole owner — and no
    // local project carries a `_costSnapshot`. Both of the other conditions are
    // vacuously true, so dropping the mode gate does not widen the line: it
    // fires on every local project forever with both safety arguments gone.
    repoContext.isCloud = false;
    render(<CostBasisNotice project={project()} settings={settingsWith(rates('BA'))} members={ROSTER} />);
    expect(noCard(), 'no mode gate fires on every local project forever').toBeNull();
    // Item 1 is NOT mode-gated and correctly still shows: in local mode the
    // reader's rates ARE the rates, so the count describes the project.
    expect(unpriced(), 'item 1 has no mode gate, deliberately').not.toBeNull();
  });

  it('[B4] is suppressed when a card IS published', () => {
    render(
      <CostBasisNotice
        project={project({ _costSnapshot: card(rates('BA', 'Dev', 'Ops')) })}
        settings={settingsWith(rates('BA'))}
        members={ROSTER}
      />,
    );
    expect(noCard(), 'an inverted condition fails here').toBeNull();
    expect(unpriced(), 'and nothing is unpriced against the card').toBeNull();
  });
});
