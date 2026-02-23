import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectForm } from '../ProjectForm';

const mockBack = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack }),
}));

describe('ProjectForm', () => {
  const defaultProps = {
    onSubmit: vi.fn().mockResolvedValue(undefined),
    submitLabel: 'Create',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(<ProjectForm {...defaultProps} />);
    expect(screen.getByText('Project Name')).toBeDefined();
    expect(screen.getByText('Start Date')).toBeDefined();
    expect(screen.getByText('End Date')).toBeDefined();
    expect(screen.getByText('Baseline Budget')).toBeDefined();
  });

  it('renders submit button with provided label', () => {
    render(<ProjectForm {...defaultProps} submitLabel="Save Changes" />);
    expect(screen.getByText('Save Changes')).toBeDefined();
  });

  it('renders cancel button', () => {
    render(<ProjectForm {...defaultProps} />);
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('navigates back on cancel click', () => {
    render(<ProjectForm {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('submit button is disabled when form is empty', () => {
    render(<ProjectForm {...defaultProps} />);
    const btn = screen.getByText('Create');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders initial data when provided', () => {
    render(
      <ProjectForm
        {...defaultProps}
        initialData={{
          name: 'My Project',
          startDate: '2026-01-01',
          endDate: '2026-06-30',
          baselineBudget: 50000,
        }}
      />,
    );
    const nameInput = screen.getByDisplayValue('My Project');
    expect(nameInput).toBeDefined();
  });

  it('enables submit when all required fields filled', () => {
    render(
      <ProjectForm
        {...defaultProps}
        initialData={{
          name: 'Test',
          startDate: '2026-01-01',
          endDate: '2026-06-30',
          baselineBudget: 0,
        }}
      />,
    );
    const btn = screen.getByText('Create');
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls onSubmit with form data', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectForm
        onSubmit={onSubmit}
        submitLabel="Create"
        initialData={{
          name: 'Test',
          startDate: '2026-01-01',
          endDate: '2026-06-30',
          baselineBudget: 10000,
        }}
      />,
    );
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Test',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        baselineBudget: 10000,
      });
    });
  });

  it('shows error when end date before start date', async () => {
    render(
      <ProjectForm
        {...defaultProps}
        initialData={{
          name: 'Test',
          startDate: '2026-06-01',
          endDate: '2026-01-01',
          baselineBudget: 0,
        }}
      />,
    );
    fireEvent.submit(screen.getByText('Create').closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('End date must be after start date.')).toBeDefined();
    });
  });

  it('shows error for negative budget', async () => {
    render(
      <ProjectForm
        {...defaultProps}
        initialData={{
          name: 'Test',
          startDate: '2026-01-01',
          endDate: '2026-06-30',
          baselineBudget: -100,
        }}
      />,
    );
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => {
      expect(screen.getByText('Baseline budget cannot be negative.')).toBeDefined();
    });
  });

  it('shows Saving... while submitting', async () => {
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => { resolveSubmit = r; }));
    render(
      <ProjectForm
        onSubmit={onSubmit}
        submitLabel="Create"
        initialData={{
          name: 'Test',
          startDate: '2026-01-01',
          endDate: '2026-06-30',
          baselineBudget: 0,
        }}
      />,
    );
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeDefined();
    });
    resolveSubmit();
  });

  it('shows generic error on submit failure', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('network error'));
    render(
      <ProjectForm
        onSubmit={onSubmit}
        submitLabel="Create"
        initialData={{
          name: 'Test',
          startDate: '2026-01-01',
          endDate: '2026-06-30',
          baselineBudget: 0,
        }}
      />,
    );
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => {
      expect(screen.getByText('Failed to save project.')).toBeDefined();
    });
  });

  it('does not show error on cancelled submission', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('cancelled'));
    render(
      <ProjectForm
        onSubmit={onSubmit}
        submitLabel="Create"
        initialData={{
          name: 'Test',
          startDate: '2026-01-01',
          endDate: '2026-06-30',
          baselineBudget: 0,
        }}
      />,
    );
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(screen.queryByText('Failed to save project.')).toBeNull();
  });

  it('formats baseline budget as currency when not focused', () => {
    render(
      <ProjectForm
        {...defaultProps}
        initialData={{
          name: 'Test',
          startDate: '2026-01-01',
          endDate: '2026-06-30',
          baselineBudget: 50000,
        }}
      />,
    );
    expect(screen.getByDisplayValue('$50,000')).toBeDefined();
  });
});
