// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import Link from 'next/link';
import { RATES_DEEP_LINK } from '@/lib/constants';

/**
 * The Welcome panel (FRAME26 clean-up, v0.46.0; contract §3 "Welcome panel", §7 "Empty collection"): what stands in the
 * tile grid's place while there are no projects at all. The frame's stylesheet draws it (`.sf-empty`, v3): a dashed card
 * the column wide, on the page ground in both themes. The title is "Welcome to " and the brand row's title exactly, its
 * ™ in the same `.sf-mark--tm` markup. MyScrumBudget's three Getting Started steps are its body (`.sf-empty-body`),
 * unchanged but for step 3's own "Create Project" button, which the actions row's Create New Project replaces. Create
 * New Project goes where the toolbar's New Project goes, in its look (no sample: MyScrumBudget has none, Nov 8). Not
 * shown when every project is archived: the page shows the one-line archived message instead.
 */
export function WelcomePanel({ ratesReviewed, poolCount }: { ratesReviewed: boolean; poolCount: number }) {
  return (
    <div className="sf-empty" data-sf="empty">
      <h2 className="sf-empty-title">
        Welcome to MyScrumBudget<span className="sf-mark sf-mark--tm">™</span>
      </h2>
      <p className="sf-empty-text">
        Forecast what your project will cost from your team&apos;s roles, rates and allocations, and see how the spending
        tracks against the budget.
      </p>
      <p className="sf-empty-text">Follow these steps to set up your first project.</p>
      <div className="sf-empty-body">
        <ol className="space-y-5">
          <li className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ratesReviewed ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
              {ratesReviewed ? '\u2713' : '1'}
            </span>
            <div>
              <Link href={RATES_DEEP_LINK} className="text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                Review Labor Rates
              </Link>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Customize roles and hourly rates in Settings. Default rates are provided.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${poolCount > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
              {poolCount > 0 ? '\u2713' : '2'}
            </span>
            <div>
              <Link href="/team" className="text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                Build Your Team Pool
              </Link>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Add team members and assign their roles. You&apos;ll pick from this pool when staffing projects.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              3
            </span>
            <div>
              <Link href="/projects/new" className="text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                Create Your First Project
              </Link>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Set up a project with start/end dates, then assign team members from your pool.
              </p>
            </div>
          </li>
        </ol>
      </div>
      <div className="sf-empty-actions">
        <Link href="/projects/new" className="sf-btn rounded bg-blue-600 px-4 text-white hover:bg-blue-700">
          Create New Project
        </Link>
      </div>
    </div>
  );
}
