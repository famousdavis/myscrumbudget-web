// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useRef } from 'react';
import type { LaborRate } from '@/types/domain';

interface RoleSelectProps {
  value: string;
  laborRates: LaborRate[];
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
  const orphanedRole =
    value !== '' && !laborRates.some((rate) => rate.role === value) ? value : null;

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
      {laborRates.map((rate, index) => (
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
