'use client';

import { useState } from 'react';
import type { PoolMember, LaborRate } from '@/types/domain';
import { RoleSelect } from './RoleSelect';

interface PoolMemberTableProps {
  pool: PoolMember[];
  laborRates: LaborRate[];
  onUpdate: (id: string, updates: Partial<Omit<PoolMember, 'id'>>) => void;
  onDelete: (id: string) => Promise<{ ok: boolean; reason?: string }>;
}

export function PoolMemberTable({
  pool,
  laborRates,
  onUpdate,
  onDelete,
}: PoolMemberTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      setDeleteError(result.reason ?? 'Cannot delete this member.');
    }
  };

  if (pool.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No team members in the pool yet. Add one below.
      </p>
    );
  }

  return (
    <div>
      {deleteError && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {deleteError}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th className="pb-2 text-left font-medium">Name</th>
            <th className="pb-2 text-left font-medium">Role</th>
            <th className="pb-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {pool.map((member) => (
            <tr
              key={member.id}
              className="border-b border-zinc-100 dark:border-zinc-800"
            >
              {editingId === member.id ? (
                <>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <RoleSelect
                      value={editRole}
                      laborRates={laborRates}
                      onChange={setEditRole}
                    />
                  </td>
                  <td className="py-2 text-right">
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
                  <td className="py-2">{member.name}</td>
                  <td className="py-2">{member.role}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => startEdit(member)}
                      className="mr-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      Edit
                    </button>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
