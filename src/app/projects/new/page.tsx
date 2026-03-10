// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useProjects } from '@/features/projects/hooks/useProjects';
import { ProjectForm } from '@/features/projects/components/ProjectForm';

export default function NewProjectPage() {
  const { createProject } = useProjects();

  return (
    <div>
      <h1 className="text-2xl font-bold">New Project</h1>
      <div className="mt-6">
        <ProjectForm
          submitLabel="Create Project"
          autoFocusName
          onSubmit={async (data) => {
            await createProject(data);
          }}
        />
      </div>
    </div>
  );
}
