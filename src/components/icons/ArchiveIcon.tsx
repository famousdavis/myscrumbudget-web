// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

interface ArchiveIconProps {
  className?: string;
}

/**
 * Heroicons mini "archive-box" — used for BOTH the per-tile archive and
 * unarchive actions (distinguished by tooltip text, hover color, and
 * visibility behavior in ProjectCard, not by a different glyph).
 */
export function ArchiveIcon({ className = 'h-4 w-4' }: ArchiveIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 3a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2Z" />
      <path
        fillRule="evenodd"
        d="M2 7.5h16l-.811 7.71a2 2 0 0 1-1.99 1.79H4.802a2 2 0 0 1-1.99-1.79L2 7.5Zm5.75 3a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
