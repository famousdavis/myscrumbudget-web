'use client';

import { useState } from 'react';
import type { Settings, Holiday } from '@/types/domain';
import { generateId } from '@/lib/utils/id';
import { formatDateSlash } from '@/lib/utils/format';
import { getUSAFederalHolidays } from '@/lib/utils/usaFederalHolidays';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { ConfirmDialog } from '@/components/BaseDialog';

const BULK_YEARS = [2026, 2027, 2028] as const;

interface HolidayTableProps {
  holidays: Holiday[];
  onUpdate: (updater: (prev: Settings) => Settings) => void;
}

export function HolidayTable({ holidays, onUpdate }: HolidayTableProps) {
  const [newName, setNewName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [bulkYears, setBulkYears] = useState<Set<number>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const toggleBulkYear = (year: number) => {
    setBulkYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const handleBulkAdd = () => {
    if (bulkYears.size === 0) return;

    // Build a set of existing holiday dates to avoid duplicates
    const existingDates = new Set(holidays.map((h) => h.startDate));

    const newHolidays: Holiday[] = [];
    for (const year of Array.from(bulkYears).sort()) {
      const entries = getUSAFederalHolidays(year);
      for (const entry of entries) {
        if (!existingDates.has(entry.date)) {
          newHolidays.push({
            id: generateId('hol'),
            name: entry.name,
            startDate: entry.date,
            endDate: entry.date,
          });
          existingDates.add(entry.date);
        }
      }
    }

    if (newHolidays.length > 0) {
      onUpdate((prev) => ({
        ...prev,
        holidays: [...prev.holidays, ...newHolidays],
      }));
    }
    setBulkYears(new Set());
  };

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

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    onUpdate((prev) => ({
      ...prev,
      holidays: prev.holidays.filter((h) => h.id !== pendingDeleteId),
    }));
    setPendingDeleteId(null);
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
    <CollapsibleSection title="Holiday Calendar" count={holidays.length}>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Non-work days subtracted from workday calculations across all projects.
      </p>
      <table className="w-full max-w-2xl text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th scope="col" className="pb-2 text-left font-medium">Name</th>
            <th scope="col" className="pb-2 text-left font-medium">Start Date</th>
            <th scope="col" className="pb-2 text-left font-medium">End Date</th>
            <th scope="col" className="pb-2 text-right font-medium">Actions</th>
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
                      maxLength={100}
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
                  <td className="py-2">{formatDateSlash(holiday.startDate)}</td>
                  <td className="py-2">{formatDateSlash(holiday.endDate)}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => startEdit(holiday)}
                      className="mr-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(holiday.id)}
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
          maxLength={100}
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

      {/* Bulk-add US Federal Holidays */}
      <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <p className="mb-2 text-sm font-medium">Add US Federal Holidays</p>
        <div className="flex flex-wrap items-center gap-3">
          {BULK_YEARS.map((year) => (
            <label key={year} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={bulkYears.has(year)}
                onChange={() => toggleBulkYear(year)}
                className="rounded border-zinc-300 dark:border-zinc-600"
              />
              {year}
            </label>
          ))}
          <button
            onClick={handleBulkAdd}
            disabled={bulkYears.size === 0}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add Holidays
          </button>
        </div>
        <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
          Includes all 11 federal holidays plus observed dates. Duplicates are skipped.
        </p>
      </div>
    {pendingDeleteId && (
        <ConfirmDialog
          title="Delete Holiday"
          message={
            <>
              Are you sure you want to delete{' '}
              <strong>
                {sortedHolidays.find((h) => h.id === pendingDeleteId)?.name ?? ''}
              </strong>
              ?
            </>
          }
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </CollapsibleSection>
  );
}
