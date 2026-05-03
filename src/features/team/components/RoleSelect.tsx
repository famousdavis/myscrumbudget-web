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
      }`}
    >
      <option value="" className="text-zinc-400 dark:text-zinc-500">Select role...</option>
      {laborRates.map((rate) => (
        <option key={rate.role} value={rate.role} className="text-zinc-900 dark:text-zinc-100">
          {rate.role} (${rate.hourlyRate}/hr)
        </option>
      ))}
    </select>
  );
}
