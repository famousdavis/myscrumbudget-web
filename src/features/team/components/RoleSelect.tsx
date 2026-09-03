// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useRef } from 'react';
import type { LaborRate } from '@/types/domain';

interface RoleSelectProps {
  value: string;
  /**
   * ⚠️ OPTIONAL, AND `undefined` IS NOT AN EMPTY LIST — the same distinction
   * `AllocationGridRow` makes, deliberately expressed the same way so the two orphan
   * predicates read as one rule. Absent means "settings have not loaded yet" and must
   * never render as "this role has no rate"; `[]` means loaded-and-genuinely-empty and
   * SHOULD. `team/page.tsx` gates only on `useTeamPool`'s loading flag and discards
   * `useSettings`', so a null `settings` really does reach this component.
   */
  laborRates?: LaborRate[];
  onChange: (role: string) => void;
  id?: string;
}

export function RoleSelect({ value, laborRates, onChange, id }: RoleSelectProps) {
  const selectRef = useRef<HTMLSelectElement>(null);

  /**
   * A role held in state whose labor rate no longer exists (v0.37.4).
   *
   * ⚠️ Keyed off the MISMATCH, never off an empty value. Measured on v0.37.3:
   * with no `<option>` matching the controlled value, React's select
   * reconciliation selects the FIRST option, so `selectedIndex` is 0 and the DOM
   * `value` reads `''` while state still holds the removed role — the user sees
   * "Select role..." and a Save writes the orphan straight back. And because the
   * placeholder-styling branch below tests `value === ''`, which is FALSE for an
   * orphan, the placeholder text rendered in the NON-placeholder colour: it did
   * not even look unset. Nothing here may be derived from an empty value.
   */
  /*
   * What this renders while `laborRates` is undefined: the placeholder alone, because
   * there are no rates to list yet. That is sufficient rather than merely tolerable, and
   * the reason is measurable rather than aesthetic — MEASURED 2026-09-03: the undefined
   * window is MOUNT-ONLY (`useSettings` calls `setSettings` with a real value or an
   * updater, never with null, and `setLoading` only ever goes false), and at mount
   * `PoolMemberTable.editingId` is null and `AddPoolMemberForm.role` is '', so EVERY
   * RoleSelect on the page has `value === ''` in that window. Rendering the placeholder
   * and rendering the current value as a plain option are therefore indistinguishable
   * there; no test can separate them. If a non-empty select ever becomes reachable while
   * settings are unresolved, revisit this — the choice is sufficient because of that
   * measurement, not independently of it.
   */
  const orphanedRole =
    value !== '' && laborRates !== undefined && !laborRates.some((rate) => rate.role === value)
      ? value
      : null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
    if (e.key === 'Enter' && !value) {
      e.preventDefault();
      try {
        selectRef.current?.showPicker();
      } catch {
        // showPicker() not supported — fall through to native behavior
      }
    }
  };

  return (
    <select
      ref={selectRef}
      id={id}
      name="role"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      className={`rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 ${
        value === '' ? 'text-zinc-400 dark:text-zinc-500' : ''
      } ${orphanedRole ? 'text-amber-600 dark:text-amber-400' : ''}`}
    >
      <option value="" className="text-zinc-400 dark:text-zinc-500">Select role...</option>
      {orphanedRole && (
        // Disabled, yet still the selected option: the DOM matches a controlled
        // value to an option by value alone, so `disabled` makes it unpickable
        // without making it unselectable. That is exactly the affordance wanted —
        // the lost role stays visible and named, and the only way forward is a
        // real rate. Re-saving it is still permitted so the member's NAME can be
        // corrected while the role is orphaned.
        <option value={orphanedRole} disabled className="text-amber-600 dark:text-amber-400">
          {orphanedRole} (rate removed)
        </option>
      )}
      {/*
        ⚠️ THIS `?? []` IS CORRECT, AND IT IS THE SAME TOKEN v0.37.6 EXISTS TO REMOVE
        FROM THE PREDICATE TWELVE LINES ABOVE. Do not "finish the job" by deleting it.
        Same operator, opposite correctness, because the two answer different questions:
          - In the PREDICATE, `?? []` asserts "no rate exists for this role" — a CLAIM,
            and a false one while settings are merely unresolved. That is the defect.
          - Here, in the OPTIONS LIST, `[]` renders "there are no rates to offer yet",
            which is exactly what "unknown" should look like. Nothing is claimed.
        An unloaded list and an empty list should show the same options and must NOT
        produce the same marker.
      */}
      {(laborRates ?? []).map((rate, index) => (
        // Keyed by index: role names are known non-unique in legacy data, and a
        // duplicated name previously produced duplicate React keys here. Options
        // hold no state and the list has no reorder, so position is a safe key.
        <option key={index} value={rate.role} className="text-zinc-900 dark:text-zinc-100">
          {rate.role} (${rate.hourlyRate}/hr)
        </option>
      ))}
    </select>
  );
}
