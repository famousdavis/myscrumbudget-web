// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The reforecast toolbar's one-row breakpoint (FRAME26, v0.45.0: the one change made inside a working view). Its row
 * is about 902 px wide unwrapped. Inside the frame's 1600 px column that fits at 1,024 CSS px (960 px) but not at 853,
 * a 1,280 px window at 150 % zoom (789 px), where the project page scrolled sideways by about 113 px (contract §1;
 * measured in Chrome). So the row stays one line from `lg:` (1,024) and wraps below it; it was `md:` (768, v0.21.2).
 * jsdom has no layout, so the classes are pinned; frame-check measures the overflow (zoom.overflow at 853 and 1024).
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Reforecast } from '@/types/domain';
import { ReforecastToolbar } from '../ReforecastToolbar';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const rf: Reforecast = {
  id: 'rf-1', name: 'Baseline', createdAt: '2026-01-15T00:00:00Z', startDate: '2026-01-01', endDate: '2026-12-31',
  reforecastDate: '2026-01-15', baselineBudget: 100000, actualCost: 0, assignments: [], allocations: [], productivityWindows: [],
};

describe('ReforecastToolbar at zoom widths', () => {
  it('wraps below 1,024 CSS px and is one row (with its wider gap) from lg: up, never from md:', () => {
    const { container } = render(
      <ReforecastToolbar
        reforecasts={[rf]} activeReforecastId="rf-1" reforecastDate="2026-01-15" reforecastStartDate="2026-01-01"
        reforecastEndDate="2026-12-31" onSwitch={vi.fn()} onCreate={vi.fn()} onDelete={vi.fn()} onRename={vi.fn()}
        onReforecastDateChange={vi.fn()} onActualsThroughDateChange={vi.fn()}
      />,
    );
    const row = container.firstElementChild as HTMLElement;
    const classes = row.className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(['flex', 'flex-wrap', 'lg:flex-nowrap', 'lg:gap-3']));
    expect(classes.filter((c) => c.startsWith('md:'))).toEqual([]);
  });
});
