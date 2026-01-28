'use client';

import { useState } from 'react';
import type { TeamMember, LaborRate } from '@/types/domain';
import { RoleSelect } from './RoleSelect';

interface TeamTableProps {
  members: TeamMember[];
  laborRates: LaborRate[];
  onUpdate: (id: string, updates: Partial<Omit<TeamMember, 'id'>>) => void;
  onDelete: (id: string) => void;
}

export function TeamTable({
  members,
  laborRates,
  onUpdate,
  onDelete,
}: TeamTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editType, setEditType] = useState<'Core' | 'Extended'>('Core');

  const startEdit = (member: TeamMember) => {
    setEditingId(member.id);
    setEditName(member.name);
    setEditRole(member.role);
    setEditType(member.type);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim() || !editRole) return;
    onUpdate(editingId, {
      name: editName.trim(),
      role: editRole,
      type: editType,
    });
    setEditingId(null);
  };

  if (members.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No team members yet. Add one below.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-200 dark:border-zinc-700">
          <th className="pb-2 text-left font-medium">Name</th>
          <th className="pb-2 text-left font-medium">Role</th>
          <th className="pb-2 text-left font-medium">Type</th>
          <th className="pb-2 text-right font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
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
                <td className="py-2 pr-2">
                  <select
                    value={editType}
                    onChange={(e) =>
                      setEditType(e.target.value as 'Core' | 'Extended')
                    }
                    className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="Core">Core</option>
                    <option value="Extended">Extended</option>
                  </select>
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
                <td className="py-2">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      member.type === 'Core'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {member.type}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => startEdit(member)}
                    className="mr-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(member.id)}
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
  );
}
