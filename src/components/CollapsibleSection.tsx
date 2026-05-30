// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  children: React.ReactNode;
  onOpen?: () => void;
  /**
   * Controlled open state. When provided (not undefined), the parent owns
   * open/close and must pass `onOpenChange`. When omitted, the section manages
   * its own state internally (default — backward compatible).
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CollapsibleSection({
  title,
  count,
  children,
  onOpen,
  open,
  onOpenChange,
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;

  const toggle = () => {
    const next = !isOpen;
    if (controlled) {
      onOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
    if (next && onOpen) onOpen();
  };

  return (
    <div>
      <button
        onClick={toggle}
        className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        <span
          className="inline-block transition-transform"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          &#9654;
        </span>
        {title}
        {count != null && count > 0 && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {count}
          </span>
        )}
      </button>
      {isOpen && <div className="mt-3">{children}</div>}
    </div>
  );
}
