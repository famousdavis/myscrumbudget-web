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

const emptyMap: AllocationMap = new Map();

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
      { month: '2026-01', cost: 10000, hours: 160 },
      { month: '2026-02', cost: 8000, hours: 128 },
      { month: '2026-03', cost: 0, hours: 0 },
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
});
