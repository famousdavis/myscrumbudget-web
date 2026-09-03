// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { Fragment, useState, useCallback } from 'react';
import type { Settings, LaborRate } from '@/types/domain';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { STORAGE_KEYS } from '@/types/storage';

interface RateTableProps {
  rates: LaborRate[];
  onUpdate: (updater: (prev: Settings) => Settings) => void;
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

export function RateTable({ rates, onUpdate }: RateTableProps) {
  const [newRole, setNewRole] = useState('');
  const [newRate, setNewRate] = useState('');
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
  const handleDelete = (index: number) => {
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

  const handleSaveEdit = () => {
    if (editingIndex === null || editProblem) return;
    const role = editRole.trim();
    const hourlyRate = parseFloat(editRate);
    const target = editingIndex;

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

  return (
    <CollapsibleSection title="Labor Rate Table" count={rates.length} onOpen={handleRatesOpen}>
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
            A stable `LaborRate.id` was considered and declined 2026-09-04: the
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
                        disabled={editProblem !== null}
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
                        onClick={() => handleDelete(index)}
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
    </CollapsibleSection>
  );
}
