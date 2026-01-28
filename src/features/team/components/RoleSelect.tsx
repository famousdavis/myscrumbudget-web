'use client';

import type { LaborRate } from '@/types/domain';

interface RoleSelectProps {
  value: string;
  laborRates: LaborRate[];
  onChange: (role: string) => void;
}

export function RoleSelect({ value, laborRates, onChange }: RoleSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
      <option value="">Select role...</option>
      {laborRates.map((rate) => (
        <option key={rate.role} value={rate.role}>
          {rate.role} (${rate.hourlyRate}/hr)
        </option>
      ))}
    </select>
  );
}
