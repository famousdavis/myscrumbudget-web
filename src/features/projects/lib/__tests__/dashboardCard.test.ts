// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { nextCopyName, cloneProjectData, isReforecastStale, getDashboardEmptyState } from '../dashboardCard';
import type { Project } from '@/types/domain';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Apollo',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    activeReforecastId: 'rf1',
    reforecasts: [
      {
        id: 'rf1',
        name: 'Baseline',
        createdAt: '2026-01-01T00:00:00Z',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        reforecastDate: '2026-01-01',
        assignments: [{ id: 'a1', poolMemberId: 'pm1' }],
        allocations: [{ memberId: 'a1', month: '2026-03', allocation: 0.5 }],
        productivityWindows: [],
        actualCost: 0,
        baselineBudget: 1000,
      },
    ],
    ...overrides,
  };
}

describe('nextCopyName', () => {
  it('appends " - Copy (1)" for a first clone', () => {
    expect(nextCopyName('Apollo', ['Apollo'])).toBe('Apollo - Copy (1)');
  });

  it('increments to the next free N when earlier copies exist', () => {
    expect(
      nextCopyName('Apollo', ['Apollo', 'Apollo - Copy (1)', 'Apollo - Copy (2)']),
    ).toBe('Apollo - Copy (3)');
  });

  it('strips an existing " - Copy (N)" suffix so clones do not nest', () => {
    expect(nextCopyName('Apollo - Copy (1)', ['Apollo', 'Apollo - Copy (1)'])).toBe(
      'Apollo - Copy (2)',
    );
  });

  it('fills the lowest available gap', () => {
    expect(nextCopyName('Apollo', ['Apollo - Copy (2)'])).toBe('Apollo - Copy (1)');
  });

  it('clamps the result to 150 characters', () => {
    const longBase = 'X'.repeat(150);
    const result = nextCopyName(longBase, [longBase]);
    expect(result.length).toBe(150);
  });
});

describe('cloneProjectData', () => {
  it('assigns a fresh id and the given name, preserving internal ids', () => {
    const src = makeProject();
    const clone = cloneProjectData(src, 'Apollo - Copy (1)');
    expect(clone.id).not.toBe(src.id);
    expect(clone.name).toBe('Apollo - Copy (1)');
    // Internal ids preserved (project-scoped → allocation linkage intact).
    expect(clone.activeReforecastId).toBe('rf1');
    expect(clone.reforecasts[0].id).toBe('rf1');
    expect(clone.reforecasts[0].assignments[0].id).toBe('a1');
    expect(clone.reforecasts[0].allocations[0].memberId).toBe('a1');
  });

  it('is a deep copy — mutating the clone does not affect the source', () => {
    const src = makeProject();
    const clone = cloneProjectData(src, 'Copy');
    clone.reforecasts[0].allocations.push({ memberId: 'a1', month: '2026-04', allocation: 1 });
    expect(src.reforecasts[0].allocations).toHaveLength(1);
  });

  it('carries the color over', () => {
    const src = makeProject({ color: 'purple' });
    expect(cloneProjectData(src, 'Copy').color).toBe('purple');
  });

  it('drops archived — a clone is always born active, source untouched', () => {
    const src = makeProject({ archived: true });
    const clone = cloneProjectData(src, 'Copy');
    expect(clone.archived).toBeUndefined();
    expect(src.archived).toBe(true);
  });
});

describe('isReforecastStale', () => {
  it('is false when within the threshold', () => {
    expect(isReforecastStale('2026-06-01', '2026-06-20', 30)).toBe(false);
  });

  it('is true past the threshold', () => {
    expect(isReforecastStale('2026-05-01', '2026-06-20', 30)).toBe(true);
  });

  it('is exclusive at exactly the threshold (30 days = not yet stale)', () => {
    expect(isReforecastStale('2026-05-01', '2026-05-31', 30)).toBe(false); // 30 days
    expect(isReforecastStale('2026-05-01', '2026-06-01', 30)).toBe(true); // 31 days
  });

  it('is never stale for a future-dated reforecast', () => {
    expect(isReforecastStale('2026-12-01', '2026-06-20', 30)).toBe(false);
  });

  it('is false for an absent date', () => {
    expect(isReforecastStale(undefined, '2026-06-20', 30)).toBe(false);
  });

  it('defaults to a 30-day threshold', () => {
    expect(isReforecastStale('2026-05-01', '2026-05-31')).toBe(false);
    expect(isReforecastStale('2026-05-01', '2026-06-05')).toBe(true);
  });
});

describe('getDashboardEmptyState', () => {
  it('returns onboarding when there are no projects at all', () => {
    expect(getDashboardEmptyState(0, 0)).toBe('onboarding');
  });

  it('returns no-visible-projects when projects exist but none are visible', () => {
    expect(getDashboardEmptyState(1, 0)).toBe('no-visible-projects');
  });

  it('returns has-projects when at least one project is visible', () => {
    expect(getDashboardEmptyState(1, 1)).toBe('has-projects');
  });
});
