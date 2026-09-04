// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { Fragment, useState, useCallback, useEffect } from 'react';
import type { Settings, LaborRate } from '@/types/domain';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { ConfirmDialog } from '@/components/BaseDialog';
import { STORAGE_KEYS } from '@/types/storage';
import { SETTINGS_SECTION_PARAM, RATES_SECTION_VALUE } from '@/lib/constants';

/** What a Save carries when it is a RENAME rather than a rate-only edit. */
export interface RoleRenameRequest {
  index: number;
  /** The UNTRIMMED stored name — `handleSaveEdit` trims only the new one. */
  oldRole: string;
  newRole: string;
  hourlyRate: number;
}

interface RateTableProps {
  rates: LaborRate[];
  onUpdate: (updater: (prev: Settings) => Settings) => void;
  /**
   * Called INSTEAD of `onUpdate` when a Save changes the role name, because a
   * rename must also move every pool member holding the old name and that write
   * has to be one operation.
   *
   * ⚠️ REQUIRED, NOT OPTIONAL, AND THAT IS DELIBERATE. An optional prop makes
   * "the page forgot to pass it" and "the feature is off" the same state, and
   * nothing in this component's own tests could tell them apart — they would
   * pass under both. Required, omitting it is a compile error at the call site.
   *
   * ⚠️ Resolves TRUE when the write landed and FALSE when it did not. The edit
   * row's `editingIndex` is this component's private state, so the page cannot
   * close it; the boolean is how a failed write leaves the row open with the new
   * name still typed, making the retry one click.
   */
  onRenameRole: (change: RoleRenameRequest) => Promise<boolean>;
  /**
   * How many pool members would be left with NO labor rate if row `index` were
   * deleted. Async because the pool lives in storage and this component has no
   * business holding it.
   *
   * ⚠️ A DIFFERENT PREDICATE FROM RENAME'S N, and the difference is not cosmetic:
   * this counts members left RATELESS, not members holding the name. Legacy data
   * holds exact duplicate rate rows, so deleting one twin leaves every holder
   * with a rate and orphans nobody — the honest count there is zero.
   */
  countOrphansIfDeleted: (index: number) => Promise<number>;
}

/**
 * Case-insensitive role-name collision lookup. Returns the EXISTING spelling —
 * not the typed one — so the message names the row the user actually has to
 * reconcile with ("ba" colliding with "BA" should say "BA").
 *
 * ⚠️ Case-INSENSITIVE by design (v0.37.4). "BA" and "ba" are one role to a human,
 * and permitting both is half of the defect this function exists to close.
 *
 * ⚠️ Rate LOOKUPS elsewhere stay EXACT-match (`calc/costs.ts`, `excelImport.ts`,
 * `importDiff.ts`) and were deliberately not touched. That is consistent rather
 * than an oversight: refusing "ba" alongside "BA" here is precisely what keeps an
 * exact lookup unambiguous downstream.
 *
 * ⚠️ NO VALIDATOR LEARNS THIS RULE, and there are TWO that must not.
 *   (a) `validateSettings` / `validateLaborRate` — the strict import-boundary pair.
 *       Live data already holds duplicates and `sanitizeLaborRate` passes them
 *       through unchanged, so a rule there would make the app reject its own
 *       previously-valid exports.
 *   (b) `isValidSettings` (`validation.ts`) — the LENIENT guard that
 *       `localStorage.ts` runs on every settings READ, with `DEFAULT_SETTINGS` as
 *       the fallback. A uniqueness rule there would make already-duplicated stored
 *       settings fail validation and silently reset the user's labor rates to the
 *       seeded defaults on the next page load — destroying working data rather
 *       than refusing a file, which is strictly worse.
 * Uniqueness is a UI affordance, enforced here and only here: existing duplicates
 * keep loading, and the user repairs the specific row.
 */
function findCollidingRole(
  rates: LaborRate[],
  name: string,
  exceptIndex: number | null,
): string | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  const hit = rates.find(
    (r, i) => i !== exceptIndex && r.role.trim().toLowerCase() === needle,
  );
  return hit ? hit.role : null;
}

/**
 * The single source of truth for "why can't this row be saved?" — null means it can.
 *
 * Both the Save/Add `disabled` expressions and the inline message read from this,
 * which is what keeps a greyed-out button from being a dead button (SET-6): every
 * refusal the user can reach has a stated reason on screen beside it.
 *
 * Self-exclusion is by INDEX, not by name. Consequence, accepted deliberately: on
 * data that ALREADY holds a duplicate, editing either twin is refused even for a
 * rate-only change, because another row genuinely does hold that name. The message
 * says so, and the repair (rename or delete one twin) is the outcome we want.
 *
 * ⚠️ THE ORDER OF THESE CHECKS IS LOAD-BEARING AND A TEST IS HOLDING IT, which is
 * not obvious from reading either the function or that test. Because the collision
 * check runs BEFORE the rate checks, a row that is both duplicated and has a bad
 * rate reports the collision — so the ordering decides which message appears, not
 * merely which problems are caught. Found by falsification: removing the index
 * self-exclusion was predicted to fail 3 tests and failed 4, the extra one being
 * "explains and disables Save when the hourly rate is negative", which never
 * mentions duplicates. If you reorder these, expect that test to fail and treat it
 * as a real signal about the message a user will see, not as a stale assertion.
 */
function describeRateProblem(
  rates: LaborRate[],
  name: string,
  rateText: string,
  exceptIndex: number | null,
): string | null {
  if (!name.trim()) return 'Role name is required.';
  const collision = findCollidingRole(rates, name, exceptIndex);
  if (collision) return `A labor rate named "${collision}" already exists.`;
  if (!rateText.trim()) return 'Hourly rate is required.';
  const hourlyRate = parseFloat(rateText);
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
    return 'Hourly rate must be 0 or greater.';
  }
  return null;
}

export function RateTable({
  rates,
  onUpdate,
  onRenameRole,
  countOrphansIfDeleted,
}: RateTableProps) {
  const [newRole, setNewRole] = useState('');
  const [newRate, setNewRate] = useState('');
  // ⚠️ `saving` and `pendingDelete` live HERE, in the parent, and that placement is
  // required rather than stylistic. The `key={index}` note below is legitimate only
  // while rows hold no per-row component state; moving either of these into a row
  // would break the condition that makes the key safe.
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<
    { index: number; role: string; orphanCount: number } | null
  >(null);
  // Edit identity is the row INDEX, not the role name (v0.37.4). A name matched
  // more than one row whenever two rows shared it, so Edit opened both, Save
  // rewrote both, and Delete removed both — the last of those being data loss.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editRate, setEditRate] = useState('');

  const editProblem =
    editingIndex === null
      ? null
      : describeRateProblem(rates, editRole, editRate, editingIndex);
  const addProblem = describeRateProblem(rates, newRole, newRate, null);
  // The Add row's resting state is empty, and empty is not an error — show its
  // message only once the user has actually typed a name. (The `disabled` button
  // still covers the empty case, which is the treatment the Add row already had.)
  const addMessage = newRole.trim() ? addProblem : null;

  const handleAdd = () => {
    if (addProblem) return;
    const role = newRole.trim();
    const hourlyRate = parseFloat(newRate);

    onUpdate((prev) => ({
      ...prev,
      laborRates: [...prev.laborRates, { role, hourlyRate }],
    }));
    setNewRole('');
    setNewRate('');
  };

  // ⚠️ Index-addressed writes assume `prev.laborRates` is the same array the rows
  // were rendered from. That holds for every path on this page (single writer,
  // functional update against the state the props came from); the one divergence
  // is a cloud-sync reload landing between render and click, which is the same
  // window every other functional update in the app already has.
  const requestDelete = async (index: number) => {
    const orphanCount = await countOrphansIfDeleted(index);
    // Captured with the count so the dialog and the write agree about which row
    // this is. Nothing here writes yet.
    setPendingDelete({ index, role: rates[index].role, orphanCount });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { index, role } = pendingDelete;
    setPendingDelete(null);
    // ⚠️ RE-VERIFY BEFORE WRITING. The index was captured before the dialog opened,
    // and the confirm step makes that window far longer than a plain click. If the
    // row at that index is no longer the one the user chose, this is the wrong row
    // and the delete is abandoned rather than misapplied.
    if (rates[index]?.role !== role) return;
    onUpdate((prev) => ({
      ...prev,
      laborRates: prev.laborRates.filter((_, i) => i !== index),
    }));
    // Deleting a row above the one being edited would shift its index onto a
    // different row, so any in-flight edit is abandoned rather than misapplied.
    setEditingIndex(null);
  };

  const startEdit = (index: number, rate: LaborRate) => {
    setEditingIndex(index);
    setEditRole(rate.role);
    setEditRate(String(rate.hourlyRate));
  };

  const handleSaveEdit = async () => {
    // ⚠️ THE REFUSAL SHORT-CIRCUIT MUST STAY FIRST. Under the pre-cascade shape this
    // was structural — the cascade would have sat after this return and could not run
    // on a refused save. Now that the page owns the write it is only a CONVENTION, and
    // a rename that got past here would move every holder of a name the user was told
    // they could not use.
    if (editingIndex === null || editProblem || saving) return;
    const role = editRole.trim();
    const hourlyRate = parseFloat(editRate);
    const target = editingIndex;
    // The UNTRIMMED stored name is the key every holder is matched on. Only the new
    // name is trimmed; trimming this one would fail to match members holding a stored
    // role with surrounding whitespace.
    const oldRole = rates[target].role;

    // ⚠️ EXACT inequality, never a case-insensitive one. Re-casing a row in place is
    // permitted, every rate lookup is exact, so a case-only change IS a rename and
    // must cascade — see `cascadeRoleRename`'s note.
    if (oldRole !== role) {
      setSaving(true);
      try {
        const committed = await onRenameRole({ index: target, oldRole, newRole: role, hourlyRate });
        // Left open on failure, with the new name still typed, so the retry is one
        // click. The page has already surfaced why.
        if (committed) setEditingIndex(null);
      } finally {
        setSaving(false);
      }
      return;
    }

    onUpdate((prev) => ({
      ...prev,
      laborRates: prev.laborRates.map((r, i) =>
        i === target ? { role, hourlyRate } : r
      ),
    }));
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const handleRatesOpen = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEYS.ratesReviewed, '1'); } catch { /* quota */ }
  }, []);

  /**
   * Deep-link arrival from the Dashboard's Getting Started step 1
   * (`/settings?section=rates`): open this section and mark step 1 reviewed.
   *
   * ⚠️ THIS WRITE IS NOT REDUNDANT WITH `onOpen`, AND DELETING IT SILENTLY
   * RESTORES THE DEFECT. `CollapsibleSection` calls `onOpen` from exactly one
   * place — inside `toggle()`, which runs only on a header CLICK. MEASURED
   * 2026-09-04 with a controlled host: flipping the `open` prop opens the
   * section and fires `onOpen` ZERO times. Before v0.37.16 the step-1 link was
   * a bare `/settings`, so the user landed here with the table COLLAPSED, the
   * flag was never written, and the checklist step never completed.
   *
   * ⚠️ READ WITH THE PLAIN URL API, NEVER `useSearchParams`. That hook forces a
   * Suspense boundary or an App Router prerender failure. This repo avoids it
   * deliberately: `useInvitationLanding.ts:73` reads `?invite=` the same way,
   * and `InvitationBanner.tsx:18` records that its Suspense boundary is "not
   * strictly required" precisely BECAUSE the hook is avoided.
   *
   * ⚠️ THE PARAM IS STRIPPED ON PURPOSE. Left in place it survives a reload, so
   * the section would re-open on every refresh and defeat the user's own
   * collapse. `replaceState` does not notify the Next router, which is safe here
   * for a MEASURED reason rather than an assumed one: 2026-09-04, three files
   * import from 'next/navigation' and ZERO import `useSearchParams`, so nothing
   * reads this param reactively. (A bare `grep useSearchParams src` reads 4 and
   * every hit is a comment — the import is the honest instrument.) Same shape
   * and same reasoning as `useInvitationLanding.ts:77`.
   */
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get(SETTINGS_SECTION_PARAM) !== RATES_SECTION_VALUE) return;
      // ⚠️ THE EFFECT FORM IS REQUIRED, NOT A STYLE CHOICE, so this directive is
      // not a lint dodge. The obvious way to avoid it — `useState(() => …)`
      // reading the URL in a lazy initializer — is the exact construct that
      // shipped a production hydration error in `FirstRunBanner` (v0.36.2) and
      // that `page.tsx:45-56` records as unsafe in general. It would be harmless
      // here only by accident of nesting (Settings renders inside
      // `MigrationGuard`, which renders nothing on the server or on the client's
      // first render), and reproducing a documented anti-pattern to satisfy a
      // lint rule is the wrong trade. Same shape, same reason, and same
      // directive as `LocalStorageWarningBanner.tsx:22-25`.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
      handleRatesOpen();
      url.searchParams.delete(SETTINGS_SECTION_PARAM);
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch { /* SSR/edge — no-op */ }
  }, [handleRatesOpen]);

  return (
    <CollapsibleSection
      title="Labor Rate Table"
      count={rates.length}
      open={open}
      onOpenChange={setOpen}
      onOpen={handleRatesOpen}
    >
      <table className="w-full max-w-md text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th scope="col" className="pb-2 text-left font-medium">Role</th>
            <th scope="col" className="pb-2 text-left font-medium">Hourly Rate ($)</th>
            <th scope="col" className="pb-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {/*
            ⚠️ `key={index}` is safe HERE SPECIFICALLY, and the condition is what
            makes it legitimate rather than lucky: these rows hold no per-row
            component state (the edit buffers live in this parent) and the table
            has no reorder, so a key that changes with position costs nothing. It
            is also the honest key now that the role name is known non-unique in
            legacy data. Re-check this if either condition ever stops holding.
            A stable `LaborRate.id` was considered and declined 2026-09-03: the
            type is `{ role, hourlyRate }` and `sanitizeImport.ts` derives its
            allowlist from `Record<keyof LaborRate, true>`, so adding a field is a
            DATA_VERSION bump plus a migration — out of proportion to a React key.
          */}
          {rates.map((rate, index) => (
            <Fragment key={index}>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {editingIndex === index ? (
                  <>
                    <td className="py-2 pr-2">
                      <input
                        name="editLaborRoleName"
                        type="text"
                        autoComplete="off"
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        maxLength={50}
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        name="editLaborRoleRate"
                        type="number"
                        autoComplete="off"
                        value={editRate}
                        min={0}
                        onChange={(e) => setEditRate(e.target.value)}
                        className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={handleSaveEdit}
                        disabled={editProblem !== null || saving}
                        className="mr-2 text-sm text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-blue-600 dark:text-blue-400"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2">{rate.role}</td>
                    <td className="py-2">${rate.hourlyRate}</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => startEdit(index, rate)}
                        className="mr-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => requestDelete(index)}
                        className="text-sm text-red-600 hover:text-red-800 dark:text-red-400"
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
              {editingIndex === index && editProblem && (
                <tr>
                  <td colSpan={3} className="pb-2 text-xs text-red-600 dark:text-red-400" role="alert">
                    {editProblem}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex items-center gap-2">
        <input
          name="newLaborRoleName"
          type="text"
          autoComplete="off"
          placeholder="Role name"
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          maxLength={50}
          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          name="newLaborRoleRate"
          type="number"
          autoComplete="off"
          placeholder="Rate"
          value={newRate}
          min={0}
          onChange={(e) => setNewRate(e.target.value)}
          className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          onClick={handleAdd}
          disabled={addProblem !== null}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {addMessage && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
          {addMessage}
        </p>
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete labor rate?"
          message={
            pendingDelete.orphanCount === 0
              ? `Delete the "${pendingDelete.role}" rate? No team members would be left without a rate.`
              : `Delete the "${pendingDelete.role}" rate? ${pendingDelete.orphanCount} team ` +
                `member${pendingDelete.orphanCount === 1 ? '' : 's'} would be left with no rate, ` +
                `and would be costed at $0 until given one.`
          }
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </CollapsibleSection>
  );
}
