'use client';

import { useState } from 'react';
import type { Settings, LaborRate } from '@/types/domain';
import { CollapsibleSection } from '@/components/CollapsibleSection';

interface RateTableProps {
  rates: LaborRate[];
  onUpdate: (updater: (prev: Settings) => Settings) => void;
}

export function RateTable({ rates, onUpdate }: RateTableProps) {
  const [newRole, setNewRole] = useState('');
  const [newRate, setNewRate] = useState('');
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editRate, setEditRate] = useState('');

  const handleAdd = () => {
    const role = newRole.trim();
    const hourlyRate = parseFloat(newRate);
    if (!role || isNaN(hourlyRate) || hourlyRate <= 0) return;
    if (rates.some((r) => r.role === role)) return;

    onUpdate((prev) => ({
      ...prev,
      laborRates: [...prev.laborRates, { role, hourlyRate }],
    }));
    setNewRole('');
    setNewRate('');
  };

  const handleDelete = (role: string) => {
    onUpdate((prev) => ({
      ...prev,
      laborRates: prev.laborRates.filter((r) => r.role !== role),
    }));
  };

  const startEdit = (rate: LaborRate) => {
    setEditingRole(rate.role);
    setEditRole(rate.role);
    setEditRate(String(rate.hourlyRate));
  };

  const handleSaveEdit = () => {
    if (editingRole === null) return;
    const role = editRole.trim();
    const hourlyRate = parseFloat(editRate);
    if (!role || isNaN(hourlyRate) || hourlyRate <= 0) return;

    onUpdate((prev) => ({
      ...prev,
      laborRates: prev.laborRates.map((r) =>
        r.role === editingRole ? { role, hourlyRate } : r
      ),
    }));
    setEditingRole(null);
  };

  const handleCancelEdit = () => {
    setEditingRole(null);
  };

  return (
    <CollapsibleSection title="Labor Rate Table" count={rates.length}>
      <table className="w-full max-w-md text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th scope="col" className="pb-2 text-left font-medium">Role</th>
            <th scope="col" className="pb-2 text-left font-medium">Hourly Rate ($)</th>
            <th scope="col" className="pb-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((rate) => (
            <tr
              key={rate.role}
              className="border-b border-zinc-100 dark:border-zinc-800"
            >
              {editingRole === rate.role ? (
                <>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      maxLength={50}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      value={editRate}
                      onChange={(e) => setEditRate(e.target.value)}
                      className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={handleSaveEdit}
                      className="mr-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                    >
                      Cancel
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td className="py-2">{rate.role}</td>
                  <td className="py-2">${rate.hourlyRate}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => startEdit(rate)}
                      className="mr-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(rate.role)}
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
      <div className="mt-4 flex items-center gap-2">
        <input
          type="text"
          placeholder="Role name"
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          maxLength={50}
          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="number"
          placeholder="Rate"
          value={newRate}
          onChange={(e) => setNewRate(e.target.value)}
          className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          onClick={handleAdd}
          disabled={!newRole.trim() || isNaN(parseFloat(newRate)) || parseFloat(newRate) <= 0 || rates.some((r) => r.role === newRole.trim())}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </CollapsibleSection>
  );
}
