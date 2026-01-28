'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProject } from '@/features/projects/hooks/useProject';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { ProjectSummary } from '@/features/projects/components/ProjectSummary';
import { DeleteProjectDialog } from '@/features/projects/components/DeleteProjectDialog';

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { project, loading } = useProject(id);
  const { deleteProject } = useProjects();
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);

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
        <ProjectSummary project={project} />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Team Members</h2>
        {project.teamMembers.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            No team members yet. Team management will be available in Sprint 3.
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {project.teamMembers.length} member(s) assigned.
          </p>
        )}
      </div>

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
