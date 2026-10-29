// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect, useRef } from 'react';
import type { Project, Reforecast } from '@/types/domain';
import { MAX_FORECAST_MONTHS } from '@/lib/constants';
import { generateMonthRange } from '@/lib/utils/dates';
import { takeCloudLoadIssues } from '@/lib/storage/cloudLoadGuard';
import { useToast } from '@/components/Toast';

/** True when the reforecast's window runs past `MAX_FORECAST_MONTHS`. */
export function isWindowClamped(reforecast: Reforecast | null | undefined): boolean {
  if (!reforecast || typeof reforecast.startDate !== 'string' || typeof reforecast.endDate !== 'string') {
    return false;
  }
  return generateMonthRange(
    reforecast.startDate.slice(0, 7),
    reforecast.endDate.slice(0, 7),
    MAX_FORECAST_MONTHS + 1,
  ).length > MAX_FORECAST_MONTHS;
}

/**
 * The notice for a project the user opened, or null when there is nothing to
 * say. Names the project, never a value from it (v0.44.6).
 */
export function describeCloudLoadNotice(
  projectName: string,
  setAside: boolean,
  clamped: boolean,
): string | null {
  const name = projectName || 'this project';
  if (setAside) {
    return `Some data in "${name}" could not be read and was left out. The rest of the project loaded normally.`;
  }
  if (clamped) {
    return `"${name}" covers more than ${MAX_FORECAST_MONTHS / 12} years. Only the first ${MAX_FORECAST_MONTHS / 12} years are shown and calculated; nothing was changed.`;
  }
  return null;
}

/**
 * Tells the user, once per project they open, when the cloud read path set
 * something aside in it or its window is longer than the app calculates.
 */
export function useCloudLoadNotice(
  project: Project | null,
  activeReforecast: Reforecast | null | undefined,
): void {
  const { addToast } = useToast();
  const toldFor = useRef<string | null>(null);
  const clamped = isWindowClamped(activeReforecast);

  useEffect(() => {
    if (!project || toldFor.current === project.id) return;
    const setAside = takeCloudLoadIssues(project.id).length > 0;
    const message = describeCloudLoadNotice(project.name, setAside, clamped);
    if (!message) return;
    toldFor.current = project.id;
    addToast(message, 'info');
  }, [project, clamped, addToast]);
}
