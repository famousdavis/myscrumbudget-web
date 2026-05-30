// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReforecast } from '../useReforecast';
import type { CharterBudget, Project, Reforecast } from '@/types/domain';

function charter(over: Partial<CharterBudget> = {}): CharterBudget {
  return {
    riskProfile: {
      projectType: 'custom',
      requirementsClarity: 'partial',
      teamExperience: 'some',
      orgChangeImpact: 'mod',
      integrationComplexity: 'mod',
      cvOverride: null,
      optimismUpliftPct: 0,
    },
    distribution: 'normal',
    targetPercentile: 80,
    etcIsP80Schedule: false,
    derivedCV: 0.25,
    derivedSigma: 50000,
    etcAtCalculation: 200000,
    adjustedCostBasis: 200000,
    charterBudgetAmount: 242082,
    medianAmount: 200000,
    calculatedAt: '2026-05-01T00:00:00.000Z',
    ...over,
  };
}

function makeProject(rfOver: Partial<Reforecast> = {}): Project {
  const rf: Reforecast = {
    id: 'rf_1',
    name: 'Baseline',
    createdAt: '2026-01-01T00:00:00Z',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    reforecastDate: '2026-01-01',
    allocations: [],
    assignments: [],
    productivityWindows: [],
    actualCost: 0,
    baselineBudget: 100000,
    ...rfOver,
  };
  return {
    id: 'p1',
    name: 'P',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    reforecasts: [rf],
    activeReforecastId: 'rf_1',
  };
}

const activeRf = (p: Project) => p.reforecasts[0];

function setup(initial: Project) {
  const box = { project: initial };
  const updateProject = (updater: (p: Project) => Project) => {
    box.project = updater(box.project);
  };
  const view = renderHook(
    (props: { project: Project }) => useReforecast({ project: props.project, updateProject }),
    { initialProps: { project: box.project } },
  );
  // Run a hook action, then feed the mutated project back so the next call's
  // activeReforecast memo (which the no-op guard reads) reflects it.
  const run = (fn: (api: ReturnType<typeof useReforecast>) => void) => {
    act(() => {
      fn(view.result.current);
    });
    view.rerender({ project: box.project });
  };
  return { box, run };
}

describe('useReforecast — applyCharterBudget', () => {
  it('writes baselineBudget + charterBudget together in one update', () => {
    const { box, run } = setup(makeProject());
    const cb = charter({ charterBudgetAmount: 242082 });
    run((api) => api.applyCharterBudget(cb));
    expect(activeRf(box.project).baselineBudget).toBe(242082);
    expect(activeRf(box.project).charterBudget).toEqual(cb);
  });
});

describe('useReforecast — updateBaselineBudget no-op guard + charter clear', () => {
  it('is a TRUE no-op when the value is unchanged (same project ref, charter preserved)', () => {
    const { box, run } = setup(makeProject({ baselineBudget: 100000, charterBudget: charter() }));
    const before = box.project;
    run((api) => api.updateBaselineBudget(100000));
    expect(box.project).toBe(before); // no updateProject call at all
    expect(activeRf(box.project).charterBudget).toBeDefined();
  });

  it('clears the charter (by omission) on a real manual change', () => {
    const { box, run } = setup(makeProject({ baselineBudget: 100000, charterBudget: charter() }));
    run((api) => api.updateBaselineBudget(250000));
    expect(activeRf(box.project).baselineBudget).toBe(250000);
    expect(activeRf(box.project).charterBudget).toBeUndefined();
    expect('charterBudget' in activeRf(box.project)).toBe(false);
  });

  it('preserves the charter when a blur re-submits the just-applied amount', () => {
    const { box, run } = setup(makeProject());
    const cb = charter({ charterBudgetAmount: 242082 });
    run((api) => api.applyCharterBudget(cb));
    run((api) => api.updateBaselineBudget(242082)); // unchanged blur after Apply
    expect(activeRf(box.project).charterBudget).toEqual(cb);
  });
});
