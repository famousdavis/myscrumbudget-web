// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { Project, Reforecast } from '@/types/domain';

// Mock the toast hook BEFORE importing the component so the mock is used.
const addToast = vi.fn();
vi.mock('@/components/Toast', () => ({
  useToast: () => ({ addToast }),
}));

import { HistoricalCostsTable } from '../HistoricalCostsTable';

function makeReforecast(overrides: Partial<Reforecast> = {}): Reforecast {
  return {
    id: 'rf-1',
    name: 'Baseline',
    createdAt: '2026-01-01T00:00:00Z',
    startDate: '2026-01',
    reforecastDate: '2026-01-15',
    assignments: [],
    allocations: [],
    productivityWindows: [],
    actualCost: 50000,
    baselineBudget: 100000,
    actualsThroughDate: '2026-03-15',
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p-1',
    name: 'Test',
    startDate: '2026-01-15',
    endDate: '2026-12-31',
    reforecasts: [],
    activeReforecastId: 'rf-1',
    ...overrides,
  };
}

beforeEach(() => {
  addToast.mockClear();
});

describe('HistoricalCostsTable', () => {
  it('renders null when actualsThroughDate is undefined', () => {
    const rf = makeReforecast({ actualsThroughDate: undefined });
    const { container } = render(
      <HistoricalCostsTable
        activeReforecast={rf}
        project={makeProject()}
        onUpdate={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders null when buildHistoricalCostsView returns no rows (no cutoff path)', () => {
    // Empty actualsThroughDate string also signals "no cutoff" via the view layer
    const rf = makeReforecast({ actualsThroughDate: '' });
    const { container } = render(
      <HistoricalCostsTable
        activeReforecast={rf}
        project={makeProject()}
        onUpdate={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('is collapsed by default; rows hidden until expanded', () => {
    render(
      <HistoricalCostsTable
        activeReforecast={makeReforecast()}
        project={makeProject()}
        onUpdate={vi.fn()}
      />,
    );
    // Toggle button is visible
    expect(screen.getByRole('button', { name: /historical costs breakdown/i })).toBeDefined();
    // No table rendered while collapsed
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows one row per month from project start to cutoff (inclusive) when expanded', () => {
    const rf = makeReforecast({ actualsThroughDate: '2026-03-15' });
    render(
      <HistoricalCostsTable
        activeReforecast={rf}
        project={makeProject({ startDate: '2026-01-15' })}
        onUpdate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /historical costs breakdown/i }));
    const table = screen.getByRole('table');
    // 1 header row + 3 data rows (Jan, Feb, Mar) + 1 footer row = 5 total
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(5);
  });

  it('cutoff-bucket row is read-only — no input rendered for it', () => {
    render(
      <HistoricalCostsTable
        activeReforecast={makeReforecast()}
        project={makeProject({ startDate: '2026-01-15' })}
        onUpdate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /historical costs breakdown/i }));
    // Earlier months (Jan, Feb) → 2 inputs; cutoff (Mar) is currency text, no input
    const inputs = screen.getAllByRole('spinbutton'); // <input type="number">
    expect(inputs).toHaveLength(2);
  });

  it('editing an earlier row calls onUpdate with the upserted entries array', () => {
    const onUpdate = vi.fn();
    render(
      <HistoricalCostsTable
        activeReforecast={makeReforecast()}
        project={makeProject({ startDate: '2026-01-15' })}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /historical costs breakdown/i }));
    const inputs = screen.getAllByRole('spinbutton');
    // First input is January (earliest non-cutoff month)
    fireEvent.change(inputs[0], { target: { value: '5000' } });
    fireEvent.blur(inputs[0]);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith([
      { month: '2026-01', cost: 5000, hours: 0 },
    ]);
  });

  it('editing a row to 0 removes that entry from the stored array', () => {
    const onUpdate = vi.fn();
    const rf = makeReforecast({
      historicalCosts: [
        { month: '2026-01', cost: 10000, hours: 0 },
        { month: '2026-02', cost: 5000, hours: 0 },
      ],
    });
    render(
      <HistoricalCostsTable
        activeReforecast={rf}
        project={makeProject({ startDate: '2026-01-15' })}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /historical costs breakdown/i }));
    const inputs = screen.getAllByRole('spinbutton');
    // Second input is February — clear it
    fireEvent.change(inputs[1], { target: { value: '0' } });
    fireEvent.blur(inputs[1]);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    // February is gone; January remains
    expect(onUpdate).toHaveBeenCalledWith([
      { month: '2026-01', cost: 10000, hours: 0 },
    ]);
  });

  it('over-allocation clamps to ceiling, fires "Capped at $X" toast (error variant), and stores clamped value', () => {
    const onUpdate = vi.fn();
    const rf = makeReforecast({
      actualCost: 50000,
      historicalCosts: [{ month: '2026-02', cost: 20000, hours: 0 }],
    });
    render(
      <HistoricalCostsTable
        activeReforecast={rf}
        project={makeProject({ startDate: '2026-01-15' })}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /historical costs breakdown/i }));
    const inputs = screen.getAllByRole('spinbutton');
    // Try to enter $40k for Jan when ceiling is $30k (50k - 20k other)
    fireEvent.change(inputs[0], { target: { value: '40000' } });
    fireEvent.blur(inputs[0]);

    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenCalledWith(
      expect.stringContaining('Capped at'),
      'error',
    );
    // Clamped value $30k is stored
    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([
        { month: '2026-01', cost: 30000, hours: 0 },
      ]),
    );
  });

  it('renders dark-mode classes on container and cells', () => {
    const { container } = render(
      <HistoricalCostsTable
        activeReforecast={makeReforecast()}
        project={makeProject()}
        onUpdate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /historical costs breakdown/i }));
    // Outer container should have a dark border class
    const outer = container.querySelector('.dark\\:border-zinc-800');
    expect(outer).not.toBeNull();
    // Header should have dark bg
    const darkBg = container.querySelector('.dark\\:bg-zinc-900');
    expect(darkBg).not.toBeNull();
  });

  it('Enter key blurs the input, committing the typed value via onBlur', () => {
    const onUpdate = vi.fn();
    render(
      <HistoricalCostsTable
        activeReforecast={makeReforecast()}
        project={makeProject({ startDate: '2026-01-15' })}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /historical costs breakdown/i }));
    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    inputs[0].focus();
    fireEvent.change(inputs[0], { target: { value: '7500' } });
    expect(document.activeElement).toBe(inputs[0]);
    fireEvent.keyDown(inputs[0], { key: 'Enter' });
    // Enter should have triggered blur, which fires the commit
    expect(document.activeElement).not.toBe(inputs[0]);
    expect(onUpdate).toHaveBeenCalledWith([
      { month: '2026-01', cost: 7500, hours: 0 },
    ]);
  });

  it('Escape key resets the input value to row.cost and blurs without committing a change', () => {
    const onUpdate = vi.fn();
    const rf = makeReforecast({
      historicalCosts: [{ month: '2026-01', cost: 4000, hours: 0 }],
    });
    render(
      <HistoricalCostsTable
        activeReforecast={rf}
        project={makeProject({ startDate: '2026-01-15' })}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /historical costs breakdown/i }));
    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    inputs[0].focus();
    fireEvent.change(inputs[0], { target: { value: '99999' } });
    fireEvent.keyDown(inputs[0], { key: 'Escape' });
    // Value should have been reset to the original 4000
    expect(inputs[0].value).toBe('4000');
    // Blur fires after Escape, but the noChange short-circuit prevents an onUpdate call
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('footer total equals reforecast.actualCost', () => {
    render(
      <HistoricalCostsTable
        activeReforecast={makeReforecast({ actualCost: 75000 })}
        project={makeProject()}
        onUpdate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /historical costs breakdown/i }));
    const footer = screen.getByRole('table').querySelector('tfoot');
    expect(footer?.textContent).toContain('Total');
    expect(footer?.textContent).toContain('75,000');
  });
});
