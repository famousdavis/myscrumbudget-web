'use client';

import { BaseDialog, dialogButtonStyles } from '@/components/BaseDialog';

interface DeleteAssignmentDialogProps {
  memberName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteAssignmentDialog({
  memberName,
  onConfirm,
  onCancel,
}: DeleteAssignmentDialogProps) {
  return (
    <BaseDialog
      title="Remove Team Member"
      actions={
        <>
          <button onClick={onCancel} className={dialogButtonStyles.cancel}>
            Cancel
          </button>
          <button onClick={onConfirm} className={dialogButtonStyles.danger}>
            Remove
          </button>
        </>
      }
    >
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Are you sure you want to remove <strong>{memberName}</strong>? All
        allocations for this member across every reforecast will be lost.
      </p>
    </BaseDialog>
  );
}
