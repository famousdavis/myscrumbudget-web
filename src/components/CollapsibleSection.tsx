'use client';

import { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  children: React.ReactNode;
}

export function CollapsibleSection({ title, count, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
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
