// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { use, useState, useMemo, useEffect, useRef } from 'react';
import { APP_NAME } from '@/lib/constants';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProject } from '@/features/projects/hooks/useProject';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useTeamPool } from '@/features/team/hooks/useTeamPool';
import { useTeam } from '@/features/team/hooks/useTeam';
import { useReforecast } from '@/features/reforecast/hooks/useReforecast';
import { ProjectSummary } from '@/features/projects/components/ProjectSummary';
import { ConfirmDialog } from '@/components/BaseDialog';
import { AllocationGrid } from '@/features/reforecast/components/AllocationGrid';
import { ReforecastToolbar } from '@/features/reforecast/components/ReforecastToolbar';
import { ReforecastNotes } from '@/features/reforecast/components/ReforecastNotes';
import { ResourcePlanExcelPanel } from '@/features/reforecast/components/ResourcePlanExcelPanel';
import { ProductivityWindowPanel } from '@/features/reforecast/components/ProductivityWindowPanel';
import { ForecastMetricsPanel } from '@/features/projects/components/ForecastMetricsPanel';
import { useProjectMetrics } from '@/features/projects/hooks/useProjectMetrics';
import { MonthlyCostBarChart } from '@/components/charts/MonthlyCostBarChart';
import { CumulativeCostLineChart } from '@/components/charts/CumulativeCostLineChart';
import { TrashIcon } from '@/components/icons/TrashIcon';
import { UndoIcon } from '@/components/icons/UndoIcon';
import { RedoIcon } from '@/components/icons/RedoIcon';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { CopyImageButton } from '@/components/CopyImageButton';
import { CostByPeriodTable } from '@/components/CostByPeriodTable';
import { HistoricalCostsTable } from '@/components/HistoricalCostsTable';
import { PrintableReport } from '@/components/PrintableReport';
import { generateMonthRange } from '@/lib/utils/dates';
import { buildChartData } from '@/lib/utils/buildChartData';
import { SharingSection } from '@/features/projects/components/SharingSection';
import { BulkSharingSection } from '@/features/projects/components/BulkSharingSection';
import { INVITATIONS_ENABLED } from '@/lib/featureFlags';
import { SkeletonProjectDetail } from '@/components/Skeleton';

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const {
    project,
    loading,
    updateProject,
    flush,
    undo,
    redo,
    canUndo,
    canRedo,
    beginUndoGroup,
    endUndoGroup,
  } = useProject(id);

  useEffect(() => () => { flush(); }, [flush]);

  // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo. Tristate `shift` keeps the
  // two handlers from cross-firing on Ctrl+Shift+Z. Listeners unregister
  // when the page unmounts, so undo/redo is correctly scoped to the project
  // detail route.
  useKeyboardShortcut('z', undo, { ctrl: true, shift: false });
  useKeyboardShortcut('Z', redo, { ctrl: true, shift: true });

  // Customize document.title so the browser's print-page header (configured
  // in print options) reads "MyScrumBudget for {project} - {date}" — matches
  // SPERT Scheduler's pattern. Uses local-time date construction (not
  // toISOString) so the date doesn't drift to UTC's "tomorrow" on evenings
  // west of GMT. Restores the previous title on unmount or project change.
  useEffect(() => {
    if (!project) return;
    const previous = document.title;
    const todayLong = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    document.title = `${APP_NAME} for ${project.name} - ${todayLong}`;
    return () => { document.title = previous; };
  }, [project]);
  const { deleteProject } = useProjects();
  const { settings } = useSettings();
  const { pool, addPoolMember, unarchivePoolMember } = useTeamPool();
  const { members, addAssignment, removeAssignment, reorderAssignments, sortAssignments } = useTeam({
    project,
    updateProject,
    pool,
  });
  const {
    reforecasts,
    activeReforecast,
    allocationMap,
    productivityWindows,
    onAllocationChange,
    switchReforecast,
    createReforecast,
    deleteReforecast,
    addProductivityWindow,
    updateProductivityWindow,
    removeProductivityWindow,
    updateActualCost,
    updateBaselineBudget,
    updateReforecastDate,
    updateActualsThroughDate,
    updateHistoricalCosts,
    updateNotes,
    updateName,
  } = useReforecast({
    project,
    updateProject,
  });
  const actualCost = activeReforecast?.actualCost ?? 0;
  const baselineBudget = activeReforecast?.baselineBudget ?? 0;
  const reforecastDate = activeReforecast?.reforecastDate ?? '';
  const actualsThroughDate = activeReforecast?.actualsThroughDate;
  const metrics = useProjectMetrics(project, settings, pool);
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const monthlyChartRef = useRef<HTMLDivElement>(null);
  const cumulativeChartRef = useRef<HTMLDivElement>(null);

  const months = useMemo(() => {
    if (!project) return [];
    // Extract YYYY-MM from YYYY-MM-DD dates
    const startMonth = project.startDate.slice(0, 7);
    const endMonth = project.endDate.slice(0, 7);
    return generateMonthRange(startMonth, endMonth);
  }, [project]);

  const chartData = useMemo(
    () => buildChartData(
      activeReforecast?.historicalCosts,
      metrics?.monthlyData ?? [],
      activeReforecast?.actualsThroughDate,
      project?.startDate ?? '',
      activeReforecast?.actualCost ?? 0,
    ),
    [
      activeReforecast?.historicalCosts,
      metrics?.monthlyData,
      activeReforecast?.actualsThroughDate,
      project?.startDate,
      activeReforecast?.actualCost,
    ],
  );

  if (loading) {
    return <SkeletonProjectDetail />;
  }

  if (!project) {
    return (
      <div>
        <p className="text-zinc-500">Project not found.</p>
        <Link
          href="/"
          className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <div className="flex gap-2">
          <Link
            href={`/projects/${project.id}/edit`}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 print:hidden"
            title="Print Report (or Save as PDF)"
            aria-label="Print Report"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z"
              />
            </svg>
            Print
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:disabled:hover:bg-transparent print:hidden"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <UndoIcon className="h-4 w-4" />
            Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:disabled:hover:bg-transparent print:hidden"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <RedoIcon className="h-4 w-4" />
            Redo
          </button>
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-950 dark:hover:text-red-400"
            title="Delete project"
            aria-label="Delete project"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-6">
        <ProjectSummary
          project={project}
          metrics={metrics}
          actualCost={actualCost}
          baselineBudget={baselineBudget}
          trafficLightThresholds={settings?.trafficLightThresholds}
          onActualCostChange={updateActualCost}
          onBaselineBudgetChange={updateBaselineBudget}
        />
      </div>

      {/* Allocation Grid */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Allocations</h2>
        <div className="mt-3">
          <ReforecastToolbar
            reforecasts={reforecasts}
            activeReforecastId={project.activeReforecastId}
            reforecastDate={reforecastDate}
            actualsThroughDate={actualsThroughDate}
            projectStartDate={project.startDate}
            projectEndDate={project.endDate}
            onSwitch={switchReforecast}
            onCreate={createReforecast}
            onDelete={deleteReforecast}
            onRename={updateName}
            onReforecastDateChange={updateReforecastDate}
            onActualsThroughDateChange={updateActualsThroughDate}
          />
        </div>
        {activeReforecast && (
          <div className="mt-3">
            <ReforecastNotes
              key={activeReforecast.id}
              value={activeReforecast.notes ?? ''}
              onChange={updateNotes}
              onBeginEdit={beginUndoGroup}
              onEndEdit={endUndoGroup}
            />
          </div>
        )}
        <div className="mt-3">
          <AllocationGrid
            months={months}
            teamMembers={members}
            allocationMap={allocationMap}
            onAllocationChange={onAllocationChange}
            onMemberDelete={removeAssignment}
            onMemberAdd={addAssignment}
            onReorder={reorderAssignments}
            onSort={sortAssignments}
            pool={pool}
            monthlyData={metrics?.monthlyData}
            productivityWindows={productivityWindows}
            actualsThroughDate={actualsThroughDate}
          />
        </div>
        {activeReforecast && settings && (
          <ResourcePlanExcelPanel
            project={project}
            activeReforecast={activeReforecast}
            members={members}
            allocationMap={allocationMap}
            months={months}
            pool={pool}
            settings={settings}
            updateProject={updateProject}
            addPoolMember={addPoolMember}
            unarchivePoolMember={unarchivePoolMember}
          />
        )}
      </div>

      {/* Productivity Windows */}
      <div className="mt-8">
        <ProductivityWindowPanel
          windows={productivityWindows}
          projectStartDate={project.startDate}
          projectEndDate={project.endDate}
          onAdd={addProductivityWindow}
          onUpdate={updateProductivityWindow}
          onRemove={removeProductivityWindow}
        />
      </div>

      {/* Forecast Metrics */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Forecast Metrics</h2>
        <div className="mt-3">
          <ForecastMetricsPanel metrics={metrics} />
        </div>
      </div>

      {/* Charts */}
      {metrics && metrics.monthlyData.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Cost Charts</h2>
          <div className="mt-3 grid gap-6 lg:grid-cols-2">
            <div ref={monthlyChartRef} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Monthly Cost</h3>
                <CopyImageButton targetRef={monthlyChartRef} />
              </div>
              <MonthlyCostBarChart monthlyData={chartData} />
            </div>
            <div ref={cumulativeChartRef} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Cumulative Cost vs Budget</h3>
                <CopyImageButton targetRef={cumulativeChartRef} />
              </div>
              <CumulativeCostLineChart
                monthlyData={chartData}
                baselineBudget={baselineBudget}
              />
            </div>
          </div>
        </div>
      )}

      {/* Historical Costs Breakdown */}
      {activeReforecast && (
        <div className="mt-8">
          <HistoricalCostsTable
            activeReforecast={activeReforecast}
            project={project}
            onUpdate={updateHistoricalCosts}
          />
        </div>
      )}

      {/* Cost by Period */}
      {metrics && metrics.monthlyData.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Cost by Period</h2>
          <div className="mt-3">
            <CostByPeriodTable
              monthlyData={metrics.monthlyData}
              actualCost={actualCost}
            />
          </div>
        </div>
      )}

      {/* Sharing (cloud mode, owner only) */}
      <div className="mt-8">
        {INVITATIONS_ENABLED
          ? <BulkSharingSection projectId={project.id} />
          : <SharingSection projectId={project.id} />}
      </div>

      {showDelete && (
        <ConfirmDialog
          title="Delete Project"
          message={<>Are you sure you want to delete <strong>{project.name}</strong>? This action cannot be undone.</>}
          onConfirm={async () => {
            await deleteProject(project.id);
            router.push('/');
          }}
          onCancel={() => setShowDelete(false)}
        />
      )}

      <PrintableReport
        project={project}
        activeReforecast={activeReforecast}
        metrics={metrics}
        chartData={chartData}
        baselineBudget={baselineBudget}
        actualCost={actualCost}
        trafficLightThresholds={settings?.trafficLightThresholds}
      />
    </div>
  );
}
