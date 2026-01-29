import { APP_VERSION } from '@/lib/constants';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">
        About MyScrumBudget<sup className="text-[8px] font-normal text-zinc-400 dark:text-zinc-500">TM</sup>
      </h1>
      <p className="mt-1 italic text-zinc-500 dark:text-zinc-400">
        Scrum project budget forecasting tool
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {/* What is MyScrumBudget? */}
        <section>
          <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            What is MyScrumBudget?
          </h2>
          <p className="mt-2">
            MyScrumBudget<sup className="text-[7px] text-zinc-400 dark:text-zinc-500">TM</sup> is
            a web-based budget forecasting tool for Scrum projects. It replaces the original
            GPL-licensed Excel spreadsheet with a modern, interactive web application. Project
            managers can track team allocations, calculate costs, create reforecasts, and visualize
            budget performance — all in the browser.
          </p>
        </section>

        {/* How It Works */}
        <section>
          <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            How It Works
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Configure labor rates and working hours in Settings</li>
            <li>Create a project with start/end dates and a baseline budget</li>
            <li>Assign team members from the global team pool</li>
            <li>Enter monthly allocation percentages in the allocation grid</li>
            <li>View calculated costs, ETC, EAC, variance, burn rate, and NPV</li>
            <li>Create reforecasts to track budget changes over time</li>
            <li>Apply productivity windows to adjust hours and cost calculations</li>
          </ul>
        </section>

        {/* Your Data & Privacy */}
        <section>
          <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            Your Data &amp; Privacy
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>All data is stored locally in your browser (localStorage)</li>
            <li><strong>Your data never leaves your device</strong> — there are no external databases or APIs</li>
            <li>No third-party analytics or tracking</li>
            <li>Safe for corporate and sensitive project data</li>
            <li>Use Settings &rarr; Export to back up your data as a JSON file</li>
            <li>Use Settings &rarr; Import to restore data from a backup</li>
            <li>
              <strong>Important:</strong> Clearing your browser cache or site data will permanently
              delete all stored projects and settings. Export your data regularly.
            </li>
          </ul>
        </section>

        {/* Author & Source Code */}
        <section>
          <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            Author &amp; Source Code
          </h2>
          <p className="mt-2">
            Created by <strong>William W. Davis, MSPM, PMP</strong>
          </p>
          <div className="mt-3">
            <a
              href="https://github.com/famousdavis/myscrumbudget-web"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              View on GitHub
            </a>
          </div>
        </section>

        {/* Version */}
        <section>
          <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            Version
          </h2>
          <p className="mt-2">v{APP_VERSION}</p>
        </section>

        {/* License */}
        <section>
          <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            License
          </h2>
          <p className="mt-2">
            MyScrumBudget<sup className="text-[7px] text-zinc-400 dark:text-zinc-500">TM</sup> is
            free software released under the{' '}
            <strong>GNU General Public License v3.0</strong>. You may redistribute and/or modify it
            under the terms of the GPL as published by the Free Software Foundation.
          </p>
        </section>

        {/* Disclaimer */}
        <section>
          <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            Disclaimer
          </h2>
          <p className="mt-2 uppercase text-zinc-500 dark:text-zinc-500" style={{ fontSize: '0.7rem', lineHeight: 1.6 }}>
            This program is distributed in the hope that it will be useful, but WITHOUT ANY
            WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
            PARTICULAR PURPOSE. See the GNU General Public License for more details.
          </p>
        </section>
      </div>
    </div>
  );
}
