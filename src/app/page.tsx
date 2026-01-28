'use client';

import Link from 'next/link';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { ProjectCard } from '@/features/projects/components/ProjectCard';

export default function DashboardPage() {
  const { projects, loading } = useProjects();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/projects/new"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New Project
        </Link>
      </div>

      {loading ? (
        <p className="mt-6 text-zinc-500">Loading projects...</p>
      ) : projects.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            No projects yet. Create your first project to get started.
          </p>
          <Link
            href="/projects/new"
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create Project
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
