// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useId, useState } from 'react';
import type { LaborRate, PoolMember } from '@/types/domain';
import { RoleSelect } from './RoleSelect';
import { BaseDialog, dialogButtonStyles } from '@/components/BaseDialog';

interface AddPoolMemberFormProps {
  /** Forwarded straight to `RoleSelect`; optional for the same reason — see its note.
   *  Never default this to `[]` on the way through. */
  laborRates?: LaborRate[];
  pool: PoolMember[];
  onAdd: (name: string, role: string) => void;
  onUnarchive: (id: string) => void;
}

export function AddPoolMemberForm({ laborRates, pool, onAdd, onUnarchive }: AddPoolMemberFormProps) {
  const baseId = useId();
  const nameId = `${baseId}-name`;
  const roleId = `${baseId}-role`;
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [archivedMatch, setArchivedMatch] = useState<{ name: string; matchedId: string } | null>(
    null,
  );

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed || !role) return;

    const matched = pool.find(
      (m) => m.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (matched && matched.archived === true) {
      setArchivedMatch({ name: trimmed, matchedId: matched.id });
      return;
    }
    if (matched) {
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

  const handleUnarchiveFromMatch = () => {
    if (!archivedMatch) return;
    onUnarchive(archivedMatch.matchedId);
    setArchivedMatch(null);
    setName('');
    setRole('');
  };

  const handleAddAsNewFromMatch = () => {
    if (!archivedMatch || !role) return;
    onAdd(archivedMatch.name, role);
    setArchivedMatch(null);
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
          <label
            htmlFor={nameId}
            className="mb-1 block text-sm font-medium text-zinc-500 dark:text-zinc-400"
          >
            Name
          </label>
          <input
            id={nameId}
            name="memberName"
            type="text"
            autoComplete="off"
            placeholder="Member name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label
            htmlFor={roleId}
            className="mb-1 block text-sm font-medium text-zinc-500 dark:text-zinc-400"
          >
            Role
          </label>
          <RoleSelect id={roleId} value={role} laborRates={laborRates} onChange={setRole} />
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
      {archivedMatch && (
        <BaseDialog
          title="Archived Member Found"
          actions={
            <>
              <button
                onClick={() => setArchivedMatch(null)}
                className={dialogButtonStyles.cancel}
              >
                Cancel
              </button>
              <button
                onClick={handleAddAsNewFromMatch}
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Add as new
              </button>
              <button
                onClick={handleUnarchiveFromMatch}
                className={dialogButtonStyles.primary}
              >
                Unarchive
              </button>
            </>
          }
        >
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            An archived member named &ldquo;{archivedMatch.name}&rdquo; already
            exists. You can unarchive them to make them active again, or add a
            new member with the same name.
          </p>
        </BaseDialog>
      )}
    </>
  );
}
