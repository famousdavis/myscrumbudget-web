// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { use, useState, useMemo, useEffect } from 'react';
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
import { ProductivityWindowPanel } from '@/features/reforecast/components/ProductivityWindowPanel';
import { ForecastMetricsPanel } from '@/features/projects/components/ForecastMetricsPanel';
import { useProjectMetrics } from '@/features/projects/hooks/useProjectMetrics';
import { MonthlyCostBarChart } from '@/components/charts/MonthlyCostBarChart';
import { CumulativeCostLineChart } from '@/components/charts/CumulativeCostLineChart';
import { TrashIcon } from '@/components/icons/TrashIcon';
import { CostByPeriodTable } from '@/components/CostByPeriodTable';
import { HistoricalCostsTable } from '@/components/HistoricalCostsTable';
import { generateMonthRange } from '@/lib/utils/dates';
import { buildChartData } from '@/lib/utils/buildChartData';
import { SharingSection } from '@/features/projects/components/SharingSection';
import { SkeletonProjectDetail } from '@/components/Skeleton';

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { project, loading, updateProject, flush } = useProject(id);

  useEffect(() => () => { flush(); }, [flush]);
  const { deleteProject } = useProjects();
  const { settings } = useSettings();
  const { pool } = useTeamPool();
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
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">Monthly Cost</h3>
              <MonthlyCostBarChart monthlyData={chartData} />
            </div>
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">Cumulative Cost vs Budget</h3>
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
        <SharingSection projectId={project.id} />
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
    </div>
  );
}
