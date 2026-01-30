'use client';

import { BaseDialog, dialogButtonStyles } from '@/components/BaseDialog';

interface DeleteReforecastDialogProps {
  reforecastName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteReforecastDialog({
  reforecastName,
  onConfirm,
  onCancel,
}: DeleteReforecastDialogProps) {
  return (
    <BaseDialog
      title="Delete Reforecast"
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
        Are you sure you want to delete <strong>{reforecastName}</strong>? All
        allocations and productivity windows in this reforecast will be lost.
      </p>
    </BaseDialog>
  );
}
