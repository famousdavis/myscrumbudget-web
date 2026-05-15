// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useProject } from '@/features/projects/hooks/useProject';
import { ProjectForm } from '@/features/projects/components/ProjectForm';
import { getActiveReforecast } from '@/lib/utils/teamResolution';
import { Skeleton } from '@/components/Skeleton';

export default function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { project, loading, updateProject, flush } = useProject(id);

  useEffect(() => () => { flush(); }, [flush]);

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
            // Per-reforecast windows (v0.29.0): editing the project no longer
            // cascades to existing reforecasts. Project dates seed new
            // reforecasts only. Each reforecast carries its own window.
            updateProject((prev) => {
              const activeId = prev.activeReforecastId ?? prev.reforecasts[0]?.id;
              return {
                ...prev,
                ...projectFields,
                reforecasts: prev.reforecasts.map((rf) =>
                  rf.id === activeId ? { ...rf, baselineBudget } : rf,
                ),
              };
            });
            flush();
          }}
        />
      </div>
    </div>
  );
}
