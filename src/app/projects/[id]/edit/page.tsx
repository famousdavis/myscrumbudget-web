// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { use, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useProject } from '@/features/projects/hooks/useProject';
import { ProjectForm } from '@/features/projects/components/ProjectForm';
import {
  applyTimelineChangeToReforecasts,
  computeTimelineChangeSummary,
  summaryHasChanges,
  type TimelineChangeSummary,
} from '@/features/projects/lib/timelineChange';
import { getActiveReforecast } from '@/lib/utils/teamResolution';
import { Skeleton } from '@/components/Skeleton';

interface PendingSave {
  summary: TimelineChangeSummary;
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

  useEffect(() => () => { flush(); }, [flush]);
  const rejectRef = useRef<(() => void) | null>(null);

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-32" />
        <div className="mt-6 max-w-md space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
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

  const activeRf = getActiveReforecast(project);

  return (
    <div>
      <h1 className="text-2xl font-bold">Edit Project</h1>
      <div className="mt-6">
        <ProjectForm
          initialData={{
            name: project.name,
            startDate: project.startDate,
            endDate: project.endDate,
            baselineBudget: activeRf?.baselineBudget ?? 0,
          }}
          submitLabel="Save Changes"
          onSubmit={async (data) => {
            const { baselineBudget, ...projectFields } = data;

            // Helper to apply baselineBudget to the active reforecast
            const applyBudget = (prev: typeof project) => {
              const activeId = prev.activeReforecastId ?? prev.reforecasts[0]?.id;
              return prev.reforecasts.map((rf) =>
                rf.id === activeId
                  ? { ...rf, baselineBudget }
                  : rf,
              );
            };

            // Check if timeline changed
            const timelineChanged =
              projectFields.startDate !== project.startDate ||
              projectFields.endDate !== project.endDate;

            if (timelineChanged && project.reforecasts.length > 0) {
              const summary = computeTimelineChangeSummary(
                project.reforecasts,
                projectFields.startDate,
                projectFields.endDate,
              );

              if (summaryHasChanges(summary)) {
                // Show confirmation dialog; await user decision
                return new Promise<void>((resolve, reject) => {
                  rejectRef.current = () => {
                    setPendingSave(null);
                    reject(new Error('cancelled'));
                  };
                  setPendingSave({
                    summary,
                    apply: () => {
                      // Order of operations: apply new bounds, then derive
                      // adjusted reforecasts from those NEW bounds (passed
                      // explicitly to the helper so there is no ambiguity
                      // about which `startDate`/`endDate` is current).
                      updateProject((prev) => {
                        const rfWithBudget = applyBudget(prev);
                        const adjusted = applyTimelineChangeToReforecasts(
                          rfWithBudget,
                          projectFields.startDate,
                          projectFields.endDate,
                        );
                        return {
                          ...prev,
                          ...projectFields,
                          reforecasts: adjusted,
                        };
                      });
                      flush();
                      setPendingSave(null);
                      resolve();
                    },
                  });
                });
              }
            }

            // No timeline conflict — apply directly
            updateProject((prev) => ({
              ...prev,
              ...projectFields,
              reforecasts: applyBudget(prev),
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
              Changing the timeline will affect existing reforecast data:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
              {pendingSave.summary.allocationsToRemove > 0 && (
                <li>
                  Remove <strong>{pendingSave.summary.allocationsToRemove}</strong>{' '}
                  allocation{pendingSave.summary.allocationsToRemove === 1 ? '' : 's'}{' '}
                  outside the new date range.
                </li>
              )}
              {pendingSave.summary.datesToAdjust > 0 && (
                <li>
                  Adjust <strong>{pendingSave.summary.datesToAdjust}</strong>{' '}
                  reforecast date{pendingSave.summary.datesToAdjust === 1 ? '' : 's'}{' '}
                  to fit the new range.
                </li>
              )}
              {pendingSave.summary.historicalCostEntriesToStrip > 0 && (
                <li>
                  Strip <strong>{pendingSave.summary.historicalCostEntriesToStrip}</strong>{' '}
                  historical cost entr
                  {pendingSave.summary.historicalCostEntriesToStrip === 1 ? 'y' : 'ies'}{' '}
                  outside the new range.
                </li>
              )}
            </ul>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              This cannot be undone.
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
