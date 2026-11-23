// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import Link from 'next/link';
import { APP_VERSION } from '@/lib/constants';
import { formatDateLong } from '@/lib/utils/format';
import { CHANGELOG } from './changelogData';
import { HeadingRow } from '@/components/HeadingRow';

export default function ChangelogPage() {
  // FRAME26 (v0.45.0): the changelog's body is capped (exception X4), so the heading row and the body are DIRECT
  // children of `main`; the body keeps its 672 px measure on an inner element, without `mx-auto` (it would centre the
  // body off the column's edge under the 896 px cap). No navigation item leads here, so none is active. The back link
  // follows the `h1` now, as the body's first line ("Dashboard" became "Projects").
  return (
    <>
      <HeadingRow>Changelog</HeadingRow>
      <div className="sf-below">
        <div className="max-w-2xl">
          <div className="mb-8">
            <Link
              href="/"
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              &larr; Back to Projects
            </Link>
          </div>

          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Current version: {APP_VERSION}
          </p>

          <div className="mt-8 space-y-10">
            {CHANGELOG.map((entry, i) => (
              <div
                key={entry.version}
                className={`pb-8 ${
                  i < CHANGELOG.length - 1
                    ? 'border-b border-zinc-200 dark:border-zinc-800'
                    : ''
                }`}
              >
                <div className="flex items-baseline gap-3">
                  <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    v{entry.version}
                  </h2>
                  <span className="text-sm text-zinc-400 dark:text-zinc-500">
                    {formatDateLong(entry.date)}
                  </span>
                </div>

                <div className="mt-4 space-y-4">
                  {entry.sections.map((section) => (
                    <div key={section.title}>
                      <h3 className="font-medium">{section.title}</h3>
                      <ul className="mt-1 list-disc space-y-1 pl-6 text-sm text-zinc-600 dark:text-zinc-400">
                        {section.items.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
