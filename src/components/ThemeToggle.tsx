// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useTheme } from '@/hooks/useTheme';
import type { ThemeMode } from '@/types/domain';

const LABEL: Record<ThemeMode, string> = { system: 'System', light: 'Light', dark: 'Dark' };

/** The frame's cycle (contract §2): System → Light → Dark → System. */
const NEXT_THEME: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };

const ICON: Record<ThemeMode, React.ReactNode> = {
  light: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.06 1.06l1.06 1.06z" />
    </svg>
  ),
  dark: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
    </svg>
  ),
  system: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v8.5A2.25 2.25 0 0115.75 15h-3.105a3.501 3.501 0 001.1 1.677A.75.75 0 0113.26 18H6.74a.75.75 0 01-.484-1.323A3.501 3.501 0 007.355 15H4.25A2.25 2.25 0 012 12.75v-8.5zm1.5 0a.75.75 0 01.75-.75h11.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75v-7.5z" clipRule="evenodd" />
    </svg>
  ),
};

/**
 * The frame's 32 × 32 theme button (`.sf-theme`, FRAME26 contract §2 and §3, v0.45.0). It replaced the three-way
 * Light / Dark / System switch: one button that cycles System → Light → Dark. The stored setting (`msb:theme`) and its
 * three values are unchanged, so nobody's choice is lost.
 *
 * The icon shows the CURRENT theme and draws in `currentColor`, the frame's muted text colour (4.84 : 1 on white,
 * 6.82 on #101828), at full opacity; it takes the text colour on hover. It carries state, so it is held to the 3 : 1
 * non-text bar: never give it a fixed fill or an opacity.
 *
 * `useTheme` reports `system` until it has mounted, so the server and the first client render agree; the stored
 * theme shows a tick later (the `<head>` script has already painted the right colours).
 */
export function ThemeToggle() {
  const { mode, setTheme } = useTheme();
  const next = NEXT_THEME[mode];
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="sf-theme"
      data-sf="theme"
      aria-label={`Theme: ${LABEL[mode]}. Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[mode]}`}
    >
      {ICON[mode]}
    </button>
  );
}
