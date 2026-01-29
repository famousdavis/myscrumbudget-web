'use client';

import { use, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProject } from '@/features/projects/hooks/useProject';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useTeamPool } from '@/features/team/hooks/useTeamPool';
import { useTeam } from '@/features/team/hooks/useTeam';
import { useReforecast } from '@/features/reforecast/hooks/useReforecast';
import { ProjectSummary } from '@/features/projects/components/ProjectSummary';
import { DeleteProjectDialog } from '@/features/projects/components/DeleteProjectDialog';
import { AllocationGrid } from '@/features/reforecast/components/AllocationGrid';
import { ForecastMetricsPanel } from '@/features/projects/components/ForecastMetricsPanel';
import { useProjectMetrics } from '@/features/projects/hooks/useProjectMetrics';
import { MonthlyCostBarChart } from '@/components/charts/MonthlyCostBarChart';
import { CumulativeCostLineChart } from '@/components/charts/CumulativeCostLineChart';
import { generateMonthRange } from '@/lib/utils/dates';

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { project, loading, updateProject } = useProject(id);
  const { deleteProject } = useProjects();
  const { settings } = useSettings();
  const { pool } = useTeamPool();
  const { members, addAssignment, removeAssignment } = useTeam({
    project,
    updateProject,
    pool,
  });
  const { allocationMap, onAllocationChange } = useReforecast({
    project,
    updateProject,
  });
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

  if (loading) {
    return <p className="text-zinc-500">Loading project...</p>;
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
            onClick={() => setShowDelete(true)}
            className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-6">
        <ProjectSummary project={project} metrics={metrics} />
      </div>

      {/* Allocation Grid */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Allocations</h2>
        <div className="mt-3">
          <AllocationGrid
            months={months}
            teamMembers={members}
            allocationMap={allocationMap}
            onAllocationChange={onAllocationChange}
            onMemberDelete={removeAssignment}
            onMemberAdd={addAssignment}
            pool={pool}
            monthlyData={metrics?.monthlyData}
          />
        </div>
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
              <MonthlyCostBarChart monthlyData={metrics.monthlyData} />
            </div>
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">Cumulative Cost vs Budget</h3>
              <CumulativeCostLineChart
                monthlyData={metrics.monthlyData}
                baselineBudget={project.baselineBudget}
              />
            </div>
          </div>
        </div>
      )}

      {showDelete && (
        <DeleteProjectDialog
          projectName={project.name}
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

