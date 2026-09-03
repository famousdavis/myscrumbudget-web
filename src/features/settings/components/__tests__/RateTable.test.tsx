// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * RateTable characterisation + regression tests (v0.37.4).
 *
 * ⚠️ ASSERTION SHAPE, and it is load-bearing here. Before v0.37.4 a refused
 * rename was a SILENT no-op: `handleSaveEdit` early-returned with no message
 * and no state change. So a test asserting *"Save did nothing"* PASSES against
 * the unfixed code — an absence assertion against an already-silent no-op.
 * Every refusal test below therefore asserts the PRESENCE of the inline message
 * AND the exact surviving contents of `laborRates`, never the absence of a change.
 *
 * The row-identity tests use a fixture with TWO rows sharing one name, which is
 * the state the pre-v0.37.4 Save path could actually produce (and which exists in
 * live data). Against v0.37.3 all three fail: Edit opened both rows, Save rewrote
 * both, Delete removed both.
 */

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { Settings, LaborRate } from '@/types/domain';
import { RateTable } from '../RateTable';

const baseSettings: Settings = {
  discountRateAnnual: 0.03,
  laborRates: [],
  holidays: [],
  trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
};

const UNIQUE: LaborRate[] = [
  { role: 'BA', hourlyRate: 75 },
  { role: 'IT-Security', hourlyRate: 90 },
];

/** William's artefact shape: a seeded "BA" plus an IT-Security renamed onto it. */
const DUPLICATED: LaborRate[] = [
  { role: 'BA', hourlyRate: 75 },
  { role: 'BA', hourlyRate: 90 },
];

function renderTable(rates: LaborRate[], onUpdate = vi.fn()) {
  const utils = render(<RateTable rates={rates} onUpdate={onUpdate} />);
  fireEvent.click(screen.getByRole('button', { name: /Labor Rate Table/i }));
  return { ...utils, onUpdate };
}

/** Resolve the updater the component handed to onUpdate against a settings object. */
function applyUpdate(onUpdate: ReturnType<typeof vi.fn>, rates: LaborRate[]): LaborRate[] {
  const updater = onUpdate.mock.calls[0][0] as (prev: Settings) => Settings;
  return updater({ ...baseSettings, laborRates: rates }).laborRates;
}

const roleInputs = () => screen.queryAllByRole('textbox');
const editButtons = () => screen.getAllByRole('button', { name: 'Edit' });
const deleteButtons = () => screen.getAllByRole('button', { name: 'Delete' });
const saveButton = () => screen.getByRole('button', { name: 'Save' });

function startEditingRow(index: number) {
  fireEvent.click(editButtons()[index]);
}

function typeRoleName(value: string) {
  const input = roleInputs()[0];
  fireEvent.change(input, { target: { value } });
  return input;
}

describe('RateTable — row identity (two rows sharing a name)', () => {
  it('Edit opens exactly ONE row', () => {
    renderTable(DUPLICATED);
    startEditingRow(0);
    // Each editing row renders one text input for the role name.
    expect(roleInputs().filter((el) => (el as HTMLInputElement).name === 'editLaborRoleName')).toHaveLength(1);
  });

  it('Save rewrites exactly ONE row, leaving its twin untouched', () => {
    const { onUpdate } = renderTable(DUPLICATED);
    startEditingRow(0);
    typeRoleName('Business Analyst');
    fireEvent.click(saveButton());

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(applyUpdate(onUpdate, DUPLICATED)).toEqual([
      { role: 'Business Analyst', hourlyRate: 75 },
      { role: 'BA', hourlyRate: 90 },
    ]);
  });

  it('Save rewrites one row even when clicking the FIRST of the Save buttons on screen', () => {
    // Deliberately tolerant of how many Save buttons exist, so it demonstrates the
    // WRITE defect directly rather than tripping over the edit-both defect first:
    // against v0.37.3 both rows entered edit mode AND both were rewritten, so this
    // failed on the array contents. Post-fix there is exactly one Save button.
    const { onUpdate } = renderTable(DUPLICATED);
    startEditingRow(0);
    typeRoleName('Business Analyst');
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    const result = applyUpdate(onUpdate, DUPLICATED);
    expect(result.filter((r) => r.role === 'Business Analyst')).toHaveLength(1);
    expect(result.filter((r) => r.role === 'BA')).toHaveLength(1);
  });

  it('Delete removes exactly ONE row, leaving its twin in place', () => {
    const { onUpdate } = renderTable(DUPLICATED);
    fireEvent.click(deleteButtons()[0]);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(applyUpdate(onUpdate, DUPLICATED)).toEqual([{ role: 'BA', hourlyRate: 90 }]);
  });

  it('Delete removes the SECOND row when the second row is the one clicked', () => {
    const { onUpdate } = renderTable(DUPLICATED);
    fireEvent.click(deleteButtons()[1]);

    expect(applyUpdate(onUpdate, DUPLICATED)).toEqual([{ role: 'BA', hourlyRate: 75 }]);
  });
});

describe('RateTable — duplicate refusal on Save', () => {
  it('refuses an exact-case duplicate with a visible message and no write', () => {
    const { onUpdate } = renderTable(UNIQUE);
    startEditingRow(1); // IT-Security
    typeRoleName('BA');

    expect(screen.getByText(/A labor rate named "BA" already exists\./)).toBeDefined();
    fireEvent.click(saveButton());
    expect(onUpdate).not.toHaveBeenCalled();
    // The row is still in edit mode with the typed value retained, so the user can fix it.
    expect((roleInputs()[0] as HTMLInputElement).value).toBe('BA');
  });

  it('refuses a case-ONLY duplicate — "ba" collides with "BA"', () => {
    const { onUpdate } = renderTable(UNIQUE);
    startEditingRow(1);
    typeRoleName('ba');

    expect(screen.getByText(/A labor rate named "BA" already exists\./)).toBeDefined();
    fireEvent.click(saveButton());
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('refuses a duplicate that differs only by surrounding whitespace', () => {
    const { onUpdate } = renderTable(UNIQUE);
    startEditingRow(1);
    typeRoleName('  BA  ');

    expect(screen.getByText(/A labor rate named "BA" already exists\./)).toBeDefined();
    fireEvent.click(saveButton());
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('BOUNDARY TWIN: renaming a row to its OWN name is still allowed', () => {
    // Without index-based self-exclusion this guard would refuse every save.
    const { onUpdate } = renderTable(UNIQUE);
    startEditingRow(0); // BA
    typeRoleName('BA');

    expect(screen.queryByText(/already exists/)).toBeNull();
    fireEvent.click(saveButton());
    expect(applyUpdate(onUpdate, UNIQUE)).toEqual(UNIQUE);
  });

  it('BOUNDARY TWIN: re-casing a row in place is allowed — "BA" -> "ba"', () => {
    const { onUpdate } = renderTable(UNIQUE);
    startEditingRow(0);
    typeRoleName('ba');

    expect(screen.queryByText(/already exists/)).toBeNull();
    fireEvent.click(saveButton());
    expect(applyUpdate(onUpdate, UNIQUE)).toEqual([
      { role: 'ba', hourlyRate: 75 },
      { role: 'IT-Security', hourlyRate: 90 },
    ]);
  });

  it('allows a genuine rename to a free name', () => {
    const { onUpdate } = renderTable(UNIQUE);
    startEditingRow(1);
    typeRoleName('Security Engineer');
    fireEvent.click(saveButton());

    expect(applyUpdate(onUpdate, UNIQUE)).toEqual([
      { role: 'BA', hourlyRate: 75 },
      { role: 'Security Engineer', hourlyRate: 90 },
    ]);
  });
});

describe('RateTable — Save is explained, not dead (SET-6)', () => {
  it('explains and disables Save when the role name is cleared', () => {
    const { onUpdate } = renderTable(UNIQUE);
    startEditingRow(0);
    typeRoleName('   ');

    expect(screen.getByText('Role name is required.')).toBeDefined();
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('explains and disables Save when the hourly rate is negative', () => {
    const { onUpdate } = renderTable(UNIQUE);
    startEditingRow(0);
    // Two number inputs are on screen while editing (the edit row and the Add row),
    // so this must name the one it means.
    const rate = screen
      .getAllByRole('spinbutton')
      .find((el) => (el as HTMLInputElement).name === 'editLaborRoleRate')!;
    fireEvent.change(rate, { target: { value: '-5' } });

    expect(screen.getByText('Hourly rate must be 0 or greater.')).toBeDefined();
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('disables Save on a duplicate name, so the refusal is not a dead click', () => {
    renderTable(UNIQUE);
    startEditingRow(1);
    typeRoleName('BA');
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('Save is enabled for valid input', () => {
    renderTable(UNIQUE);
    startEditingRow(0);
    expect((saveButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('$0/hour is VALID on Save — it is a supported rate, not a missing one', () => {
    // Deliberate product behaviour: infrastructure roles carry a $0 rate so they can
    // appear in a resource plan without contributing cost. The emptiness check must
    // therefore test the STRING ('0' is truthy), never the parsed number (0 is not).
    const { onUpdate } = renderTable(UNIQUE);
    startEditingRow(0);
    const rate = screen
      .getAllByRole('spinbutton')
      .find((el) => (el as HTMLInputElement).name === 'editLaborRoleRate')!;
    fireEvent.change(rate, { target: { value: '0' } });

    expect(screen.queryByRole('alert')).toBeNull();
    expect((saveButton() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(saveButton());
    expect(applyUpdate(onUpdate, UNIQUE)).toEqual([
      { role: 'BA', hourlyRate: 0 },
      { role: 'IT-Security', hourlyRate: 90 },
    ]);
  });
});

describe('RateTable — duplicate refusal on Add', () => {
  const newRoleInput = () => screen.getByPlaceholderText('Role name');
  const newRateInput = () => screen.getByPlaceholderText('Rate');
  const addButton = () => screen.getByRole('button', { name: 'Add' });

  it('explains an exact-case duplicate instead of just greying the button', () => {
    renderTable(UNIQUE);
    fireEvent.change(newRoleInput(), { target: { value: 'BA' } });
    fireEvent.change(newRateInput(), { target: { value: '80' } });

    expect(screen.getByText(/A labor rate named "BA" already exists\./)).toBeDefined();
    expect((addButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('refuses a case-ONLY duplicate on Add — "ba" collides with "BA"', () => {
    const { onUpdate } = renderTable(UNIQUE);
    fireEvent.change(newRoleInput(), { target: { value: 'ba' } });
    fireEvent.change(newRateInput(), { target: { value: '80' } });

    expect(screen.getByText(/A labor rate named "BA" already exists\./)).toBeDefined();
    expect((addButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(addButton());
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('shows no message on the untouched Add row', () => {
    renderTable(UNIQUE);
    expect(screen.queryByText(/already exists/)).toBeNull();
    expect(screen.queryByText('Role name is required.')).toBeNull();
  });

  it('$0/hour is VALID on Add', () => {
    const { onUpdate } = renderTable(UNIQUE);
    fireEvent.change(newRoleInput(), { target: { value: 'Shared Infrastructure' } });
    fireEvent.change(newRateInput(), { target: { value: '0' } });

    expect(screen.queryByRole('alert')).toBeNull();
    expect((addButton() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(addButton());
    expect(applyUpdate(onUpdate, UNIQUE)).toEqual([
      ...UNIQUE,
      { role: 'Shared Infrastructure', hourlyRate: 0 },
    ]);
  });

  it('adds a genuinely new role', () => {
    const { onUpdate } = renderTable(UNIQUE);
    fireEvent.change(newRoleInput(), { target: { value: 'QA Engineer' } });
    fireEvent.change(newRateInput(), { target: { value: '65' } });
    fireEvent.click(addButton());

    expect(applyUpdate(onUpdate, UNIQUE)).toEqual([...UNIQUE, { role: 'QA Engineer', hourlyRate: 65 }]);
  });
});

/**
 * A stateful host, because the defect below is only visible when the table is
 * re-rendered with the array its own update produced. Every other test here spies
 * on the updater and never feeds the result back.
 */
function StatefulHost({ initial }: { initial: LaborRate[] }) {
  const [settings, setSettings] = useState<Settings>({ ...baseSettings, laborRates: initial });
  return (
    <RateTable rates={settings.laborRates} onUpdate={(u) => setSettings((prev) => u(prev))} />
  );
}

describe('RateTable — the table renders the state it actually holds', () => {
  it('shows exactly the surviving rows after deleting one of two same-named rows', () => {
    // ⚠️ Measured on v0.37.3, browser and jsdom alike: this rendered THREE rows
    // ("BA $75", "IT-SoftEng $100", "IT-DevOps $80") out of a TWO-element array.
    // `key={rate.role}` gave both "BA" rows one key, so React's keyed diff kept a
    // stale DOM node alive — and the row it kept was the one the user had just
    // clicked Delete on. The immediate feedback therefore showed the clicked row
    // surviving and an untouched row vanishing; only a reload revealed that BOTH
    // "BA" rows were gone from storage. A test that only inspects the updater's
    // output cannot see this, which is why this one re-renders from real state.
    render(<StatefulHost initial={[
      { role: 'BA', hourlyRate: 75 },
      { role: 'IT-SoftEng', hourlyRate: 100 },
      { role: 'BA', hourlyRate: 90 },
      { role: 'IT-DevOps', hourlyRate: 80 },
    ]} />);
    fireEvent.click(screen.getByRole('button', { name: /Labor Rate Table/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    const rendered = screen.getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(rendered).toEqual([
      'IT-SoftEng$100EditDelete',
      'BA$90EditDelete',
      'IT-DevOps$80EditDelete',
    ]);
  });
});

describe('RateTable — rendering', () => {
  it('renders every row even when two share a name', () => {
    renderTable(DUPLICATED);
    const rows = screen.getAllByRole('row').slice(1); // drop the header row
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('$75')).toBeDefined();
    expect(within(rows[1]).getByText('$90')).toBeDefined();
  });

  it('Cancel leaves the rates untouched', () => {
    const { onUpdate } = renderTable(UNIQUE);
    startEditingRow(0);
    typeRoleName('Something else');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('BA')).toBeDefined();
  });
});
