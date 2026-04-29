// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useMemo } from 'react';
import type { Project, Settings, PoolMember, ProjectMetrics } from '@/types/domain';
import { calculateProjectMetrics } from '@/lib/calc';
import { resolveAssignments, getActiveReforecast } from '@/lib/utils/teamResolution';

/**
 * Memoized hook that calculates project metrics.
 * Resolves project assignments against the pool before calculating.
 */
export function useProjectMetrics(
  project: Project | null,
  settings: Settings | null,
  pool: PoolMember[],
): ProjectMetrics | null {
  return useMemo(() => {
    if (!project || !settings) return null;
    if (project.reforecasts.length === 0) return null;

    const reforecast = getActiveReforecast(project);

    if (!reforecast || reforecast.allocations.length === 0) return null;

    const teamMembers = resolveAssignments(reforecast.assignments ?? [], pool);
    return calculateProjectMetrics(project, settings, teamMembers);
  }, [project, settings, pool]);
}
