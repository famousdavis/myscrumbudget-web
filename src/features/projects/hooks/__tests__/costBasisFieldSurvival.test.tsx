// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/*
 * Row A8 (v0.41.0) — the two fields `CostBasisNotice` gates on must survive an
 * edit, and the consequence of their not surviving is asserted in the DOM.
 *
 * ⚠️ WHY A COMPOSED HOST AND NOT A COMPONENT TEST. The property is about what
 * `updateProject` does to a project, so nothing that renders the component with
 * a hand-built fixture can see it. This composes the REAL `useProject` (real
 * reducer, real debounce, real localStorage repository) with the REAL
 * `useReforecast`, and drives a REAL app updater — following
 * `undoGrouping.test.ts`. An updater written inside this file would be testing
 * my own spread, not the app's.
 *
 * ⚠️ [FALSIFY-AFTER] BY CONSTRUCTION, AND SAID PLAINLY: all nine updaters spread
 * `prev` today (`edit/page.tsx:124`, `useTeam.ts:47/60/75` via
 * `withActiveReforecast`, `useReforecast.ts:113/189/205/272`,
 * `ResourcePlanExcelPanel.tsx:150`), so NOTHING IN THIS DIFF CAN BREAK THIS ROW.
 * It is a regression guard against a future updater that REBUILDS, and its value
 * is that nothing else in the repository guards either field this way.
 *
 * ⚠️ BOTH FIELDS, and `_isOwner` is the one that matters more. A lost
 * `_costSnapshot` makes the line appear on a correctly-published project — a
 * false positive mid-edit. A lost `_isOwner` makes it appear on a REFUSED
 * owner's OWN project, where the sentence is about a card they cannot publish
 * and cannot act on. That is the same failure pointed at the one population with
 * no remedy.
 *
 * ⚠️ A MIXED FIXTURE, STATED RATHER THAN HIDDEN: the mocked provider reports
 * `isCloud: true` while the repository it hands out is the LOCAL one. That is
 * deliberate — the point of these two tests is what an UPDATER does to a project
 * object, which is repository-independent, and reporting cloud is what lets the
 * DOM half of each assertion be meaningful. It is not a claim that this is a
 * cloud session.
 *
 * ⚠️ AN EARLIER DRAFT OF THIS NOTE SAID THE COMPONENT READS `getStorageMode()`
 * AND SET THE STORAGE-MODE KEY TO MATCH. It no longer does: the browser pass
 * found that a storage-mode read is a weaker proxy than the provider's
 * `isCloud`, and the gate moved. Corrected here in the same session rather than
 * left as a true-sounding sentence about a mechanism that is gone.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor, render } from '@testing-library/react';
import { useProject } from '../useProject';
import { useReforecast } from '@/features/reforecast/hooks/useReforecast';
import { CostBasisNotice } from '@/features/projects/components/CostBasisNotice';
import type { Project, Settings } from '@/types/domain';
import type { ProjectWithOwnership } from '@/lib/utils/costSnapshot';

const { repo } = await vi.hoisted(async () => {
  const { createLocalStorageRepository } = await import('@/lib/storage/localStorage');
  return { repo: createLocalStorageRepository() };
});
vi.mock('@/components/RepositoryProvider', () => {
  const value = { repository: repo, mode: "cloud" as const, isCloud: true, switchMode: vi.fn() };
  return { useRepository: () => value };
});

const CARD = { laborRates: [{ role: 'BA', hourlyRate: 175 }], holidays: [], discountRateAnnual: 0.07 };

const SETTINGS: Settings = {
  laborRates: [{ role: 'BA', hourlyRate: 10 }],
  holidays: [],
  discountRateAnnual: 0.03,
  trafficLightThresholds: { amberPercent: 5, redPercent: 10, violetPercent: 20 },
};

function seed(over: Partial<Project> = {}): void {
  const p: Project = {
    id: 'p-survive',
    name: 'Carded',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    reforecasts: [{
      id: 'rf-1', name: 'Baseline', createdAt: '2026-01-01T00:00:00Z',
      startDate: '2026-01-01', endDate: '2026-12-31', reforecastDate: '2026-01-01',
      assignments: [], allocations: [], productivityWindows: [],
      actualCost: 0, baselineBudget: 1000,
    }],
    activeReforecastId: 'rf-1',
    ...over,
  };
  localStorage.setItem('msb:projects', JSON.stringify([p]));
}

/** The real useProject + the real useReforecast, composed as the page composes them. */
function useComposed() {
  const p = useProject('p-survive');
  const rf = useReforecast({ project: p.project, updateProject: p.updateProject });
  return { ...p, ...rf };
}

describe('[A8] the fields CostBasisNotice gates on survive a real updateProject cycle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('a PUBLISHED card survives an edit, and item 2’s line stays absent', async () => {
    seed({ _costSnapshot: CARD });
    const { result } = renderHook(() => useComposed());
    // ⚠️ `project` starts null and `updateProject` early-returns on null, so a
    // write before the load resolves is a silent no-op that reads as a pass.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.project?._costSnapshot, 'precondition: the card loaded').toEqual(CARD);

    // A REAL app updater, not one written here.
    await act(async () => { result.current.updateNotes('an edit'); });

    const after = result.current.project!;
    expect(after.reforecasts[0].notes, 'precondition: the edit landed').toBe('an edit');
    expect(after._costSnapshot, 'DUTY 1: the card is carried through, value-identical').toEqual(CARD);

    // DUTY 2: the consequence a reader can see. An updater that rebuilt instead
    // of spreading `prev` would drop the card and this line would appear
    // mid-edit on a correctly-published project.
    render(<CostBasisNotice project={after} settings={SETTINGS} members={[]} />);
    expect(
      document.querySelector('[data-signal="no-rate-card"]'),
      'DUTY 2: no "no published rate card" line on a project that has one',
    ).toBeNull();
  });

  it('the OWNERSHIP flag survives an edit, and a refused owner is still spared the line', async () => {
    // A REFUSED owner: owner of the project, no published card (their own rate
    // table is unsaved, so their save publishes nothing). `_isOwner` is the ONLY
    // thing suppressing the line for them.
    seed();
    const { result } = renderHook(() => useComposed());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // The flag is attached by `getProject` in cloud mode; the local repository
    // does not attach it, so it is applied here to model the state under test.
    await act(async () => {
      result.current.updateProject((prev) => {
        const p = { ...prev } as ProjectWithOwnership;
        p._isOwner = true;
        return p;
      });
    });
    expect((result.current.project as ProjectWithOwnership)._isOwner,
      'precondition: the reader is the owner').toBe(true);

    await act(async () => { result.current.updateNotes('an owner edit'); });

    const after = result.current.project!;
    expect(after.reforecasts[0].notes, 'precondition: the edit landed').toBe('an owner edit');
    expect((after as ProjectWithOwnership)._isOwner,
      'DUTY 1: the ownership flag is carried through').toBe(true);

    render(<CostBasisNotice project={after} settings={SETTINGS} members={[]} />);
    expect(
      document.querySelector('[data-signal="no-rate-card"]'),
      'DUTY 2: a refused owner is not told their own project has no card',
    ).toBeNull();
  });
});
