// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Reforecast } from '@/types/domain';
import { ReforecastToolbar } from '../ReforecastToolbar';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const reforecasts: Reforecast[] = [
  {
    id: 'rf-1',
    name: 'Baseline',
    createdAt: '2026-01-15T00:00:00Z',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    reforecastDate: '2026-01-15',
    baselineBudget: 100000,
    actualCost: 0,
    assignments: [],
    allocations: [],
    productivityWindows: [],
  },
  {
    id: 'rf-2',
    name: 'Q2 Reforecast',
    createdAt: '2026-04-01T00:00:00Z',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    reforecastDate: '2026-04-01',
    baselineBudget: 120000,
    actualCost: 25000,
    assignments: [],
    allocations: [],
    productivityWindows: [],
  },
];

describe('ReforecastToolbar', () => {
  const defaultProps = {
    reforecasts,
    activeReforecastId: 'rf-1',
    reforecastDate: '2026-01-15',
    reforecastStartDate: '2026-01-01',
    reforecastEndDate: '2026-12-31',
    onSwitch: vi.fn(),
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onReforecastDateChange: vi.fn(),
    onActualsThroughDateChange: vi.fn(),
    onCommitStartDate: vi.fn(),
    onCommitEndDate: vi.fn(),
  };

  it('renders Reforecast label', () => {
    render(<ReforecastToolbar {...defaultProps} />);
    expect(screen.getByText('Reforecast')).toBeDefined();
  });

  it('renders reforecast select with options', () => {
    render(<ReforecastToolbar {...defaultProps} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('rf-1');
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(2);
  });

  it('calls onSwitch when select changes', () => {
    const onSwitch = vi.fn();
    render(<ReforecastToolbar {...defaultProps} onSwitch={onSwitch} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rf-2' } });
    expect(onSwitch).toHaveBeenCalledWith('rf-2');
  });

  it('renders date input with reforecast date', () => {
    render(<ReforecastToolbar {...defaultProps} />);
    const dateInput = screen.getByLabelText('Reforecast date') as HTMLInputElement;
    expect(dateInput.value).toBe('2026-01-15');
  });

  it('calls onReforecastDateChange when date changes', () => {
    const onDateChange = vi.fn();
    render(<ReforecastToolbar {...defaultProps} onReforecastDateChange={onDateChange} />);
    fireEvent.change(screen.getByLabelText('Reforecast date'), { target: { value: '2026-02-01' } });
    expect(onDateChange).toHaveBeenCalledWith('2026-02-01');
  });

  it('renders + New Reforecast button', () => {
    render(<ReforecastToolbar {...defaultProps} />);
    expect(screen.getByText('+ New Reforecast')).toBeDefined();
  });

  it('renders Delete icon button when multiple reforecasts', () => {
    render(<ReforecastToolbar {...defaultProps} />);
    expect(screen.getByLabelText('Delete reforecast')).toBeDefined();
  });

  it('does not render Delete icon button with single reforecast', () => {
    render(
      <ReforecastToolbar {...defaultProps} reforecasts={[reforecasts[0]]} />,
    );
    expect(screen.queryByLabelText('Delete reforecast')).toBeNull();
  });

  it('shows empty state when no reforecasts', () => {
    render(
      <ReforecastToolbar
        {...defaultProps}
        reforecasts={[]}
        activeReforecastId={null}
      />,
    );
    expect(screen.getByText('No reforecasts yet')).toBeDefined();
  });

  it('shows delete confirmation dialog on Delete icon click', () => {
    render(<ReforecastToolbar {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Delete reforecast'));
    expect(screen.getByText('Delete Reforecast')).toBeDefined();
  });

  it('calls onDelete after confirming delete', () => {
    const onDelete = vi.fn();
    render(<ReforecastToolbar {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText('Delete reforecast'));
    // ConfirmDialog renders a "Delete" confirm button — only one "Delete" text in the DOM now
    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith('rf-1');
  });

  it('renders Rename pencil button when at least one reforecast exists', () => {
    render(<ReforecastToolbar {...defaultProps} />);
    expect(screen.getByLabelText('Rename reforecast')).toBeDefined();
  });

  it('does not render Rename pencil button when zero reforecasts', () => {
    render(
      <ReforecastToolbar
        {...defaultProps}
        reforecasts={[]}
        activeReforecastId={null}
      />,
    );
    expect(screen.queryByLabelText('Rename reforecast')).toBeNull();
  });

  it('clicking Rename swaps select for input pre-filled with current name; pencil hides while editing', () => {
    render(<ReforecastToolbar {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Rename reforecast'));
    const input = screen.getByLabelText('Edit reforecast name') as HTMLInputElement;
    expect(input.value).toBe('Baseline');
    // Select is gone while editing — confirms users cannot switch reforecasts
    expect(screen.queryByRole('combobox')).toBeNull();
    // Pencil button is hidden while in edit mode
    expect(screen.queryByLabelText('Rename reforecast')).toBeNull();
  });

  it('Enter commits via onRename with trimmed value', () => {
    const onRename = vi.fn();
    render(<ReforecastToolbar {...defaultProps} onRename={onRename} />);
    fireEvent.click(screen.getByLabelText('Rename reforecast'));
    const input = screen.getByLabelText('Edit reforecast name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  Renamed  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('Renamed');
    // Edit mode exited — select reappears
    expect(screen.getByRole('combobox')).toBeDefined();
  });

  it('Escape cancels edit without calling onRename', () => {
    const onRename = vi.fn();
    render(<ReforecastToolbar {...defaultProps} onRename={onRename} />);
    fireEvent.click(screen.getByLabelText('Rename reforecast'));
    const input = screen.getByLabelText('Edit reforecast name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Should-not-commit' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toBeDefined();
  });

  it('blur commits via onRename', () => {
    const onRename = vi.fn();
    render(<ReforecastToolbar {...defaultProps} onRename={onRename} />);
    fireEvent.click(screen.getByLabelText('Rename reforecast'));
    const input = screen.getByLabelText('Edit reforecast name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Q3 final' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith('Q3 final');
  });

  it('empty (whitespace-only) commit does NOT call onRename and exits edit mode', () => {
    const onRename = vi.fn();
    render(<ReforecastToolbar {...defaultProps} onRename={onRename} />);
    fireEvent.click(screen.getByLabelText('Rename reforecast'));
    const input = screen.getByLabelText('Edit reforecast name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toBeDefined();
  });
});
