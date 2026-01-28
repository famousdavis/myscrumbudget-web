'use client';

interface DeleteProjectDialogProps {
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteProjectDialog({
  projectName,
  onConfirm,
  onCancel,
}: DeleteProjectDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">Delete Project</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Are you sure you want to delete <strong>{projectName}</strong>? This
          action cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
