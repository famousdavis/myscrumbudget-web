// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * The year in the © line (FRAME26 Y1, v0.47.0): the visitor's current year. The footer and the About page's Version and
 * license block both render this, so their two © lines can never differ.
 *
 * ⚠️ The page is prerendered at build time, so the HTML carries the BUILD's year. Rendering `new Date().getFullYear()`
 * plainly makes a visitor's browser render a different year after 1 January, and React reports a hydration text
 * mismatch (#418) and re-renders the whole page on the client: the footer did exactly this until v0.47.0.
 * `suppressHydrationWarning` alone silences that but is not enough: React then KEEPS the server's text, so the old
 * year would stay on screen. So the span hydrates under one key, quietly (its own text only, one level deep), and is
 * replaced under another on the render right after hydration, which shows the visitor's year. `hydrated` is false on
 * the server and while hydrating, and true from then on and on every client-side navigation.
 * `CopyrightYear.hydration.test.tsx` holds all three behaviours.
 */
export function CopyrightYear() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <span key={hydrated ? 'client' : 'server'} suppressHydrationWarning>
      {new Date().getFullYear()}
    </span>
  );
}
