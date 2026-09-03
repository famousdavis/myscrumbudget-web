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
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import type { Settings, LaborRate } from '@/types/domain';
import { RateTable, type RoleRenameRequest } from '../RateTable';

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

function renderTable(rates: LaborRate[], onUpdate = vi.fn(), onRenameRole = vi.fn().mockResolvedValue(true)) {
  const utils = render(
    <RateTable
      rates={rates}
      onUpdate={onUpdate}
      onRenameRole={onRenameRole}
      countOrphansIfDeleted={async () => 0}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Labor Rate Table/i }));
  return { ...utils, onUpdate, onRenameRole };
}

/** Resolve the updater the component handed to onUpdate against a settings object. */
function applyUpdate(onUpdate: ReturnType<typeof vi.fn>, rates: LaborRate[]): LaborRate[] {
  const updater = onUpdate.mock.calls[0][0] as (prev: Settings) => Settings;
  return updater({ ...baseSettings, laborRates: rates }).laborRates;
}

/** Save now awaits the page's write, so every click that can rename must be acted. */
async function clickSave() {
  await act(async () => { fireEvent.click(saveButton()); });
}
/** Delete now opens a confirmation; the dialog's confirm is also labelled "Delete". */
async function clickDelete(i: number) {
  await act(async () => { fireEvent.click(deleteButtons()[i]); });
}
function confirmDialogDelete() {
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
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

  it('Save names exactly ONE row by index, leaving its twin untouched', async () => {
    // Re-pointed from `onUpdate` to `onRenameRole` (v0.37.9): a Save that changes the
    // role name no longer writes through the settings updater, because the pool has to
    // move in the same operation. The ORIGINAL point survives unchanged — the row is
    // identified by INDEX, so the twin sharing its name is not touched.
    const { onUpdate, onRenameRole } = renderTable(DUPLICATED);
    startEditingRow(0);
    typeRoleName('Business Analyst');
    await clickSave();

    expect(onRenameRole).toHaveBeenCalledTimes(1);
    expect(onRenameRole).toHaveBeenCalledWith({
      index: 0, oldRole: 'BA', newRole: 'Business Analyst', hourlyRate: 75,
    });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('Save rewrites one row even when clicking the FIRST of the Save buttons on screen', async () => {
    // Deliberately tolerant of how many Save buttons exist, so it demonstrates the
    // WRITE defect directly rather than tripping over the edit-both defect first:
    // against v0.37.3 both rows entered edit mode AND both were rewritten, so this
    // failed on the array contents. Post-fix there is exactly one Save button.
    const { onRenameRole } = renderTable(DUPLICATED);
    startEditingRow(0);
    typeRoleName('Business Analyst');
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    });

    expect(onRenameRole).toHaveBeenCalledTimes(1);
    expect(onRenameRole.mock.calls[0][0].index).toBe(0);
  });

  it('Delete removes exactly ONE row, leaving its twin in place', async () => {
    // Delete is now behind a confirmation (v0.37.9). The row-identity property this
    // test was written for is unchanged and still asserted; only the click sequence
    // moved.
    const { onUpdate } = renderTable(DUPLICATED);
    await clickDelete(0);
    confirmDialogDelete();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(applyUpdate(onUpdate, DUPLICATED)).toEqual([{ role: 'BA', hourlyRate: 90 }]);
  });

  it('Delete removes the SECOND row when the second row is the one clicked', async () => {
    const { onUpdate } = renderTable(DUPLICATED);
    await clickDelete(1);
    confirmDialogDelete();

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

  it('BOUNDARY TWIN: re-casing a row in place is allowed, and CASCADES — "BA" -> "ba"', async () => {
    // ⚠️ A case-only change IS a rename and must take the cascade path. Every rate
    // lookup in the app is exact, so leaving holders on "BA" while the rate row reads
    // "ba" orphans all of them. An implementation short-circuiting on
    // `toLowerCase()` equality — the instinct once COLLISION checking became
    // case-insensitive — would route this through `onUpdate` and fail here.
    const { onUpdate, onRenameRole } = renderTable(UNIQUE);
    startEditingRow(0);
    typeRoleName('ba');

    expect(screen.queryByText(/already exists/)).toBeNull();
    await clickSave();
    expect(onRenameRole).toHaveBeenCalledWith({
      index: 0, oldRole: 'BA', newRole: 'ba', hourlyRate: 75,
    });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('allows a genuine rename to a free name', async () => {
    const { onRenameRole } = renderTable(UNIQUE);
    startEditingRow(1);
    typeRoleName('Security Engineer');
    await clickSave();

    expect(onRenameRole).toHaveBeenCalledWith({
      index: 1, oldRole: 'IT-Security', newRole: 'Security Engineer', hourlyRate: 90,
    });
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
function StatefulHost({
  initial,
  onRenameRole = vi.fn().mockResolvedValue(true),
  orphanCount = 0,
}: {
  initial: LaborRate[];
  onRenameRole?: (c: RoleRenameRequest) => Promise<boolean>;
  orphanCount?: number;
}) {
  const [settings, setSettings] = useState<Settings>({ ...baseSettings, laborRates: initial });
  return (
    <RateTable
      rates={settings.laborRates}
      onUpdate={(u) => setSettings((prev) => u(prev))}
      onRenameRole={onRenameRole}
      countOrphansIfDeleted={async () => orphanCount}
    />
  );
}

describe('RateTable — the table renders the state it actually holds', () => {
  it('shows exactly the surviving rows after deleting one of two same-named rows', async () => {
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
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    });
    confirmDialogDelete();

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

describe('RateTable — rename vs rate-only, and the two double-click properties (v0.37.9)', () => {
  it('[REGRESSION] a rate-only edit neither prompts nor cascades', async () => {
    // ⚠️ [REGRESSION], not a criterion: it passes by construction and exists to stop an
    // over-implementation that routes every Save through the cascade. It is NOT
    // evidence the cascade works.
    const { onUpdate, onRenameRole } = renderTable(UNIQUE);
    startEditingRow(0);
    const rate = screen
      .getAllByRole('spinbutton')
      .find((el) => (el as HTMLInputElement).name === 'editLaborRoleRate')!;
    fireEvent.change(rate, { target: { value: '123' } });
    await clickSave();

    expect(onRenameRole).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(applyUpdate(onUpdate, UNIQUE)).toEqual([
      { role: 'BA', hourlyRate: 123 },
      { role: 'IT-Security', hourlyRate: 90 },
    ]);
  });

  it('a failed rename leaves the edit row OPEN with the new name still typed', async () => {
    // `editingIndex` is this component's private state, so the page cannot reopen the
    // row; the resolved boolean is the only channel. A retry must be one click.
    const onRenameRole = vi.fn().mockResolvedValue(false);
    renderTable(UNIQUE, vi.fn(), onRenameRole);
    startEditingRow(0);
    typeRoleName('Business Analyst');
    await clickSave();

    const stillEditing = roleInputs().find(
      (el) => (el as HTMLInputElement).name === 'editLaborRoleName',
    ) as HTMLInputElement | undefined;
    expect(stillEditing).toBeDefined();
    expect(stillEditing!.value).toBe('Business Analyst');
  });

  it('a successful rename closes the edit row', async () => {
    renderTable(UNIQUE, vi.fn(), vi.fn().mockResolvedValue(true));
    startEditingRow(0);
    typeRoleName('Business Analyst');
    await clickSave();

    expect(roleInputs().filter(
      (el) => (el as HTMLInputElement).name === 'editLaborRoleName',
    )).toHaveLength(0);
  });

  it('[REGRESSION] a double-click on Save fires exactly ONE rename', async () => {
    // ⚠️ [REGRESSION], AND THE REASON IS NOT WHAT THE NAME SUGGESTS. Measured at HEAD
    // before this change: a double-click ALREADY fired exactly one write, because
    // `setEditingIndex(null)` ran SYNCHRONOUSLY and the second click early-returned.
    // Adding `await` to that handler DESTROYS that property — the row is still open
    // when the second click lands. The `saving` flag PRESERVES existing behaviour; it
    // does not add a new guarantee. Remove the flag and this reads two.
    let resolveWrite: (v: boolean) => void = () => {};
    const onRenameRole = vi.fn().mockImplementation(
      () => new Promise<boolean>((res) => { resolveWrite = res; }),
    );
    renderTable(UNIQUE, vi.fn(), onRenameRole);
    startEditingRow(0);
    typeRoleName('Business Analyst');

    const save = saveButton();
    await act(async () => { fireEvent.click(save); });
    await act(async () => { fireEvent.click(save); });
    await act(async () => { resolveWrite(true); });

    expect(onRenameRole).toHaveBeenCalledTimes(1);
  });

  it('a double-click on Delete removes exactly ONE row', async () => {
    /**
     * ⚠️ THIS WAS A LIVE DEFECT, measured against v0.37.8 with this same stateful host:
     * `["BA","IT-SoftEng","IT-DevOps"]` → one click → `["IT-SoftEng","IT-DevOps"]` →
     * a SECOND click on the same node → `["IT-DevOps"]`. `IT-SoftEng` was never
     * clicked. `handleDelete` had no guard, the array shifts under a `key={index}`
     * table, and the second click lands on a button now belonging to a different row —
     * the same family as the v0.37.4 row-identity defect.
     *
     * The confirmation dialog closes it: the first click writes nothing, so there is no
     * shift for the second click to land in.
     */
    render(<StatefulHost initial={[
      { role: 'BA', hourlyRate: 75 },
      { role: 'IT-SoftEng', hourlyRate: 100 },
      { role: 'IT-DevOps', hourlyRate: 80 },
    ]} />);
    fireEvent.click(screen.getByRole('button', { name: /Labor Rate Table/i }));
    const del = screen.getAllByRole('button', { name: 'Delete' })[0];
    await act(async () => { fireEvent.click(del); });
    await act(async () => { fireEvent.click(del); });
    confirmDialogDelete();

    expect(screen.getAllByRole('row').slice(1).map((r) => r.textContent)).toEqual([
      'IT-SoftEng$100EditDelete',
      'IT-DevOps$80EditDelete',
    ]);
  });

  it('Delete prompts with the number of members left with NO rate, not the number holding the name', async () => {
    render(<StatefulHost initial={UNIQUE} orphanCount={3} />);
    fireEvent.click(screen.getByRole('button', { name: /Labor Rate Table/i }));
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]); });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/3 team members would be left with no rate/)).toBeDefined();
  });

  it('deleting one of two same-named rows prompts ZERO, and still deletes exactly that row', async () => {
    // ⚠️ BOTH HALVES IN ONE TEST. "prompts zero" alone would have passed against
    // v0.37.8 for the wrong reason — there was no dialog at all — so the surviving-rows
    // assertion is what makes it a criterion rather than an absence.
    render(<StatefulHost initial={DUPLICATED} orphanCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Labor Rate Table/i }));
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]); });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/No team members would be left without a rate/)).toBeDefined();
    confirmDialogDelete();
    expect(screen.getAllByRole('row').slice(1).map((r) => r.textContent)).toEqual([
      'BA$90EditDelete',
    ]);
  });

  it('Cancel on the delete dialog writes nothing and keeps the row', async () => {
    render(<StatefulHost initial={UNIQUE} />);
    fireEvent.click(screen.getByRole('button', { name: /Labor Rate Table/i }));
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]); });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(2);
  });
});
