// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The COST consequence of the shared-project team-name fallback (v0.38.2).
 *
 * ⚠️ THIS IS NOT A COSMETIC FIX, AND THIS FILE IS WHERE THAT IS MEASURED.
 * `getHourlyRate` (costs.ts) looks a rate up by the member's ROLE STRING. An
 * unresolved member carries role '', which matches no labor rate, so the engine
 * defaults it to $0/hour and logs a warning. Every allocation on a shared
 * project therefore priced at ZERO: the reader saw a fully populated grid and
 * an ETC of $0, with nothing on screen saying the roster had failed to resolve.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Project, Settings } from '@/types/domain';
import { useProjectMetrics } from '../useProjectMetrics';

const settings: Settings = {
  discountRateAnnual: 0,
  laborRates: [{ role: 'Data Engineer', hourlyRate: 100 }],
  holidays: [],
  trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
};

function sharedProject(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Shared',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    activeReforecastId: 'rf1',
    reforecasts: [{
      id: 'rf1',
      name: 'Baseline',
      createdAt: '2026-09-01T00:00:00Z',
      reforecastDate: '2026-09-01',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      assignments: [{ id: 'a1', poolMemberId: 'owner-pm-1' }],
      allocations: [{ memberId: 'a1', month: '2026-09', allocation: 1 }],
      productivityWindows: [],
      actualCost: 0,
      baselineBudget: 100000,
    }],
    _teamSnapshot: { 'owner-pm-1': { name: 'Grace Kim', role: 'Data Engineer' } },
    ...over,
  };
}

describe('useProjectMetrics — shared projects price at the snapshot role', () => {
  it('[FAILS-TODAY] costs a shared project instead of reporting $0', () => {
    const { result } = renderHook(() => useProjectMetrics(sharedProject(), settings, []));

    // 22 working days in Sept 2026 x 8h x 100% x $100 = $17,600.
    expect(result.current?.etc).toBe(17600);
  });

  it('is the SNAPSHOT that carries it — the same fixture without one prices at $0', () => {
    // The negative control. Without it, the assertion above passes for any
    // reason at all and proves nothing about the fallback.
    const { result } = renderHook(() =>
      useProjectMetrics(sharedProject({ _teamSnapshot: undefined }), settings, []),
    );

    expect(result.current?.etc).toBe(0);
  });

  it('prices from the VIEWER\'s labor rates, not the owner\'s', () => {
    // ⚠️ PINS A KNOWN GAP, NOT A DESIRED BEHAVIOUR. _teamSnapshot carries
    // {name, role} and no rate, so a shared project is costed with the READER's
    // rate card: same roster, same allocations, different money for every
    // collaborator. Raised by the owner 2026-09-12 as a design gap — a shared
    // project should read identically for everyone, with the owner's stored
    // document as the single source of truth for team, roles AND rates. That is
    // its own piece of work; this test exists so the CURRENT behaviour is
    // stated rather than discovered, and it is expected to be REPLACED (not
    // deleted quietly) when the source-of-truth question is settled.
    const cheaper: Settings = { ...settings, laborRates: [{ role: 'Data Engineer', hourlyRate: 50 }] };
    const { result } = renderHook(() => useProjectMetrics(sharedProject(), cheaper, []));

    expect(result.current?.etc).toBe(8800);
  });
});
