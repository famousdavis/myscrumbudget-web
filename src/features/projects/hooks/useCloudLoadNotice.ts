// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect, useRef } from 'react';
import type { Project } from '@/types/domain';
import { takeCloudLoadIssues } from '@/lib/storage/cloudLoadGuard';
import { useToast } from '@/components/Toast';

/** The notice for a project with something set aside: names it, never a value. */
export function describeCloudLoadNotice(projectName: string): string {
  const name = projectName || 'this project';
  return `Some data in "${name}" could not be read and was left out. The rest of the project loaded normally.`;
}

/**
 * Tells the user, once per project they open, when the cloud read path set
 * something aside in it (v0.44.6). A window longer than the app calculates is
 * shown on the page itself — `ForecastWindowNotice` — because it qualifies the
 * figures for as long as they are on screen.
 */
export function useCloudLoadNotice(project: Project | null): void {
  const { addToast } = useToast();
  const toldFor = useRef<string | null>(null);

  useEffect(() => {
    if (!project || toldFor.current === project.id) return;
    if (takeCloudLoadIssues(project.id).length === 0) return;
    toldFor.current = project.id;
    addToast(describeCloudLoadNotice(project.name), 'info');
  }, [project, addToast]);
}
