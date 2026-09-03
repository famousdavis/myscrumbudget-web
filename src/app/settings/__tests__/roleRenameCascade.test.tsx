// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The labor-rate role rename cascade, driven through the REAL Settings page.
 *
 * ⚠️ THE PAGE IS THE UNIT ON PURPOSE, and the reason is the v0.37.6 lesson: nothing at
 * component level can hold a page-level expression. `RateTable`'s own tests pass a
 * stubbed `onRenameRole` and stay green no matter what the page does with it. Only a
 * test that renders the real page with the real handler can fail when the storage
 * read-modify-write is replaced by hook state, or when the flush is dropped.
 *
 * ⚠️ ONE SHARED REPOSITORY INSTANCE. Two `createLocalStorageRepository()` instances read
 * the same localStorage and look equivalent, but a spy on one never sees calls on the
 * other — the v0.37.0 scar. The provider mock hands out exactly one.
 *
 * ⚠️ Three modules must be mocked to mount this page, and the second two are the ones
 * that get forgotten: `RepositoryProvider` (the storage seam), `Toast` — BOTH
 * `addToastGlobal` (used by the hooks) AND `useToast` (used by `HolidayTable` and by the
 * page itself) — and `AuthProvider`, because `CloudStorageSection` calls `useAuth` and
 * throws outside a provider.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, renderHook, within } from '@testing-library/react';
import type { Repository } from '@/lib/storage/repository';
import type { PoolMember, Settings } from '@/types/domain';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import { STORAGE_KEYS } from '@/types/storage';

const { shared, toasts } = vi.hoisted(() => ({
  shared: { ctx: null as unknown as { repository: Repository; mode: string; isCloud: boolean; switchMode: () => void } },
  toasts: [] as { message: string; variant?: string }[],
}));

vi.mock('@/components/RepositoryProvider', () => ({ useRepository: () => shared.ctx }));
vi.mock('@/components/Toast', () => ({
  addToastGlobal: vi.fn(),
  useToast: () => ({ addToast: (message: string, variant?: string) => { toasts.push({ message, variant }); } }),
}));
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

import SettingsPage from '../page';
import { useTeamPool } from '@/features/team/hooks/useTeamPool';
import { getChangeLog } from '@/lib/storage/fingerprint';

const RATES = [
  { role: 'BA', hourlyRate: 75 },
  { role: 'IT-Security', hourlyRate: 90 },
];
const baseSettings: Settings = {
  discountRateAnnual: 0.03,
  laborRates: RATES,
  holidays: [],
  trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
};
/** Alice + Bob hold "BA"; Cara holds it and is archived; Eve holds lowercase "ba". */
const POOL: PoolMember[] = [
  { id: 'pm1', name: 'Alice', role: 'BA' },
  { id: 'pm2', name: 'Bob', role: 'BA' },
  { id: 'pm3', name: 'Cara', role: 'BA', archived: true },
  { id: 'pm4', name: 'Dan', role: 'IT-Security' },
  { id: 'pm5', name: 'Eve', role: 'ba' },
];

let repo: Repository;

async function seed(settings: Settings = baseSettings, pool: PoolMember[] = POOL) {
  localStorage.clear();
  toasts.length = 0;
  repo = createLocalStorageRepository();
  shared.ctx = { repository: repo, mode: 'local', isCloud: false, switchMode: () => {} };
  await repo.saveSettings(settings);
  await repo.saveTeamPool(pool);
}

async function openRates() {
  await waitFor(() => expect(screen.getByRole('button', { name: /Labor Rate Table/i })).toBeDefined());
  fireEvent.click(screen.getByRole('button', { name: /Labor Rate Table/i }));
}

/** Edit row `index`, type `name`, click Save, and let the write settle. */
async function rename(index: number, name: string) {
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[index]);
  fireEvent.change(
    screen.getAllByRole('textbox').find((e) => (e as HTMLInputElement).name === 'editLaborRoleName')!,
    { target: { value: name } },
  );
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
}

beforeEach(async () => { await seed(); });
afterEach(() => { vi.useRealTimers(); });

describe('role rename cascade — the pool moves with the rate', () => {
  it('renames every holder, and the toast reports N with the archived count beside it', async () => {
    render(<SettingsPage />);
    await openRates();
    await rename(0, 'Business Analyst');

    const pool = await repo.getTeamPool();
    expect(pool.filter((m) => m.role === 'Business Analyst').map((m) => m.id))
      .toEqual(['pm1', 'pm2', 'pm3']);
    expect(toasts.at(-1)!.message).toBe('Renamed to "Business Analyst" for 3 team members (1 archived).');
  });

  it('renames holders of "BA" and leaves the "ba" holder alone', async () => {
    render(<SettingsPage />);
    await openRates();
    await rename(0, 'Business Analyst');

    const pool = await repo.getTeamPool();
    expect(pool.find((m) => m.id === 'pm5')!.role).toBe('ba');
    expect(pool.find((m) => m.id === 'pm1')!.role).toBe('Business Analyst');
  });

  it('a CASE-ONLY rename cascades, and the rate the holders resolve to is unchanged', async () => {
    render(<SettingsPage />);
    await openRates();
    await rename(0, 'ba');

    const stored = await repo.getSettings();
    const pool = await repo.getTeamPool();
    expect(pool.filter((m) => ['pm1', 'pm2', 'pm3'].includes(m.id)).map((m) => m.role))
      .toEqual(['ba', 'ba', 'ba']);
    // Cost is unchanged because the rate row moved with them: same $75, new spelling.
    expect(stored.laborRates[0]).toEqual({ role: 'ba', hourlyRate: 75 });
    expect(pool.every((m) => m.role !== 'ba' || stored.laborRates.some((r) => r.role === m.role)))
      .toBe(true);
  });

  it('a rename that also changes the rate writes BOTH halves in ONE repository call', async () => {
    const spy = vi.spyOn(repo, 'saveSettingsAndTeamPool');
    render(<SettingsPage />);
    await openRates();
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    fireEvent.change(
      screen.getAllByRole('textbox').find((e) => (e as HTMLInputElement).name === 'editLaborRoleName')!,
      { target: { value: 'Business Analyst' } },
    );
    fireEvent.change(
      screen.getAllByRole('spinbutton').find((e) => (e as HTMLInputElement).name === 'editLaborRoleRate')!,
      { target: { value: '99' } },
    );
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });

    expect(spy).toHaveBeenCalledTimes(1);
    const [settingsArg, poolArg] = spy.mock.calls[0];
    expect(settingsArg.laborRates[0]).toEqual({ role: 'Business Analyst', hourlyRate: 99 });
    expect(poolArg.filter((m) => m.role === 'Business Analyst')).toHaveLength(3);
  });

  it('the rate table shows the new name with no reload, and updateSettings was NOT used', async () => {
    // ⚠️ The write bypasses `updateSettings`, so the hook's state is stale afterwards
    // and only the bus emit refreshes it. Asserting the name alone would have passed
    // before this change, when `updateSettings` updated React state directly — the
    // `saveSettings` spy is what makes this discriminate.
    const settingsOnlySpy = vi.spyOn(repo, 'saveSettings');
    render(<SettingsPage />);
    await openRates();
    await rename(0, 'Business Analyst');

    await waitFor(() => expect(screen.queryByText('Business Analyst')).not.toBeNull());
    expect(screen.queryByText('BA')).toBeNull();
    expect(settingsOnlySpy).not.toHaveBeenCalled();
  });

  it('writes ONE change-log entry carrying N, and sets _originRef', async () => {
    expect(localStorage.getItem(STORAGE_KEYS.originRef)).toBeNull();
    render(<SettingsPage />);
    await openRates();
    await rename(0, 'Business Analyst');

    const entries = getChangeLog().filter((e) => e.entity === 'pool-member');
    expect(entries).toHaveLength(1);
    expect(entries[0].count).toBe(3);
    expect(localStorage.getItem(STORAGE_KEYS.originRef)).not.toBeNull();
  });
});

describe('role rename cascade — the guards', () => {
  it('survives a fresh team-pool hook reading storage right after the rename', async () => {
    /**
     * ⚠️ THE DEFECT THIS WHOLE CHANGE EXISTS FOR. With two debounced writes: leave
     * Settings inside 500 ms, the Team page's fresh `useTeamPool` reads PRE-cascade
     * storage, the orphaned timer then writes the cascade, and the next pool edit
     * persists the stale array over it. The rename is gone, with no error and no toast.
     */
    render(<SettingsPage />);
    await openRates();
    await rename(0, 'Business Analyst');

    // A fresh hook, exactly as mounting /team would produce.
    const { result } = renderHook(() => useTeamPool());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // ...and an edit to a member who had nothing to do with the rename.
    await act(async () => { result.current.archivePoolMember('pm4'); });
    await act(async () => { await result.current.flush(); });

    const pool = await repo.getTeamPool();
    expect(pool.filter((m) => m.role === 'Business Analyst')).toHaveLength(3);
    expect(pool.find((m) => m.id === 'pm4')!.archived).toBe(true);
  });

  it('a pending settings save cannot revert the rename after it lands', async () => {
    /**
     * ⚠️ GUARD 4.2. A debounced `saveSettings` queued before the rename carries the whole
     * Settings object; its mergeFields cover `laborRates` but NOT `teamPool`, so landing
     * afterwards it reverts the rates only and orphans everyone. The handler flushes first.
     *
     * ⚠️⚠️ THE FIRST VERSION OF THIS TEST WAS VACUOUS AND FALSIFICATION IS WHAT CAUGHT IT.
     * Removing `await flush()` from the handler failed NOTHING. The cause was the setup,
     * not the assertion: `ThresholdSettings` keeps a LOCAL BUFFER (the v0.31.0 A3 echo
     * guard) and commits on BLUR, so `fireEvent.change` alone never called `onUpdate` and
     * no save was ever pending. The test asserted a property its own setup never created.
     * Hence the blur below, and hence the explicit precondition assertion — a test for a
     * flush must PROVE there was something to flush.
     */
    const saveSettingsSpy = vi.spyOn(repo, 'saveSettings');
    const order: string[] = [];
    saveSettingsSpy.mockImplementation(async (s) => { order.push('saveSettings'); void s; });
    const atomicSpy = vi.spyOn(repo, 'saveSettingsAndTeamPool');
    const realAtomic = atomicSpy.getMockImplementation();
    void realAtomic;

    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<SettingsPage />);
    await openRates();

    fireEvent.click(screen.getByRole('button', { name: /Dashboard Thresholds/i }));
    const amber = screen.getAllByRole('spinbutton').find(
      (e) => (e as HTMLInputElement).value === '5',
    )!;
    fireEvent.change(amber, { target: { value: '7' } });
    fireEvent.blur(amber);   // ⚠️ REQUIRED — commit is on blur, not on change.

    // PRECONDITION, asserted rather than assumed: a save is queued and has not run.
    expect(saveSettingsSpy).not.toHaveBeenCalled();

    atomicSpy.mockImplementation(async (s, p) => {
      order.push('saveSettingsAndTeamPool');
      await createLocalStorageRepository().saveSettingsAndTeamPool(s, p);
    });

    await rename(0, 'Business Analyst');
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });

    // ⚠️ THE DISCRIMINATOR IS THE ORDER. Flushed, the stale settings save lands BEFORE
    // the atomic write and is harmlessly overwritten. Unflushed, its timer fires AFTER
    // and reverts `laborRates` while leaving `teamPool` renamed — orphaning everyone.
    expect(order).toEqual(['saveSettings', 'saveSettingsAndTeamPool']);

    const stored = await repo.getSettings();
    const pool = await repo.getTeamPool();
    expect(stored.laborRates[0].role).toBe('Business Analyst');
    expect(pool.filter((m) => m.role === 'Business Analyst')).toHaveLength(3);
  });

  it('an out-of-band settings change that does NOT move the edited row is preserved', async () => {
    /**
     * ⚠️ STEP 4 — build BOTH next objects from the STORED values, never from hook state.
     * ⚠️⚠️ ALSO CAUGHT BY FALSIFICATION: rebuilding from hook state failed NOTHING in the
     * first version of this file, because in every other test hook state and storage
     * agree at the moment of the write. They have to be made to DIVERGE somewhere the
     * divergence guard does not fire — the guard only compares `laborRates[index].role`,
     * so a change to any OTHER settings field slips past it and is silently discarded by
     * a hook-state rebuild.
     */
    render(<SettingsPage />);
    await openRates();
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    fireEvent.change(
      screen.getAllByRole('textbox').find((e) => (e as HTMLInputElement).name === 'editLaborRoleName')!,
      { target: { value: 'Business Analyst' } },
    );
    // Another tab changes an unrelated field. `laborRates[0].role` is untouched, so the
    // divergence guard correctly does NOT abort.
    await repo.saveSettings({ ...baseSettings, discountRateAnnual: 0.99 });

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });

    const stored = await repo.getSettings();
    expect(stored.laborRates[0].role).toBe('Business Analyst');
    expect(stored.discountRateAnnual).toBe(0.99);   // NOT reverted to the hook's 0.03
  });

  it('aborts when the stored rates changed under the open edit row', async () => {
    // ⚠️ `RateTable` is index-addressed and nothing resets `editingIndex` when the rates
    // change beneath it. Renaming on a stale index would move every holder of a
    // DIFFERENT role. The handler re-reads storage and compares before writing anything.
    render(<SettingsPage />);
    await openRates();
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    fireEvent.change(
      screen.getAllByRole('textbox').find((e) => (e as HTMLInputElement).name === 'editLaborRoleName')!,
      { target: { value: 'Business Analyst' } },
    );
    // Storage moves under the open row — another tab, or a cloud sync.
    await repo.saveSettings({ ...baseSettings, laborRates: [{ role: 'Analyst', hourlyRate: 75 }, RATES[1]] });

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });

    const stored = await repo.getSettings();
    const pool = await repo.getTeamPool();
    expect(stored.laborRates[0].role).toBe('Analyst');           // untouched by us
    expect(pool.filter((m) => m.role === 'BA')).toHaveLength(3);  // nobody moved
    expect(screen.getByText(/labor rates changed while you were editing/i)).toBeDefined();
    // ...and the edit row is still open with the typed name, so the retry is one click.
    const input = screen.getAllByRole('textbox').find(
      (e) => (e as HTMLInputElement).name === 'editLaborRoleName',
    ) as HTMLInputElement;
    expect(input.value).toBe('Business Analyst');
  });

  it('a refused colliding rename writes nothing, and the same row renamed freely DOES cascade', async () => {
    // ⚠️ BOTH HALVES IN ONE TEST, deliberately. "a refusal writes nothing" is a pure
    // absence and passed against v0.37.8 for the wrong reason — it is already asserted
    // by three tests in RateTable.test.tsx. Pairing it with a rename that DOES cascade
    // is what makes it discriminate.
    render(<SettingsPage />);
    await openRates();

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const input = () => screen.getAllByRole('textbox').find(
      (e) => (e as HTMLInputElement).name === 'editLaborRoleName',
    )!;
    fireEvent.change(input(), { target: { value: 'IT-Security' } });   // collides
    expect(screen.getByText(/A labor rate named "IT-Security" already exists\./)).toBeDefined();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });

    expect((await repo.getSettings()).laborRates).toEqual(RATES);
    expect((await repo.getTeamPool()).filter((m) => m.role === 'BA')).toHaveLength(3);

    // Same row, a free name — this half must actually happen.
    fireEvent.change(input(), { target: { value: 'Business Analyst' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });

    expect((await repo.getSettings()).laborRates[0].role).toBe('Business Analyst');
    expect((await repo.getTeamPool()).filter((m) => m.role === 'Business Analyst')).toHaveLength(3);
  });

  it('a failed write changes nothing, says so, and leaves the row open', async () => {
    vi.spyOn(repo, 'saveSettingsAndTeamPool').mockRejectedValue(new Error('quota'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SettingsPage />);
    await openRates();
    await rename(0, 'Business Analyst');

    expect((await repo.getSettings()).laborRates).toEqual(RATES);
    expect((await repo.getTeamPool()).filter((m) => m.role === 'BA')).toHaveLength(3);
    expect(toasts.at(-1)!.variant).toBe('error');
    const input = screen.getAllByRole('textbox').find(
      (e) => (e as HTMLInputElement).name === 'editLaborRoleName',
    ) as HTMLInputElement;
    expect(input.value).toBe('Business Analyst');
  });

  it('deleting a rate prompts with the members it would leave rateless', async () => {
    render(<SettingsPage />);
    await openRates();
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]); });

    // Deleting "BA" leaves Alice, Bob and Cara with no rate. Eve holds "ba", which has
    // no rate either way, so she is already rateless and is counted too.
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/4 team members would be left with no rate/)).toBeDefined();
  });
});
