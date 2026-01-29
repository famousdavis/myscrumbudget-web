'use client';

import { useState } from 'react';
import type { ProductivityWindow } from '@/types/domain';
import { nextBusinessDay } from '@/lib/utils/dates';

interface ProductivityWindowPanelProps {
  windows: ProductivityWindow[];
  projectStartDate: string;
  projectEndDate: string;
  onAdd: (startDate: string, endDate: string, factor: number) => void;
  onUpdate: (
    id: string,
    updates: Partial<Omit<ProductivityWindow, 'id'>>,
  ) => void;
  onRemove: (id: string) => void;
}

interface FormState {
  startDate: string;
  endDate: string;
  factor: string;
}

const emptyForm: FormState = { startDate: '', endDate: '', factor: '' };

function validateForm(
  form: FormState,
): string | null {
  if (!form.startDate) return 'Start date is required.';
  if (!form.endDate) return 'End date is required.';
  if (form.endDate < form.startDate) return 'End date must be on or after start date.';
  const factor = Number(form.factor);
  if (isNaN(factor) || form.factor === '') return 'Factor is required.';
  if (factor < 0 || factor > 100) return 'Factor must be between 0 and 100.';
  return null;
}

export function ProductivityWindowPanel({
  windows,
  projectStartDate,
  projectEndDate,
  onAdd,
  onUpdate,
  onRemove,
}: ProductivityWindowPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(emptyForm);
  const [addError, setAddError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [editError, setEditError] = useState('');

  // Derive min/max dates from project for date inputs
  const minDate = projectStartDate.slice(0, 10);
  const maxDate = projectEndDate.slice(0, 10);

  const handleAdd = () => {
    const error = validateForm(addForm);
    if (error) {
      setAddError(error);
      return;
    }
    onAdd(addForm.startDate, addForm.endDate, Number(addForm.factor) / 100);
    setAddForm(emptyForm);
    setAddError('');
    setShowAddForm(false);
  };

  const startEdit = (w: ProductivityWindow) => {
    setEditingId(w.id);
    setEditForm({
      startDate: w.startDate,
      endDate: w.endDate,
      factor: String(Math.round(w.factor * 100)),
    });
    setEditError('');
  };

  const handleEditSave = (id: string) => {
    const error = validateForm(editForm);
    if (error) {
      setEditError(error);
      return;
    }
    onUpdate(id, {
      startDate: editForm.startDate,
      endDate: editForm.endDate,
      factor: Number(editForm.factor) / 100,
    });
    setEditingId(null);
    setEditError('');
  };

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <span
          className="inline-block transition-transform"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          &#9654;
        </span>
        Productivity Windows
        {windows.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            {windows.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="mt-3">
          {windows.length === 0 && !showAddForm && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No productivity windows defined. Add one to model reduced capacity
              periods (holidays, onboarding, etc.).
            </p>
          )}

          {windows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="pb-2 pr-4">Start Date</th>
                    <th className="pb-2 pr-4">End Date</th>
                    <th className="pb-2 pr-4">Factor (%)</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {windows.map((w) => (
                    <tr
                      key={w.id}
                      className="border-b border-zinc-100 dark:border-zinc-800"
                    >
                      {editingId === w.id ? (
                        <>
                          <td className="py-2 pr-4">
                            <input
                              type="date"
                              value={editForm.startDate}
                              min={minDate}
                              max={maxDate}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  startDate: e.target.value,
                                }))
                              }
                              className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                          </td>
                          <td className="py-2 pr-4">
                            <input
                              type="date"
                              value={editForm.endDate}
                              min={minDate}
                              max={maxDate}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  endDate: e.target.value,
                                }))
                              }
                              className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                          </td>
                          <td className="py-2 pr-4">
                            <input
                              type="number"
                              value={editForm.factor}
                              min={0}
                              max={100}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  factor: e.target.value,
                                }))
                              }
                              className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                          </td>
                          <td className="py-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditSave(w.id)}
                                className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditError('');
                                }}
                                className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                              >
                                Cancel
                              </button>
                            </div>
                            {editError && editingId === w.id && (
                              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                {editError}
                              </p>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 pr-4">{w.startDate}</td>
                          <td className="py-2 pr-4">{w.endDate}</td>
                          <td className="py-2 pr-4">
                            {Math.round(w.factor * 100)}%
                          </td>
                          <td className="py-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEdit(w)}
                                className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => onRemove(w.id)}
                                className="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showAddForm && (
            <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={addForm.startDate}
                    min={minDate}
                    max={maxDate}
                    onChange={(e) =>
                      setAddForm((f) => {
                        const next = { ...f, startDate: e.target.value };
                        if (e.target.value && !f.endDate) {
                          next.endDate = nextBusinessDay(e.target.value);
                        }
                        return next;
                      })
                    }
                    className="mt-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={addForm.endDate}
                    min={addForm.startDate || minDate}
                    max={maxDate}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                    className="mt-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Factor (%)
                  </label>
                  <input
                    type="number"
                    value={addForm.factor}
                    min={0}
                    max={100}
                    placeholder="e.g., 50"
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, factor: e.target.value }))
                    }
                    className="mt-1 w-20 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAdd}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setAddForm(emptyForm);
                      setAddError('');
                    }}
                    className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              {addError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {addError}
                </p>
              )}
            </div>
          )}

          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-3 rounded border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
            >
              + Add Window
            </button>
          )}
        </div>
      )}
    </div>
  );
}
