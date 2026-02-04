'use client';

import { useEffect, useRef, useId } from 'react';

interface BaseDialogProps {
  /** Dialog title displayed in the header */
  title: string;
  /** Dialog body content */
  children: React.ReactNode;
  /** Footer action buttons */
  actions: React.ReactNode;
}

/**
 * Shared modal dialog shell with overlay, centering, ARIA attributes,
 * and focus-trap on mount. All confirmation/form dialogs compose this.
 */
export function BaseDialog({ title, children, actions }: BaseDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus the dialog container on mount for keyboard accessibility
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-lg outline-none dark:bg-zinc-900"
      >
        <h3 id={titleId} className="text-lg font-semibold">
          {title}
        </h3>
        {children}
        <div className="mt-4 flex justify-end gap-3">{actions}</div>
      </div>
    </div>
  );
}

/* ── Shared button styles ───────────────────────────────────────────── */

export const dialogButtonStyles = {
  cancel:
    'rounded border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800',
  danger:
    'rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700',
  primary:
    'rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed',
} as const;

/* ── Reusable confirmation dialog ───────────────────────────────────── */

interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <BaseDialog
      title={title}
      actions={
        <>
          <button onClick={onCancel} className={dialogButtonStyles.cancel}>
            Cancel
          </button>
          <button onClick={onConfirm} className={dialogButtonStyles.danger}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {message}
      </p>
    </BaseDialog>
  );
}

/* ── Reusable alert/info dialog ────────────────────────────────────── */

interface AlertDialogProps {
  /** Dialog title */
  title: string;
  /** Message content (supports JSX for formatting) */
  message: React.ReactNode;
  /** Button label (default: "OK") */
  buttonLabel?: string;
  /** Called when user dismisses the dialog */
  onClose: () => void;
}

export function AlertDialog({
  title,
  message,
  buttonLabel = 'OK',
  onClose,
}: AlertDialogProps) {
  return (
    <BaseDialog
      title={title}
      actions={
        <button onClick={onClose} className={dialogButtonStyles.primary}>
          {buttonLabel}
        </button>
      }
    >
      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
        {message}
      </p>
    </BaseDialog>
  );
}
