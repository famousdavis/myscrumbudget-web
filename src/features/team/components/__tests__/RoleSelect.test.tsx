// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * RoleSelect characterisation + regression tests (v0.37.4).
 *
 * ⚠️ HOW AN ORPHANED ROLE ACTUALLY RENDERS, measured 2026-09-03. When the
 * controlled `value` names a role that is absent from `laborRates`, NO option
 * matches it, and React's select reconciliation then selects the FIRST option —
 * so the user sees "Select role..." at `selectedIndex === 0` while state still
 * holds the removed role. (A raw DOM select with no matching option reports
 * `selectedIndex === -1`; React's controlled-select path does not. The criterion
 * below is written against 0 because that is what this component does.)
 *
 * The consequence that shapes the fix: the placeholder-styling branch is
 * `value === ''`, which is FALSE for an orphan even though the placeholder is
 * exactly what is on screen. So the "(rate removed)" option is keyed off the
 * MISMATCH, never off an empty value.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LaborRate } from '@/types/domain';
import { RoleSelect } from '../RoleSelect';

const RATES: LaborRate[] = [
  { role: 'BA', hourlyRate: 75 },
  { role: 'IT-Security', hourlyRate: 90 },
];

const select = () => screen.getByRole('combobox') as HTMLSelectElement;

describe('RoleSelect — orphaned role (SET-8)', () => {
  it('keeps an orphaned role selected and labels it "(rate removed)"', () => {
    render(<RoleSelect value="Developer" laborRates={RATES} onChange={vi.fn()} />);

    const orphan = screen.getByRole('option', { name: /Developer \(rate removed\)/ }) as HTMLOptionElement;
    expect(orphan.disabled).toBe(true);
    // The DOM matches a controlled value to an option by value alone — `disabled`
    // does not exclude it from selection, which is what makes this affordance work.
    expect(select().value).toBe('Developer');
    expect(select().selectedIndex).toBe(orphan.index);
    expect(select().selectedIndex).not.toBe(0);
  });

  it('does not offer the orphan as a re-pickable choice', () => {
    render(<RoleSelect value="Developer" laborRates={RATES} onChange={vi.fn()} />);
    const enabled = screen
      .getAllByRole('option')
      .filter((o) => !(o as HTMLOptionElement).disabled)
      .map((o) => (o as HTMLOptionElement).value);
    expect(enabled).toEqual(['', 'BA', 'IT-Security']);
  });

  it('adds no "(rate removed)" option when the role is a real rate', () => {
    render(<RoleSelect value="BA" laborRates={RATES} onChange={vi.fn()} />);
    expect(screen.queryByText(/rate removed/)).toBeNull();
    expect(select().value).toBe('BA');
    expect(screen.getAllByRole('option')).toHaveLength(3); // placeholder + 2 rates
  });

  it('adds no "(rate removed)" option for the empty placeholder value', () => {
    // The mismatch predicate must not fire on '' — that is the normal unset state.
    render(<RoleSelect value="" laborRates={RATES} onChange={vi.fn()} />);
    expect(screen.queryByText(/rate removed/)).toBeNull();
    expect(select().selectedIndex).toBe(0);
  });

  it('matches an orphan case-sensitively — "ba" is not "BA"', () => {
    // Rate LOOKUPS stay exact-match everywhere (costs.ts, excelImport.ts); only the
    // RateTable uniqueness guard is case-insensitive. A differently-cased role is a
    // genuine orphan, and saying so is the honest reading.
    render(<RoleSelect value="ba" laborRates={RATES} onChange={vi.fn()} />);
    expect(screen.getByRole('option', { name: /ba \(rate removed\)/ })).toBeDefined();
  });
});

describe('RoleSelect — rendering', () => {
  it('renders one option per labor rate with its hourly rate', () => {
    render(<RoleSelect value="" laborRates={RATES} onChange={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'BA ($75/hr)' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'IT-Security ($90/hr)' })).toBeDefined();
  });

  it('renders both rows when two rates share a name (duplicate React keys)', () => {
    // Pre-v0.37.4 the option map keyed on `rate.role`, so a duplicated name emitted
    // a React duplicate-key warning. Legacy data can still hold one.
    const dupes: LaborRate[] = [
      { role: 'BA', hourlyRate: 75 },
      { role: 'BA', hourlyRate: 90 },
    ];
    render(<RoleSelect value="BA" laborRates={dupes} onChange={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'BA ($75/hr)' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'BA ($90/hr)' })).toBeDefined();
    expect(screen.queryByText(/rate removed/)).toBeNull();
  });
});

describe('RoleSelect — settings not yet loaded (v0.37.6)', () => {
  /**
   * ⚠️ THE DISCRIMINATING PAIR. `undefined` and `[]` must behave DIFFERENTLY, and a test
   * with only one of them passes under both the correct implementation and the naive
   * `laborRates ?? []`. This is the same pair `AllocationGridRow` needed, expressed the
   * same way on purpose: the two orphan predicates are one rule and should read as one.
   */
  it('marks NOTHING as removed while laborRates is undefined', () => {
    render(<RoleSelect value="BA" laborRates={undefined} onChange={vi.fn()} />);
    expect(screen.queryByText(/rate removed/)).toBeNull();
    // Only the placeholder is offered: there are no rates to list yet. The window is
    // mount-only and holds no non-empty select in practice, so this is what the user
    // would see if it were ever reached, and it claims nothing false.
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(select().selectedIndex).toBe(0);
  });

  it('DOES mark a role removed when the list is loaded and genuinely empty', () => {
    render(<RoleSelect value="BA" laborRates={[]} onChange={vi.fn()} />);
    const orphan = screen.getByRole('option', { name: /BA \(rate removed\)/ }) as HTMLOptionElement;
    expect(orphan.disabled).toBe(true);
    expect(select().value).toBe('BA');
  });

  it('marks nothing when the prop is omitted entirely', () => {
    render(<RoleSelect value="BA" onChange={vi.fn()} />);
    expect(screen.queryByText(/rate removed/)).toBeNull();
  });

  it('renders the placeholder normally when nothing is selected and nothing is loaded', () => {
    render(<RoleSelect value="" laborRates={undefined} onChange={vi.fn()} />);
    expect(select().selectedIndex).toBe(0);
    expect(screen.queryByText(/rate removed/)).toBeNull();
  });
});
