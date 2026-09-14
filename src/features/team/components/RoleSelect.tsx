// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useRef } from 'react';
import type { LaborRate } from '@/types/domain';
import { roleHasNoRate } from '@/lib/utils/costSnapshot';

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
  /*
   * ⚠️⚠️ THE `value !== ''` CLAUSE IS THIS SITE'S OWN AND MUST STAY AT THE CALL
   * SITE (v0.41.0). The shared `roleHasNoRate` carries the other two clauses and
   * nothing more; an empty select is the normal UNSET state, not an orphaned
   * role. Deriving this line from `roleHasNoRate(value, laborRates)` ALONE makes
   * the placeholder render "(rate removed)" the moment any rates are loaded —
   * which is the v0.37.6 defect, in the component v0.37.6 fixed.
   *
   * ⚠️⚠️ AND THE MEASUREMENT SAYS THIS GUARD IS NOT WHAT IS PROTECTING YOU TODAY
   * — 2026-09-14, v0.41.0. I predicted that removing it would fail two named
   * tests. It fails NONE: the suite runs 1797/1797, and the rendered DOM is
   * BYTE-IDENTICAL across all seven states of (`value` x `laborRates`), with a
   * negative control confirming the probe can see a real change.
   *
   * THE REASON, and it is the part worth keeping: without the guard
   * `orphanedRole` becomes `''` rather than `null` — and `''` IS FALSY, so
   * `{orphanedRole && <option/>}` renders nothing and the amber-class ternary is
   * false anyway. The empty-string falsiness at those two JSX sites is doing the
   * same job the guard names.
   *
   * ⚠️ SO THE REAL PROTECTION IS AN ACCIDENT OF TRUTHINESS, AND IT IS ONE EDIT
   * FROM GONE. Change `orphanedRole` to a boolean, or write
   * `{orphanedRole !== null && ...}`, and the empty placeholder starts rendering
   * "(rate removed)" while this guard still READS as though it were preventing
   * it. That is why the clause stays: it is the explicit statement of a rule
   * currently enforced by something that does not look like a rule.
   *
   * ⚠️ NO TEST WAS ADDED, and now for a stronger reason than "a duplicate is
   * vacuous": the two builds are BEHAVIOURALLY INDISTINGUISHABLE, so any test
   * written against the observable passes under both. There is nothing here for
   * a test to refuse. The v0.37.6 defect CLASS is pinned elsewhere and properly
   * — the `?? []` mutation inside `roleHasNoRate` fails nine tests, two of them
   * in this component's own file.
   */
  const orphanedRole =
    value !== '' && roleHasNoRate(value, laborRates) ? value : null;

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
