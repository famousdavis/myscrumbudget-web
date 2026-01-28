'use client';

import { use } from 'react';
import Link from 'next/link';
import { useProject } from '@/features/projects/hooks/useProject';
import { ProjectForm } from '@/features/projects/components/ProjectForm';

export default function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { project, loading, updateProject } = useProject(id);

  if (loading) {
    return <p className="text-zinc-500">Loading project...</p>;
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

  return (
    <div>
      <h1 className="text-2xl font-bold">Edit Project</h1>
      <div className="mt-6">
        <ProjectForm
          initialData={{
            name: project.name,
            startDate: project.startDate,
            endDate: project.endDate,
            baselineBudget: project.baselineBudget,
            actualCost: project.actualCost,
          }}
          submitLabel="Save Changes"
          onSubmit={async (data) => {
            updateProject((prev) => ({
              ...prev,
              ...data,
            }));
          }}
        />
      </div>
    </div>
  );
}
