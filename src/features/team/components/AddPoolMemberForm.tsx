'use client';

import { useState } from 'react';
import type { LaborRate, PoolMember } from '@/types/domain';
import { RoleSelect } from './RoleSelect';
import { BaseDialog, dialogButtonStyles } from '@/components/BaseDialog';

interface AddPoolMemberFormProps {
  laborRates: LaborRate[];
  pool: PoolMember[];
  onAdd: (name: string, role: string) => void;
}

export function AddPoolMemberForm({ laborRates, pool, onAdd }: AddPoolMemberFormProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed || !role) return;

    const isDuplicate = pool.some(
      (m) => m.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (isDuplicate) {
      setDuplicateWarning(trimmed);
      return;
    }

    onAdd(trimmed, role);
    setName('');
    setRole('');
  };

  const confirmDuplicate = () => {
    if (!duplicateWarning || !role) return;
    onAdd(duplicateWarning, role);
    setDuplicateWarning(null);
    setName('');
    setRole('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAdd();
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Name
          </label>
          <input
            type="text"
            placeholder="Member name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Role
          </label>
          <RoleSelect value={role} laborRates={laborRates} onChange={setRole} />
        </div>
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
        >
          Add
        </button>
      </form>
      {duplicateWarning && (
        <BaseDialog
          title="Duplicate Name"
          actions={
            <>
              <button
                onClick={() => setDuplicateWarning(null)}
                className={dialogButtonStyles.cancel}
              >
                Cancel
              </button>
              <button
                onClick={confirmDuplicate}
                className={dialogButtonStyles.primary}
              >
                Add Anyway
              </button>
            </>
          }
        >
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            A team member named &ldquo;{duplicateWarning}&rdquo; already exists
            in the pool. Add another member with this name?
          </p>
        </BaseDialog>
      )}
    </>
  );
}
