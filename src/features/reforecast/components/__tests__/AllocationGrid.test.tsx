// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { TeamMember, PoolMember, MonthlyCalculation } from '@/types/domain';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { AllocationGrid } from '../AllocationGrid';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const months = ['2026-01', '2026-02', '2026-03'];

const teamMembers: TeamMember[] = [
  { id: 'tm-1', name: 'Alice', role: 'Developer' },
  { id: 'tm-2', name: 'Bob', role: 'Designer' },
];

const pool: PoolMember[] = [
  { id: 'pm-1', name: 'Alice', role: 'Developer' },
  { id: 'pm-2', name: 'Bob', role: 'Designer' },
  { id: 'pm-3', name: 'Charlie', role: 'QA' },
];

function buildMap(entries: Array<[string, string, number]>): AllocationMap {
  const map: AllocationMap = new Map();
  for (const [month, memberId, value] of entries) {
    if (!map.has(month)) map.set(month, new Map());
    map.get(month)!.set(memberId, value);
  }
  return map;
}

const sampleMap = buildMap([
  ['2026-01', 'tm-1', 0.5],
  ['2026-01', 'tm-2', 1.0],
  ['2026-02', 'tm-1', 0.75],
]);

describe('AllocationGrid', () => {
  const defaultProps = {
    months,
    teamMembers,
    allocationMap: sampleMap,
    onAllocationChange: vi.fn(),
    onMemberDelete: vi.fn(),
    onMemberAdd: vi.fn(),
    pool,
  };

  it('renders team member names', () => {
    render(<AllocationGrid {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
  });

  it('renders month headers', () => {
    render(<AllocationGrid {...defaultProps} />);
    // Month labels are formatted — check for the formatted month text
    const headers = screen.getAllByRole('columnheader');
    // First header is "Team Member", rest are months + possible action column
    expect(headers.length).toBeGreaterThanOrEqual(4); // Team Member + 3 months
  });

  it('renders allocation percentages', () => {
    render(<AllocationGrid {...defaultProps} />);
    expect(screen.getByText('50%')).toBeDefined();
    expect(screen.getByText('100%')).toBeDefined();
    expect(screen.getByText('75%')).toBeDefined();
  });

  it('renders empty state when no months', () => {
    render(
      <AllocationGrid
        {...defaultProps}
        months={[]}
      />
    );
    expect(screen.getByText('No months in project date range.')).toBeDefined();
  });

  it('renders empty state when no members and no pool', () => {
    render(
      <AllocationGrid
        {...defaultProps}
        teamMembers={[]}
        pool={[]}
      />
    );
    expect(screen.getByText('No team members assigned to this project.')).toBeDefined();
  });

  it('renders link to team pool in empty member state', () => {
    render(
      <AllocationGrid
        {...defaultProps}
        teamMembers={[]}
        pool={[]}
      />
    );
    const link = screen.getByText('Go to Team Pool');
    expect(link.getAttribute('href')).toBe('/team');
  });

  it('renders add member button', () => {
    render(<AllocationGrid {...defaultProps} />);
    expect(screen.getByText('+ Add member')).toBeDefined();
  });

  it('shows member dropdown when add member clicked', () => {
    render(<AllocationGrid {...defaultProps} />);
    fireEvent.click(screen.getByText('+ Add member'));
    expect(screen.getByText('Select member...')).toBeDefined();
  });

  it('renders delete buttons for each member', () => {
    render(<AllocationGrid {...defaultProps} />);
    const deleteButtons = screen.getAllByTitle('Remove row');
    expect(deleteButtons).toHaveLength(2);
  });

  it('renders summary rows when monthlyData provided', () => {
    const monthlyData: MonthlyCalculation[] = [
      { month: '2026-01', cost: 10000, hours: 160, cumulativeCost: 10000, cumulativeHours: 160 },
      { month: '2026-02', cost: 8000, hours: 128, cumulativeCost: 18000, cumulativeHours: 288 },
      { month: '2026-03', cost: 0, hours: 0, cumulativeCost: 18000, cumulativeHours: 288 },
    ];
    render(
      <AllocationGrid {...defaultProps} monthlyData={monthlyData} />
    );
    expect(screen.getByText('Monthly Cost')).toBeDefined();
    expect(screen.getByText('Monthly Hours')).toBeDefined();
  });

  it('does not render summary rows without monthlyData', () => {
    render(<AllocationGrid {...defaultProps} />);
    expect(screen.queryByText('Monthly Cost')).toBeNull();
    expect(screen.queryByText('Monthly Hours')).toBeNull();
  });

  it('renders in readonly mode without controls', () => {
    render(
      <AllocationGrid
        {...defaultProps}
        readonly={true}
        onMemberDelete={undefined}
        onMemberAdd={undefined}
      />
    );
    expect(screen.queryByText('+ Add member')).toBeNull();
    expect(screen.queryByTitle('Remove row')).toBeNull();
  });

  it('renders sort indicator when onSort provided', () => {
    render(
      <AllocationGrid {...defaultProps} onSort={vi.fn()} />
    );
    const teamHeader = screen.getByText('Team Member');
    // Sort indicator should be present
    expect(teamHeader.closest('th')?.textContent).toContain('⇅');
  });

  it('does not render sort indicator without onSort', () => {
    render(<AllocationGrid {...defaultProps} />);
    const teamHeader = screen.getByText('Team Member');
    expect(teamHeader.closest('th')?.textContent).not.toContain('⇅');
  });

  describe('archived pool members', () => {
    it('excludes archived members from the + Add member picker', () => {
      const poolWithArchived: PoolMember[] = [
        { id: 'pm-1', name: 'Alice', role: 'Developer' },
        { id: 'pm-2', name: 'Bob', role: 'Designer' },
        { id: 'pm-3', name: 'Charlie', role: 'QA', archived: true },
      ];
      render(<AllocationGrid {...defaultProps} pool={poolWithArchived} />);
      fireEvent.click(screen.getByText('+ Add member'));
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      // 1 placeholder + 2 active members = 3 options total
      expect(select.options.length).toBe(3);
      const optionTexts = Array.from(select.options).map((o) => o.textContent ?? '');
      expect(optionTexts.some((t) => t.includes('Charlie'))).toBe(false);
    });

    it('renders empty-state when pool has only archived members and no team members', () => {
      const archivedOnlyPool: PoolMember[] = [
        { id: 'pm-1', name: 'Alice', role: 'Developer', archived: true },
      ];
      render(
        <AllocationGrid
          {...defaultProps}
          teamMembers={[]}
          pool={archivedOnlyPool}
        />,
      );
      expect(screen.getByText('No team members assigned to this project.')).toBeDefined();
      expect(screen.getByText('Go to Team Pool')).toBeDefined();
      expect(screen.queryByText('+ Add member')).toBeNull();
    });

    it('renders an archived members row normally when they came from a saved assignment', () => {
      // Alice resolved into teamMembers from a saved assignment, but her pool
      // entry is archived. The row should still render with name + role; the
      // picker dropdown should still exclude her from new-row options.
      const poolWithArchivedAlice: PoolMember[] = [
        { id: 'pm-1', name: 'Alice', role: 'Developer', archived: true },
        { id: 'pm-2', name: 'Bob', role: 'Designer' },
      ];
      render(
        <AllocationGrid
          {...defaultProps}
          teamMembers={[{ id: 'tm-1', name: 'Alice', role: 'Developer' }]}
          pool={poolWithArchivedAlice}
        />,
      );
      // Alice's row is visible (resolved as a TeamMember from saved assignment)
      expect(screen.getByText('Alice')).toBeDefined();

      // Picker dropdown does not list Alice
      fireEvent.click(screen.getByText('+ Add member'));
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      const optionTexts = Array.from(select.options).map((o) => o.textContent ?? '');
      // Alice may appear elsewhere on the page in the row; check only dropdown options
      const aliceOptions = optionTexts.filter((t) => t.includes('Alice'));
      expect(aliceOptions.length).toBe(0);
    });
  });
});

/**
 * The "role has no labor rate" indicator (v0.37.5).
 *
 * ⚠️ THE COLOUR IS A BROWSER CLAIM, NOT A JSDOM ONE. jsdom applies no Tailwind, so
 * `text-red-600` here is a class name and nothing more; that the pixels are actually
 * red was verified on `next start`. What these tests honestly pin is the PREDICATE —
 * which member gets flagged, and, more importantly, which does not.
 *
 * ⚠️ `laborRates` is OPTIONAL and its absence means "settings have not loaded yet",
 * which must never render as "this role has no rate". `projects/[id]/page.tsx`
 * discards `useSettings`' `loading` and renders the grid with no `settings &&` guard,
 * so `undefined` is a real first-render state, not a defensive hypothetical — in cloud
 * mode the settings and project reads are two racing `getDoc`s.
 */
describe('AllocationGrid — role-has-no-rate indicator', () => {
  const laborRates = [
    { role: 'Developer', hourlyRate: 100 },
    { role: 'Designer', hourlyRate: 90 },
  ];

  const baseProps = {
    months,
    allocationMap: sampleMap,
    onAllocationChange: vi.fn(),
    pool,
  };

  /** The `(Role)` suffix span rendered beside a member's name. */
  function roleTag(role: string) {
    return screen.getByText(`(${role})`);
  }

  it('flags a member whose role has no matching labor rate', () => {
    render(
      <AllocationGrid
        {...baseProps}
        teamMembers={[{ id: 'tm-1', name: 'Grace Kim', role: 'Data Engineer' }]}
        laborRates={laborRates}
      />,
    );
    const tag = roleTag('Data Engineer');
    expect(tag.className).toContain('text-red-600');
    expect(tag.getAttribute('title')).toBe('Role not in labor rates');
  });

  it('does NOT flag a member whose role has a labor rate', () => {
    render(
      <AllocationGrid
        {...baseProps}
        teamMembers={[{ id: 'tm-1', name: 'Alice', role: 'Developer' }]}
        laborRates={laborRates}
      />,
    );
    const tag = roleTag('Developer');
    expect(tag.className).not.toContain('text-red-600');
    expect(tag.getAttribute('title')).toBeNull();
  });

  it('flags NOBODY while settings are still loading (laborRates undefined)', () => {
    // ⚠️ This assertion is vacuous against v0.37.4, where nothing but the literal
    // 'Unknown' was ever flagged. It earns its place only against the fix, and the
    // mutation that makes it fail is the naive `laborRates ?? []` — the existing
    // house pattern at team/page.tsx, which would flash EVERY member red mid-fetch.
    render(
      <AllocationGrid
        {...baseProps}
        teamMembers={[
          { id: 'tm-1', name: 'Grace Kim', role: 'Data Engineer' },
          { id: 'tm-2', name: 'Alice', role: 'Developer' },
        ]}
        laborRates={undefined}
      />,
    );
    expect(roleTag('Data Engineer').className).not.toContain('text-red-600');
    expect(roleTag('Developer').className).not.toContain('text-red-600');
    expect(roleTag('Data Engineer').getAttribute('title')).toBeNull();
  });

  it('flags nobody when the prop is omitted entirely', () => {
    render(
      <AllocationGrid
        {...baseProps}
        teamMembers={[{ id: 'tm-1', name: 'Grace Kim', role: 'Data Engineer' }]}
      />,
    );
    expect(roleTag('Data Engineer').className).not.toContain('text-red-600');
  });

  it('flags an empty labor-rate list — loaded-and-empty is not the same as not loaded', () => {
    render(
      <AllocationGrid
        {...baseProps}
        teamMembers={[{ id: 'tm-1', name: 'Grace Kim', role: 'Data Engineer' }]}
        laborRates={[]}
      />,
    );
    expect(roleTag('Data Engineer').className).toContain('text-red-600');
  });

  it('still flags the Excel "Unknown" sentinel, via the general predicate', () => {
    // The sentinel no longer has a branch of its own; excelImport assigns it only when
    // the role has no rate, so the general predicate subsumes it.
    render(
      <AllocationGrid
        {...baseProps}
        teamMembers={[{ id: 'tm-1', name: 'Imported Person', role: 'Unknown' }]}
        laborRates={laborRates}
      />,
    );
    expect(roleTag('Unknown').className).toContain('text-red-600');
  });

  it('does NOT flag "Unknown" once a rate literally named Unknown exists', () => {
    // The case a dedicated sentinel branch would get wrong: the role now has a rate,
    // so flagging it would be false. This is why the branch was deleted rather than kept.
    render(
      <AllocationGrid
        {...baseProps}
        teamMembers={[{ id: 'tm-1', name: 'Imported Person', role: 'Unknown' }]}
        laborRates={[...laborRates, { role: 'Unknown', hourlyRate: 0 }]}
      />,
    );
    expect(roleTag('Unknown').className).not.toContain('text-red-600');
  });

  it('matches roles case-sensitively, as the rate lookup does', () => {
    // `calc/costs.ts` resolves rates with `r.role === role`, so "developer" genuinely
    // has no rate and flagging it is the honest reading.
    render(
      <AllocationGrid
        {...baseProps}
        teamMembers={[{ id: 'tm-1', name: 'Alice', role: 'developer' }]}
        laborRates={laborRates}
      />,
    );
    expect(roleTag('developer').className).toContain('text-red-600');
  });
});
