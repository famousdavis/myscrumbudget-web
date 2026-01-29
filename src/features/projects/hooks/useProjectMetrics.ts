'use client';

import { useMemo } from 'react';
import type { Project, Settings, ProjectMetrics } from '@/types/domain';
import { calculateProjectMetrics } from '@/lib/calc';

/**
 * Memoized hook that calculates project metrics.
 * Recalculates when project or settings change (including allocation edits).
 */
export function useProjectMetrics(
  project: Project | null,
  settings: Settings | null,
): ProjectMetrics | null {
  return useMemo(() => {
    if (!project || !settings) return null;
    if (project.reforecasts.length === 0) return null;

    const reforecast = project.activeReforecastId
      ? project.reforecasts.find(r => r.id === project.activeReforecastId)
      : project.reforecasts[0];

    if (!reforecast || reforecast.allocations.length === 0) return null;

    return calculateProjectMetrics(project, settings);
  }, [project, settings]);
}
