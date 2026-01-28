'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProjectFormData {
  name: string;
  startDate: string;
  endDate: string;
  baselineBudget: number;
  actualCost: number;
}

interface ProjectFormProps {
  initialData?: ProjectFormData;
  onSubmit: (data: ProjectFormData) => Promise<void>;
  submitLabel: string;
}

const defaultData: ProjectFormData = {
  name: '',
  startDate: '',
  endDate: '',
  baselineBudget: 0,
  actualCost: 0,
};

export function ProjectForm({
  initialData,
  onSubmit,
  submitLabel,
}: ProjectFormProps) {
  const router = useRouter();
  const [data, setData] = useState<ProjectFormData>(initialData ?? defaultData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: keyof ProjectFormData, value: string) => {
    setData((prev) => ({
      ...prev,
      [field]:
        field === 'baselineBudget' || field === 'actualCost'
          ? parseFloat(value) || 0
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!data.name.trim()) {
      setError('Project name is required.');
      return;
    }
    if (!data.startDate) {
      setError('Start date is required.');
      return;
    }
    if (!data.endDate) {
      setError('End date is required.');
      return;
    }
    if (data.endDate < data.startDate) {
      setError('End date must be after start date.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(data);
      router.push('/');
    } catch {
      setError('Failed to save project.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Project Name</label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Start Date</label>
          <input
            type="date"
            value={data.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">End Date</label>
          <input
            type="date"
            value={data.endDate}
            onChange={(e) => handleChange('endDate', e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Baseline Budget ($)
          </label>
          <input
            type="number"
            value={data.baselineBudget || ''}
            onChange={(e) => handleChange('baselineBudget', e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Actual Cost ($)
          </label>
          <input
            type="number"
            value={data.actualCost || ''}
            onChange={(e) => handleChange('actualCost', e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
