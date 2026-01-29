'use client';

import { useState } from 'react';
import type { LaborRate } from '@/types/domain';
import { RoleSelect } from './RoleSelect';

interface AddMemberFormProps {
  laborRates: LaborRate[];
  onAdd: (name: string, role: string, type: 'Core' | 'Extended') => void;
}

export function AddMemberForm({ laborRates, onAdd }: AddMemberFormProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [type, setType] = useState<'Core' | 'Extended'>('Core');

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed || !role) return;
    onAdd(trimmed, role, type);
    setName('');
    setRole('');
    setType('Core');
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Name
        </label>
        <input
          type="text"
          placeholder="Member name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Role
        </label>
        <RoleSelect value={role} laborRates={laborRates} onChange={setRole} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Type
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'Core' | 'Extended')}
          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="Core">Core</option>
          <option value="Extended">Extended</option>
        </select>
      </div>
      <button
        onClick={handleAdd}
        className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
      >
        Add
      </button>
    </div>
  );
}
