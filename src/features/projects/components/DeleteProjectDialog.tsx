'use client';

import { BaseDialog, dialogButtonStyles } from '@/components/BaseDialog';

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
    <BaseDialog
      title="Delete Project"
      actions={
        <>
          <button onClick={onCancel} className={dialogButtonStyles.cancel}>
            Cancel
          </button>
          <button onClick={onConfirm} className={dialogButtonStyles.danger}>
            Delete
          </button>
        </>
      }
    >
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Are you sure you want to delete <strong>{projectName}</strong>? This
        action cannot be undone.
      </p>
    </BaseDialog>
  );
}
