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

describe('ProjectCard — a clamped window is marked (v0.44.6)', () => {
  const settings = {
    discountRateAnnual: 0.03, laborRates: [{ role: 'Dev', hourlyRate: 100 }], holidays: [],
    trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
  };
  function staffed(endDate: string): Project {
    const p = makeProject();
    p.reforecasts[0] = {
      ...p.reforecasts[0], endDate,
      assignments: [{ id: 'a1', poolMemberId: 'pm1' }],
      allocations: [{ memberId: 'a1', month: '2026-06', allocation: 1 }],
    };
    return p;
  }

  it('shows the marker beside the EAC when the figures cover only the first 100 years', () => {
    render(<ProjectCard {...noopProps} settings={settings} project={staffed('2300-12-31')} />);
    expect(screen.getByText('EAC:')).toBeInTheDocument();
    expect(screen.getByText('First 100 years only')).toBeInTheDocument();
  });

  it('shows no marker for a window the app calculates in full', () => {
    render(<ProjectCard {...noopProps} settings={settings} project={staffed('2026-12-31')} />);
    expect(screen.getByText('EAC:')).toBeInTheDocument();
    expect(screen.queryByText('First 100 years only')).not.toBeInTheDocument();
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

describe('ProjectCard — archiving', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the Archived badge only when archived, after the Shared badge when both present', () => {
    const { rerender, container } = render(
      <ProjectCard project={makeProject()} {...noopProps} />,
    );
    expect(screen.queryByText('Archived')).toBeNull();

    rerender(
      <ProjectCard project={makeProject({ archived: true })} {...noopProps} isShared />,
    );
    const h3 = container.querySelector('h3');
    const txt = h3?.textContent ?? '';
    expect(txt).toContain('Shared');
    expect(txt).toContain('Archived');
    expect(txt.indexOf('Archived')).toBeGreaterThan(txt.indexOf('Shared'));
  });

  it('shows a hover-revealed Archive button on an active card and calls onArchive', () => {
    const onArchive = vi.fn();
    const onUnarchive = vi.fn();
    render(
      <ProjectCard
        project={makeProject()}
        {...noopProps}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />,
    );
    const archiveBtn = screen.getByLabelText('Archive project');
    // Active-card archive follows the hover-reveal rule (collapses when idle).
    expect(archiveBtn.className).toContain('group-hover:inline-flex');
    expect(screen.queryByLabelText('Unarchive project')).toBeNull();
    fireEvent.click(archiveBtn);
    expect(onArchive).toHaveBeenCalledWith('p1');
    expect(onUnarchive).not.toHaveBeenCalled();
  });

  it('shows an always-visible Unarchive button on an archived card and calls onUnarchive', () => {
    const onArchive = vi.fn();
    const onUnarchive = vi.fn();
    render(
      <ProjectCard
        project={makeProject({ archived: true })}
        {...noopProps}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />,
    );
    const unarchiveBtn = screen.getByLabelText('Unarchive project');
    // Unarchive is always visible — NOT hover-revealed (the only way back on touch).
    expect(unarchiveBtn.className).not.toContain('group-hover:inline-flex');
    expect(screen.queryByLabelText('Archive project')).toBeNull();
    fireEvent.click(unarchiveBtn);
    expect(onUnarchive).toHaveBeenCalledWith('p1');
    expect(onArchive).not.toHaveBeenCalled();
  });

  // An archived card is faded on its CONTENT, never as a whole: opacity on an
  // ancestor also fades the action buttons, which took their resting grey from
  // 3.95:1 to 2.10:1 (light) when the whole card carried opacity-60.
  const tokens = (el: Element) => el.className.split(/\s+/);

  it('fades an archived card’s grip and link, and no ancestor of its buttons', () => {
    const { container } = render(
      <ProjectCard
        project={makeProject({ archived: true })}
        {...noopProps}
        onUnarchive={vi.fn()}
      />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(tokens(card), 'card').not.toContain('opacity-60');

    const link = container.querySelector('a[href="/projects/p1"]') as Element;
    const grip = container.querySelector('[title="Drag to reorder"]')?.parentElement as Element;
    for (const [name, el] of [['link', link], ['grip', grip]] as const) {
      expect(tokens(el), `${name} faded`).toContain('opacity-60');
      expect(tokens(el), `${name} lifts on tile hover`).toContain('group-hover:opacity-100');
    }

    for (const label of ['Unarchive project', 'Delete project', 'Set tile color']) {
      for (let el: Element | null = screen.getByLabelText(label); el && el !== card.parentElement; el = el.parentElement) {
        expect(tokens(el), `${label}: ancestor <${el.tagName.toLowerCase()}>`).not.toContain('opacity-60');
      }
    }
  });

  it('fades nothing on an active card', () => {
    const { container } = render(<ProjectCard project={makeProject()} {...noopProps} />);
    expect(container.querySelectorAll('.opacity-60')).toHaveLength(0);
  });

  it('fades an archived card being dragged once, at opacity-40, not also at 60', () => {
    const { container } = render(
      <ProjectCard project={makeProject({ archived: true })} {...noopProps} isDragging />,
    );
    expect(tokens(container.firstElementChild as Element)).toContain('opacity-40');
    expect(container.querySelectorAll('.opacity-60')).toHaveLength(0);
  });
});

// The tile action buttons' resting grey: the SPERT Suite's tile-icon grey, measured
// at 3.60:1 or better (light) and 6.45:1 or better (dark) on every tile tint, where
// the old zinc-300 / dark zinc-600 measured 1.35-2.56:1 (WCAG 1.4.11 asks for 3:1).
// jsdom applies no Tailwind, so these pin the CLASS TOKENS; the colours themselves
// were measured in a browser. Tokens are compared whole, because a substring check
// for "text-zinc-300" would also match the legitimate "dark:hover:text-zinc-300".
describe('ProjectCard — resting icon colour (WCAG 1.4.11)', () => {
  const tokens = (el: Element) => el.className.split(/\s+/);
  const allActions = {
    onExport: vi.fn(),
    onClone: vi.fn(),
    onArchive: vi.fn(),
    onUnarchive: vi.fn(),
    onColorChange: vi.fn(),
  };

  it('every action button on an active tile rests in #808080, dark #9ca3af', () => {
    render(<ProjectCard project={makeProject()} {...noopProps} {...allActions} />);
    for (const label of [
      'Export project as JSON',
      'Clone project',
      'Archive project',
      'Set tile color',
      'Delete project',
    ]) {
      const t = tokens(screen.getByLabelText(label));
      expect(t, `${label}: light rest`).toContain('text-[#808080]');
      expect(t, `${label}: dark rest`).toContain('dark:text-[#9ca3af]');
      expect(t, `${label}: old light grey`).not.toContain('text-zinc-300');
      expect(t, `${label}: old dark grey`).not.toContain('dark:text-zinc-600');
    }
  });

  it('the always-visible Unarchive button rests in the same grey', () => {
    render(
      <ProjectCard project={makeProject({ archived: true })} {...noopProps} {...allActions} />,
    );
    const t = tokens(screen.getByLabelText('Unarchive project'));
    expect(t).toContain('text-[#808080]');
    expect(t).toContain('dark:text-[#9ca3af]');
    expect(t).not.toContain('text-zinc-300');
  });

  it('the no-colour swatch ring is drawn in the button colour; a set colour keeps its own ring', () => {
    const { rerender } = render(
      <ProjectCard project={makeProject()} {...noopProps} {...allActions} />,
    );
    const ring = () => screen.getByLabelText('Set tile color').querySelector('span') as Element;
    expect(tokens(ring()), 'no colour').toContain('border-current');
    expect(tokens(ring()), 'no colour: old grey').not.toContain('border-zinc-400');

    rerender(<ProjectCard project={makeProject({ color: 'teal' })} {...noopProps} {...allActions} />);
    expect(tokens(ring()), 'teal').toContain('border-black/10');
    expect(tokens(ring()), 'teal').not.toContain('border-current');
  });

  it('hovering Archive darkens it (amber-700), never fades it (amber-500 is 1.95:1)', () => {
    render(<ProjectCard project={makeProject()} {...noopProps} {...allActions} />);
    const t = tokens(screen.getByLabelText('Archive project'));
    expect(t).toContain('hover:text-amber-700');
    expect(t).not.toContain('hover:text-amber-500');
  });
});
