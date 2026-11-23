// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useProjects } from '@/features/projects/hooks/useProjects';
import { ProjectForm } from '@/features/projects/components/ProjectForm';
import { HeadingRow } from '@/components/HeadingRow';

export default function NewProjectPage() {
  const { createProject } = useProjects();

  return (
    <>
      {/* FRAME26 (v0.45.0): the frame's heading row, no toolbar. The form's own Submit and Cancel are its exits. */}
      <HeadingRow>New Project</HeadingRow>
      <div className="sf-below">
        <ProjectForm
          submitLabel="Create Project"
          exitHref="/"
          autoFocusName
          onSubmit={async (data) => {
            await createProject(data);
          }}
        />
      </div>
    </>
  );
}
