'use client';

import { useState } from 'react';
import type { Settings, Holiday } from '@/types/domain';
import { generateId } from '@/lib/utils/id';

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

interface HolidayTableProps {
  holidays: Holiday[];
  onUpdate: (updater: (prev: Settings) => Settings) => void;
}

export function HolidayTable({ holidays, onUpdate }: HolidayTableProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  const sortedHolidays = [...holidays].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );

  const handleAdd = () => {
    const name = newName.trim();
    if (!name || !newStartDate || !newEndDate) return;
    if (newEndDate < newStartDate) return;

    const holiday: Holiday = {
      id: generateId('hol'),
      name,
      startDate: newStartDate,
      endDate: newEndDate,
    };

    onUpdate((prev) => ({
      ...prev,
      holidays: [...prev.holidays, holiday],
    }));
    setNewName('');
    setNewStartDate('');
    setNewEndDate('');
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    onUpdate((prev) => ({
      ...prev,
      holidays: prev.holidays.filter((h) => h.id !== id),
    }));
  };

  const startEdit = (holiday: Holiday) => {
    setEditingId(holiday.id);
    setEditName(holiday.name);
    setEditStartDate(holiday.startDate);
    setEditEndDate(holiday.endDate);
  };

  const handleSaveEdit = () => {
    if (editingId === null) return;
    const name = editName.trim();
    if (!name || !editStartDate || !editEndDate) return;
    if (editEndDate < editStartDate) return;

    onUpdate((prev) => ({
      ...prev,
      holidays: prev.holidays.map((h) =>
        h.id === editingId
          ? { ...h, name, startDate: editStartDate, endDate: editEndDate }
          : h,
      ),
    }));
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        <span
          className="inline-block transition-transform"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          &#9654;
        </span>
        Holiday Calendar
        {holidays.length > 0 && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {holidays.length}
          </span>
        )}
      </button>
      {isOpen && (
      <div className="mt-3">
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Non-work days subtracted from workday calculations across all projects.
      </p>
      <table className="w-full max-w-2xl text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th className="pb-2 text-left font-medium">Name</th>
            <th className="pb-2 text-left font-medium">Start Date</th>
            <th className="pb-2 text-left font-medium">End Date</th>
            <th className="pb-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedHolidays.map((holiday) => (
            <tr
              key={holiday.id}
              className="border-b border-zinc-100 dark:border-zinc-800"
            >
              {editingId === holiday.id ? (
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
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
                  <td className="py-2">{holiday.name}</td>
                  <td className="py-2">{formatDate(holiday.startDate)}</td>
                  <td className="py-2">{formatDate(holiday.endDate)}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => startEdit(holiday)}
                      className="mr-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(holiday.id, holiday.name)}
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
      {sortedHolidays.length === 0 && (
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          No holidays defined. Add holidays below to exclude them from workday calculations.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Holiday name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="date"
          value={newStartDate}
          onChange={(e) => {
            const val = e.target.value;
            setNewStartDate(val);
            setNewEndDate(val);
          }}
          className={`rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 ${!newStartDate ? 'text-zinc-400 dark:text-zinc-500' : ''}`}
        />
        <input
          type="date"
          value={newEndDate}
          onChange={(e) => setNewEndDate(e.target.value)}
          className={`rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 ${!newEndDate ? 'text-zinc-400 dark:text-zinc-500' : ''}`}
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim() || !newStartDate || !newEndDate || newEndDate < newStartDate}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add
        </button>
      </div>
      </div>
      )}
    </div>
  );
}
