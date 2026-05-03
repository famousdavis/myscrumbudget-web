// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { Fragment, useState, useMemo } from 'react';
import type { PoolMember, LaborRate } from '@/types/domain';
import { RoleSelect } from './RoleSelect';

type SortField = 'name' | 'role';

interface PoolMemberTableProps {
  pool: PoolMember[];
  laborRates: LaborRate[];
  onUpdate: (id: string, updates: Partial<Omit<PoolMember, 'id'>>) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => Promise<{ ok: boolean; reason?: string; canArchive?: boolean }>;
}

interface DeleteError {
  id: string;
  reason: string;
  canArchive: boolean;
}

export function PoolMemberTable({
  pool,
  laborRates,
  onUpdate,
  onArchive,
  onUnarchive,
  onDelete,
}: PoolMemberTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [deleteError, setDeleteError] = useState<DeleteError | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [showArchived, setShowArchived] = useState(false);

  const archivedCount = pool.filter((m) => m.archived).length;

  const activeRows = useMemo(
    () =>
      [...pool]
        .filter((m) => !m.archived)
        .sort((a, b) => a[sortField].localeCompare(b[sortField])),
    [pool, sortField],
  );

  const archivedRows = useMemo(
    () =>
      [...pool]
        .filter((m) => m.archived)
        .sort((a, b) => a[sortField].localeCompare(b[sortField])),
    [pool, sortField],
  );

  const startEdit = (member: PoolMember) => {
    setEditingId(member.id);
    setEditName(member.name);
    setEditRole(member.role);
    setDeleteError(null);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim() || !editRole) return;
    onUpdate(editingId, {
      name: editName.trim(),
      role: editRole,
    });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    const result = await onDelete(id);
    if (!result.ok) {
      setDeleteError({
        id,
        reason: result.reason ?? 'Cannot delete this member.',
        canArchive: result.canArchive ?? false,
      });
    }
  };

  const handleArchiveFromError = (id: string) => {
    onArchive(id);
    setDeleteError(null);
  };

  if (pool.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No team members in the pool yet.
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Use the form above to add your first team member.
        </p>
      </div>
    );
  }

  const sortIndicator = (field: SortField) =>
    sortField === field ? ' ▲' : '';

  const renderRow = (member: PoolMember) => {
    const isArchived = member.archived === true;
    const mutedClass = isArchived ? 'opacity-60' : '';
    return (
      <Fragment key={member.id}>
        <tr className="border-b border-zinc-100 dark:border-zinc-800">
          {editingId === member.id ? (
            <>
              <td className="py-1 pr-2">
                <input
                  type="text"
                  name="memberName"
                  autoComplete="off"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={100}
                  className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </td>
              <td className="py-1 pr-2">
                <RoleSelect
                  value={editRole}
                  laborRates={laborRates}
                  onChange={setEditRole}
                />
              </td>
              <td className="py-1 text-right">
                <button
                  onClick={saveEdit}
                  className="mr-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                >
                  Cancel
                </button>
              </td>
            </>
          ) : (
            <>
              <td className={`py-1 ${mutedClass}`}>{member.name}</td>
              <td className={`py-1 ${mutedClass}`}>{member.role}</td>
              <td className="py-1 text-right">
                <button
                  onClick={() => startEdit(member)}
                  className="mr-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  Edit
                </button>
                {isArchived ? (
                  <button
                    onClick={() => onUnarchive(member.id)}
                    className="mr-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    Unarchive
                  </button>
                ) : (
                  <button
                    onClick={() => onArchive(member.id)}
                    className="mr-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    Archive
                  </button>
                )}
                <button
                  onClick={() => handleDelete(member.id)}
                  className="text-sm text-red-600 hover:text-red-800 dark:text-red-400"
                >
                  Delete
                </button>
              </td>
            </>
          )}
        </tr>
        {deleteError?.id === member.id && (
          <tr>
            <td
              colSpan={3}
              className="border-b border-zinc-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-zinc-800 dark:bg-red-950 dark:text-red-300"
            >
              {deleteError.reason}
              {deleteError.canArchive && (
                <button
                  onClick={() => handleArchiveFromError(member.id)}
                  className="ml-3 rounded border border-red-300 bg-white px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-900"
                >
                  Archive instead
                </button>
              )}
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  return (
    <div className="max-w-2xl">
      {archivedCount > 0 && (
        <div className="mb-2 flex justify-end">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {showArchived ? 'Hide' : 'Show'} archived ({archivedCount})
          </button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th
              scope="col"
              className="cursor-pointer select-none pb-1 text-left font-medium hover:text-blue-600 dark:hover:text-blue-400"
              onClick={() => setSortField('name')}
            >
              Name{sortIndicator('name')}
            </th>
            <th
              scope="col"
              className="cursor-pointer select-none pb-1 text-left font-medium hover:text-blue-600 dark:hover:text-blue-400"
              onClick={() => setSortField('role')}
            >
              Role{sortIndicator('role')}
            </th>
            <th scope="col" className="pb-1 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {activeRows.map(renderRow)}
          {showArchived && archivedRows.length > 0 && (
            <tr aria-hidden="true">
              <td colSpan={3} className="border-t-2 border-dashed border-zinc-200 pt-1 dark:border-zinc-700" />
            </tr>
          )}
          {showArchived && archivedRows.map(renderRow)}
        </tbody>
      </table>
    </div>
  );
}
