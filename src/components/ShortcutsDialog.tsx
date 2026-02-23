'use client';

import { BaseDialog, dialogButtonStyles } from './BaseDialog';

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Allocation Grid',
    shortcuts: [
      { keys: ['Arrow keys'], description: 'Navigate between cells' },
      { keys: ['Enter'], description: 'Edit selected cell / save and move down' },
      { keys: ['Escape'], description: 'Cancel editing' },
      { keys: ['Tab'], description: 'Move to next cell' },
      { keys: ['Shift', 'Tab'], description: 'Move to previous cell' },
      { keys: ['Delete'], description: 'Clear selected cells' },
      { keys: ['0', '–', '9'], description: 'Start editing with digit' },
      { keys: ['Double-click'], description: 'Edit cell' },
      { keys: ['Click + drag'], description: 'Select range' },
      { keys: ['Shift', 'Click'], description: 'Extend selection' },
      { keys: ['Drag fill handle'], description: 'Fill cells with value' },
    ],
  },
  {
    title: 'Global',
    shortcuts: [
      { keys: ['Ctrl', '?'], description: 'Show keyboard shortcuts' },
    ],
  },
];

function KeyBadge({ k }: { k: string }) {
  return (
    <kbd className="inline-block min-w-[1.5rem] rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-center text-xs font-mono font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      {k}
    </kbd>
  );
}

interface ShortcutsDialogProps {
  onClose: () => void;
}

export function ShortcutsDialog({ onClose }: ShortcutsDialogProps) {
  return (
    <BaseDialog
      title="Keyboard Shortcuts"
      actions={
        <button onClick={onClose} className={dialogButtonStyles.primary}>
          Close
        </button>
      }
    >
      <div className="mt-3 max-h-[60vh] space-y-4 overflow-y-auto">
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.title}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {group.title}
            </h4>
            <div className="mt-1 space-y-1.5">
              {group.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.description}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {shortcut.description}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {shortcut.keys.map((k, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-xs text-zinc-400">+</span>}
                        <KeyBadge k={k} />
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </BaseDialog>
  );
}
