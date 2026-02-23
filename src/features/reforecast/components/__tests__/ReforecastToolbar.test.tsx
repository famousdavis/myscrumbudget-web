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
    reforecastDate: '2026-01-15',
    baselineBudget: 100000,
    actualCost: 0,
    allocations: [],
    productivityWindows: [],
  },
  {
    id: 'rf-2',
    name: 'Q2 Reforecast',
    reforecastDate: '2026-04-01',
    baselineBudget: 120000,
    actualCost: 25000,
    allocations: [],
    productivityWindows: [],
  },
];

describe('ReforecastToolbar', () => {
  const defaultProps = {
    reforecasts,
    activeReforecastId: 'rf-1',
    reforecastDate: '2026-01-15',
    onSwitch: vi.fn(),
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    onReforecastDateChange: vi.fn(),
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

  it('renders Delete button when multiple reforecasts', () => {
    render(<ReforecastToolbar {...defaultProps} />);
    expect(screen.getByText('Delete')).toBeDefined();
  });

  it('does not render Delete button with single reforecast', () => {
    render(
      <ReforecastToolbar {...defaultProps} reforecasts={[reforecasts[0]]} />,
    );
    expect(screen.queryByText('Delete')).toBeNull();
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

  it('shows delete confirmation dialog on Delete click', () => {
    render(<ReforecastToolbar {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByText('Delete Reforecast')).toBeDefined();
  });

  it('calls onDelete after confirming delete', () => {
    const onDelete = vi.fn();
    render(<ReforecastToolbar {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Delete'));
    // The ConfirmDialog has a "Delete" confirm button — there are now two "Delete" texts
    const deleteButtons = screen.getAllByText('Delete');
    // Click the confirm button (last one in the dialog)
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    expect(onDelete).toHaveBeenCalledWith('rf-1');
  });
});
