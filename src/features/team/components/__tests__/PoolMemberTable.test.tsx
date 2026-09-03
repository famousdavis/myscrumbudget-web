// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The resting-row orphan marker (v0.37.10).
 *
 * ⚠️ THE FIRST TEST IS ONE FIXTURE ON PURPOSE. "No member is marked while settings are
 * unresolved" is a pure ABSENCE, and an absence is satisfied by the marker not existing
 * at all — it would pass against every version of this file before v0.37.10. It is only
 * evidence when the SAME fixture goes on to show the marker appearing once settings
 * resolve. Do not split it into two `it()` blocks.
 *
 * ⚠️ `PoolMemberTable` had no test file before this one. It was LOADED by
 * `src/app/team/__tests__/page.test.tsx`, which is not the same as being tested.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { LaborRate, PoolMember } from '@/types/domain';
import { PoolMemberTable } from '../PoolMemberTable';

const RATES: LaborRate[] = [
  { role: 'BA', hourlyRate: 75 },
  { role: 'IT-Security', hourlyRate: 90 },
];

/** Alice has a rate. Grace does not. Cara does not AND is archived. Eve differs by case. */
const POOL: PoolMember[] = [
  { id: 'pm1', name: 'Alice', role: 'BA' },
  { id: 'pm2', name: 'Grace', role: 'Data Engineer' },
  { id: 'pm3', name: 'Cara', role: 'Data Engineer', archived: true },
  { id: 'pm4', name: 'Eve', role: 'ba' },
];

const noop = vi.fn();
function renderTable(pool: PoolMember[], laborRates: LaborRate[] | undefined) {
  return render(
    <PoolMemberTable
      pool={pool}
      laborRates={laborRates}
      onUpdate={noop}
      onArchive={noop}
      onUnarchive={noop}
      onDelete={vi.fn().mockResolvedValue({ ok: true })}
    />,
  );
}
const markers = () => screen.queryAllByText(/\(rate removed\)/);
/** A resting row renders no select; an editing one does. */
const selectsOnScreen = () => screen.queryAllByRole('combobox');

describe('PoolMemberTable — the resting-row orphan marker', () => {
  it('marks nobody while settings are unresolved, AND marks the orphan once they resolve', () => {
    // ⚠️ BOTH HALVES, ONE FIXTURE. Pass 1 alone would pass against any earlier version
    // of this component, because there was no marker to withhold.
    const { rerender } = renderTable(POOL, undefined);

    // Pass 1 — `laborRates === undefined` means "not loaded", not "no rates exist".
    expect(markers()).toHaveLength(0);
    expect(selectsOnScreen()).toHaveLength(0);   // nothing was opened for editing

    // Pass 2 — same rows, settings now resolved.
    rerender(
      <PoolMemberTable
        pool={POOL}
        laborRates={RATES}
        onUpdate={noop}
        onArchive={noop}
        onUnarchive={noop}
        onDelete={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );
    expect(screen.getByText('Data Engineer (rate removed)')).toBeDefined();
    // ⚠️ NO EDIT CLICK. Until v0.37.10 the marker existed only inside `RoleSelect`,
    // which a resting row does not render — so an orphaned role was invisible to a
    // user with no reason to open the row.
    expect(selectsOnScreen()).toHaveLength(0);
  });

  it('an EMPTY rate list is "loaded with no rates" and marks everybody', () => {
    // The counterpart to the loading case, and the reason the predicate cannot be
    // `!laborRates?.some(...)`: `[]` and `undefined` must behave differently.
    renderTable(POOL, []);
    expect(markers().length).toBe(3);   // Alice, Grace, Eve — the three active rows
  });

  it('matches EXACTLY — "Eve" holding "ba" is marked even though a "BA" rate exists', () => {
    renderTable(POOL, RATES);
    const rows = screen.getAllByRole('row').slice(1);
    const eve = rows.find((r) => r.textContent?.startsWith('Eve'))!;
    expect(within(eve).getByText('ba (rate removed)')).toBeDefined();
    const alice = rows.find((r) => r.textContent?.startsWith('Alice'))!;
    expect(within(alice).queryByText(/rate removed/)).toBeNull();
  });

  it('a member WITH a rate is rendered as plain text, not marked', () => {
    renderTable(POOL, RATES);
    const alice = screen.getAllByRole('row').find((r) => r.textContent?.startsWith('Alice'))!;
    expect(within(alice).getByText('BA')).toBeDefined();
    expect(within(alice).queryByText(/rate removed/)).toBeNull();
  });

  it('an ARCHIVED orphan is marked too — and the row must be revealed first', () => {
    // ⚠️ Archived rows are hidden behind the "Show archived (N)" toggle. Without the
    // click this test would silently assert over a 3-row subset and pass for the wrong
    // reason. Archived members still resolve inside saved reforecasts and are still
    // costed, so an orphaned one matters exactly as much as an active one.
    renderTable(POOL, RATES);
    expect(markers()).toHaveLength(2);           // Grace + Eve; Cara is hidden
    fireEvent.click(screen.getByRole('button', { name: /Show archived \(1\)/ }));
    expect(markers()).toHaveLength(3);           // Cara now visible and marked
    const cara = screen.getAllByRole('row').find((r) => r.textContent?.startsWith('Cara'))!;
    expect(within(cara).getByText('Data Engineer (rate removed)')).toBeDefined();
  });

  it('the marker carries an explanation of what it costs', () => {
    renderTable(POOL, RATES);
    expect(screen.getByText('Data Engineer (rate removed)').getAttribute('title'))
      .toContain('costed at $0');
  });
});
