'use client';

import { use, useState, useRef } from 'react';
import Link from 'next/link';
import { useProject } from '@/features/projects/hooks/useProject';
import { ProjectForm } from '@/features/projects/components/ProjectForm';
import { generateMonthRange } from '@/lib/utils/dates';

interface PendingSave {
  allocationCount: number;
  apply: () => void;
}

export default function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { project, loading, updateProject, flush } = useProject(id);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const rejectRef = useRef<(() => void) | null>(null);

  if (loading) {
    return <p className="text-zinc-500">Loading project...</p>;
  }

  if (!project) {
    return (
      <div>
        <p className="text-zinc-500">Project not found.</p>
        <Link href="/" className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Edit Project</h1>
      <div className="mt-6">
        <ProjectForm
          initialData={{
            name: project.name,
            startDate: project.startDate,
            endDate: project.endDate,
            baselineBudget: project.baselineBudget,
            actualCost: project.actualCost,
          }}
          submitLabel="Save Changes"
          onSubmit={async (data) => {
            // Check if timeline changed
            const timelineChanged =
              data.startDate !== project.startDate ||
              data.endDate !== project.endDate;

            if (timelineChanged && project.reforecasts.length > 0) {
              const newStartMonth = data.startDate.slice(0, 7);
              const newEndMonth = data.endDate.slice(0, 7);
              const newMonths = new Set(
                generateMonthRange(newStartMonth, newEndMonth),
              );

              // Count allocations that would be outside the new range
              let outOfRangeCount = 0;
              for (const rf of project.reforecasts) {
                for (const a of rf.allocations) {
                  if (!newMonths.has(a.month)) {
                    outOfRangeCount++;
                  }
                }
              }

              if (outOfRangeCount > 0) {
                // Show confirmation dialog; await user decision
                return new Promise<void>((resolve, reject) => {
                  rejectRef.current = () => {
                    setPendingSave(null);
                    reject(new Error('cancelled'));
                  };
                  setPendingSave({
                    allocationCount: outOfRangeCount,
                    apply: () => {
                      updateProject((prev) => ({
                        ...prev,
                        ...data,
                        reforecasts: prev.reforecasts.map((rf) => ({
                          ...rf,
                          allocations: rf.allocations.filter((a) =>
                            newMonths.has(a.month),
                          ),
                        })),
                      }));
                      flush();
                      setPendingSave(null);
                      resolve();
                    },
                  });
                });
              }
            }

            // No allocation conflict — apply directly
            updateProject((prev) => ({
              ...prev,
              ...data,
            }));
            flush();
          }}
        />
      </div>

      {pendingSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900">
            <h3 className="text-lg font-semibold">Timeline Change</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Changing the timeline will remove{' '}
              <strong>{pendingSave.allocationCount}</strong>{' '}
              allocation{pendingSave.allocationCount === 1 ? '' : 's'} that{' '}
              {pendingSave.allocationCount === 1 ? 'falls' : 'fall'} outside the
              new date range. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => rejectRef.current?.()}
                className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={() => pendingSave.apply()}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
