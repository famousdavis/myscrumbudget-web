// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ProjectCard } from '../ProjectCard';
import type { Project } from '@/types/domain';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: unknown; children: ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>{children}</a>
  ),
}));

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Apollo',
    // Project-level dates are intentionally DIFFERENT from the reforecast window,
    // so the test proves the card reads the reforecast, not these frozen values.
    startDate: '2026-01-15',
    endDate: '2026-08-31',
    activeReforecastId: 'rf1',
    reforecasts: [
      {
        id: 'rf1',
        name: 'Baseline',
        createdAt: '2026-06-01T00:00:00Z',
        startDate: '2026-06-01',
        endDate: '2026-12-31',
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

const noopProps = {
  settings: null,
  pool: [],
  onDelete: vi.fn(),
};

describe('ProjectCard — date sourcing (Bug #1)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the most-recent reforecast window, not the frozen project-level dates', () => {
    const { container } = render(<ProjectCard project={makeProject()} {...noopProps} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Jun 2026'); // reforecast.startDate
    expect(text).toContain('Dec 2026'); // reforecast.endDate
    expect(text).not.toContain('Jan 2026'); // project.startDate (stale)
    expect(text).not.toContain('Aug 2026'); // project.endDate (stale)
  });

  it('falls back to project dates when there are no reforecasts', () => {
    const p = makeProject({ reforecasts: [], activeReforecastId: null });
    const { container } = render(<ProjectCard project={p} {...noopProps} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Jan 2026');
    expect(text).toContain('Aug 2026');
  });
});

describe('ProjectCard — reforecast stamp', () => {
  it('renders an "as of" stamp from the most-recent reforecast date', () => {
    render(<ProjectCard project={makeProject()} {...noopProps} />);
    expect(screen.getByText(/as of Jun 1, 2026/)).toBeDefined();
  });
});

describe('ProjectCard — actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fires onExport and onClone', () => {
    const onExport = vi.fn();
    const onClone = vi.fn();
    render(
      <ProjectCard
        project={makeProject()}
        {...noopProps}
        onExport={onExport}
        onClone={onClone}
      />,
    );
    fireEvent.click(screen.getByLabelText('Export project as JSON'));
    expect(onExport).toHaveBeenCalledWith('p1');
    fireEvent.click(screen.getByLabelText('Clone project'));
    expect(onClone).toHaveBeenCalledWith('p1');
  });

  it('opens the color popover and fires onColorChange with a palette key', () => {
    const onColorChange = vi.fn();
    render(
      <ProjectCard project={makeProject()} {...noopProps} onColorChange={onColorChange} />,
    );
    fireEvent.click(screen.getByLabelText('Set tile color'));
    fireEvent.click(screen.getByLabelText('Teal'));
    expect(onColorChange).toHaveBeenCalledWith('p1', 'teal');
  });

  it('fires onColorChange(undefined) when clearing the color', () => {
    const onColorChange = vi.fn();
    render(
      <ProjectCard
        project={makeProject({ color: 'teal' })}
        {...noopProps}
        onColorChange={onColorChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('Set tile color'));
    fireEvent.click(screen.getByLabelText('No color'));
    expect(onColorChange).toHaveBeenCalledWith('p1', undefined);
  });
});
