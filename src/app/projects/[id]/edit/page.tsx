// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useProject } from '@/features/projects/hooks/useProject';
import { useReforecast } from '@/features/reforecast/hooks/useReforecast';
import { ProjectForm } from '@/features/projects/components/ProjectForm';
import { BaseDialog, dialogButtonStyles } from '@/components/BaseDialog';
import { Skeleton } from '@/components/Skeleton';
import {
  computeSingleReforecastTimelineChangeSummary,
  summaryHasChanges,
  type TimelineChangeSummary,
} from '@/features/projects/lib/timelineChange';

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
  const {
    activeReforecast,
    commitReforecastStartDate,
    commitReforecastEndDate,
  } = useReforecast({ project, updateProject });

  useEffect(() => () => { flush(); }, [flush]);

  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
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

  const rfName = activeReforecast?.name ?? 'Baseline';
  // Date fields reflect the ACTIVE REFORECAST's window (v0.29.1). The project's
  // own startDate/endDate are kept in storage for backward compat but are no
  // longer read or written here.
  const currentStart = activeReforecast?.startDate ?? project.startDate;
  const currentEnd = activeReforecast?.endDate ?? project.endDate;

  return (
    <div>
      <h1 className="text-2xl font-bold">Edit Project</h1>
      <div className="mt-6">
        <ProjectForm
          initialData={{
            name: project.name,
            startDate: currentStart,
            endDate: currentEnd,
            baselineBudget: activeReforecast?.baselineBudget ?? 0,
          }}
          submitLabel="Save Changes"
          dateHelperText={
            <>
              Dates apply to the active reforecast (<strong>{rfName}</strong>). Switch reforecasts in the toolbar to edit a different scenario&apos;s window.
            </>
          }
          onSubmit={async (data) => {
            const { name, startDate, endDate, baselineBudget } = data;
            const startChanged = startDate !== currentStart;
            const endChanged = endDate !== currentEnd;

            // Compute the rf timeline-change summary if any date moved.
            const today = new Date().toISOString().slice(0, 10);
            let summary: TimelineChangeSummary | null = null;
            if (activeReforecast && (startChanged || endChanged)) {
              summary = computeSingleReforecastTimelineChangeSummary(
                activeReforecast,
                startDate,
                endDate,
                today,
              );
            }

            // The function that actually writes all changes. Project-level
            // dates (project.startDate / project.endDate) are intentionally
            // NOT touched — they remain in storage as creation-time metadata
            // but no longer drive runtime behavior.
            //
            // Awaits `flush()` so the repo write completes BEFORE the
            // Promise resolves. ProjectForm calls `router.back()` only
            // after `await onSubmit(...)`, and the detail page reloads
            // from the repo on mount — without this await, the navigation
            // beats the save and the user sees stale months (v0.29.2 fix).
            const applyAll = async () => {
              // 1. Project name + baselineBudget (single updateProject call
              //    so the change-tracker sees them atomically).
              updateProject((prev) => {
                const activeId = prev.activeReforecastId ?? prev.reforecasts[0]?.id;
                return {
                  ...prev,
                  name,
                  reforecasts: prev.reforecasts.map((rf) =>
                    rf.id === activeId ? { ...rf, baselineBudget } : rf,
                  ),
                };
              });

              // 2. Reforecast window changes route through the same helpers
              //    the v0.29.0 toolbar used. Start first (it may clamp
              //    reforecastDate); end second.
              if (startChanged) commitReforecastStartDate(startDate, today);
              if (endChanged) commitReforecastEndDate(endDate);

              await flush();
            };

            // If date changes have material effects (allocations trimmed,
            // historical-cost entries removed, reforecastDate clamped,
            // actualsThroughDate clamped, or productivity windows now out of
            // range), present the confirmation dialog before applying.
            if (summary && summaryHasChanges(summary)) {
              return new Promise<void>((resolve, reject) => {
                rejectRef.current = () => {
                  setPendingSave(null);
                  reject(new Error('cancelled'));
                };
                setPendingSave({
                  summary,
                  apply: async () => {
                    await applyAll();
                    setPendingSave(null);
                    resolve();
                  },
                });
              });
            }

            await applyAll();
          }}
        />
      </div>

      {pendingSave && (
        <BaseDialog
          title="Adjust reforecast window"
          actions={
            <>
              <button onClick={() => rejectRef.current?.()} className={dialogButtonStyles.cancel}>
                Cancel
              </button>
              <button onClick={() => pendingSave.apply()} className={dialogButtonStyles.primary}>
                Confirm
              </button>
            </>
          }
        >
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {summaryOnlyFlagsWindows(pendingSave.summary)
              ? "Changing this reforecast's dates will have the following effects:"
              : "Changing this reforecast's dates will affect its existing data:"}
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            {renderSummaryBullets(pendingSave.summary)}
          </ul>
        </BaseDialog>
      )}
    </div>
  );
}

function summaryOnlyFlagsWindows(s: TimelineChangeSummary): boolean {
  return (
    s.productivityWindowsToFlag > 0 &&
    s.allocationsToRemove === 0 &&
    s.historicalCostEntriesToRemove === 0 &&
    s.reforecastDateAdjustment === null &&
    s.actualsThroughDateAdjustment === null
  );
}

function renderSummaryBullets(s: TimelineChangeSummary): React.ReactNode {
  const items: React.ReactNode[] = [];
  if (s.allocationsToRemove > 0) {
    items.push(
      <li key="alloc">
        {s.allocationsToRemove === 1
          ? 'Remove 1 allocation outside the new date range.'
          : `Remove ${s.allocationsToRemove} allocations outside the new date range.`}
      </li>,
    );
  }
  if (s.historicalCostEntriesToRemove > 0) {
    items.push(
      <li key="hist">
        {s.historicalCostEntriesToRemove === 1
          ? 'Remove 1 historical cost entry outside the new range.'
          : `Remove ${s.historicalCostEntriesToRemove} historical cost entries outside the new range.`}
      </li>,
    );
  }
  if (s.productivityWindowsToFlag > 0) {
    items.push(
      <li key="pw">
        {s.productivityWindowsToFlag === 1
          ? '1 productivity window will fall outside the new range and be flagged for review.'
          : `${s.productivityWindowsToFlag} productivity windows will fall outside the new range and be flagged for review.`}
      </li>,
    );
  }
  if (s.reforecastDateAdjustment) {
    items.push(
      <li key="rd">
        Adjust the Reforecast Date from <strong>{s.reforecastDateAdjustment.from}</strong> to{' '}
        <strong>{s.reforecastDateAdjustment.to}</strong>.
      </li>,
    );
  }
  if (s.actualsThroughDateAdjustment) {
    items.push(
      <li key="atd">
        Adjust the Actuals Through date from <strong>{s.actualsThroughDateAdjustment.from}</strong>{' '}
        to <strong>{s.actualsThroughDateAdjustment.to}</strong>.
      </li>,
    );
  }
  return items;
}
