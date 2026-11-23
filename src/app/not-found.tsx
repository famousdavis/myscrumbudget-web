// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import Link from 'next/link';
import { HeadingRow } from '@/components/HeadingRow';

/**
 * Any address no route matches (FRAME26, v0.45.0). Until then Next's own `/_not-found` showed an `h1` "404" in a box
 * as tall as the window, inside the old layout; inside the frame's `main` it would have pushed the footer a window down
 * and had no heading row. Contract §7 keeps a view's error inside `main` with the frame intact. No navigation item leads
 * here, so none is active (`activeNavHref`).
 */
export default function NotFound() {
  return (
    <>
      <HeadingRow>Page not found</HeadingRow>
      <div className="sf-below">
        <p className="text-zinc-600 dark:text-zinc-300">There&apos;s no page at this address.</p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Back to Projects
        </Link>
      </div>
    </>
  );
}
