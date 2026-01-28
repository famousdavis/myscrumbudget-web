'use client';

import { useCallback } from 'react';
import type { TeamMember } from '@/types/domain';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { getAllocation } from '@/lib/calc/allocationMap';
import { formatMonthLabel } from '@/lib/utils/dates';

interface AllocationGridProps {
  months: string[];
  teamMembers: TeamMember[];
  allocationMap: AllocationMap;
  onAllocationChange: (memberId: string, month: string, value: number) => void;
  readonly?: boolean;
}

function getAllocationColor(value: number): string {
  if (value === 0) return '';
  if (value <= 0.25) return 'bg-blue-50 dark:bg-blue-950';
  if (value <= 0.5) return 'bg-blue-100 dark:bg-blue-900';
  if (value <= 0.75) return 'bg-blue-200 dark:bg-blue-800';
  if (value < 1) return 'bg-blue-300 dark:bg-blue-700';
  return 'bg-blue-400 dark:bg-blue-600';
}

function AllocationCell({
  memberId,
  month,
  value,
  onChange,
  readonly,
}: {
  memberId: string;
  month: string;
  value: number;
  onChange: (memberId: string, month: string, value: number) => void;
  readonly?: boolean;
}) {
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const raw = parseFloat(e.target.value);
      if (isNaN(raw)) {
        e.target.value = value ? String(Math.round(value * 100)) : '';
        return;
      }
      const clamped = Math.max(0, Math.min(100, raw));
      onChange(memberId, month, clamped / 100);
    },
    [memberId, month, value, onChange]
  );

  const displayValue = value ? String(Math.round(value * 100)) : '';

  if (readonly) {
    return (
      <td
        className={`border border-zinc-200 px-2 py-1 text-center text-xs dark:border-zinc-700 ${getAllocationColor(value)}`}
      >
        {displayValue ? `${displayValue}%` : ''}
      </td>
    );
  }

  return (
    <td
      className={`border border-zinc-200 p-0 dark:border-zinc-700 ${getAllocationColor(value)}`}
    >
      <input
        type="text"
        defaultValue={displayValue}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'Tab') {
            // Default tab behavior works fine for grid navigation
          }
        }}
        className="w-full bg-transparent px-1 py-1 text-center text-xs outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="0"
      />
    </td>
  );
}

export function AllocationGrid({
  months,
  teamMembers,
  allocationMap,
  onAllocationChange,
  readonly = false,
}: AllocationGridProps) {
  if (teamMembers.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Add team members to start entering allocations.
      </p>
    );
  }

  if (months.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No months in project date range.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900">
              Team Member
            </th>
            {months.map((month) => (
              <th
                key={month}
                className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-center text-xs font-medium whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-900"
              >
                {formatMonthLabel(month)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teamMembers.map((member) => (
            <tr key={member.id}>
              <td className="sticky left-0 z-10 border border-zinc-200 bg-white px-3 py-1 text-xs font-medium whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-950">
                {member.name}
                <span className="ml-1 text-zinc-400">({member.role})</span>
              </td>
              {months.map((month) => (
                <AllocationCell
                  key={`${member.id}-${month}`}
                  memberId={member.id}
                  month={month}
                  value={getAllocation(allocationMap, month, member.id)}
                  onChange={onAllocationChange}
                  readonly={readonly}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
