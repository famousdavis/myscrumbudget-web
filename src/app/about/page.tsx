// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import Link from 'next/link';
import { APP_VERSION } from '@/lib/constants';
import { HeadingRow } from '@/components/HeadingRow';
import { CopyrightYear } from '@/components/CopyrightYear';

/**
 * MyScrumBudget's guides, a copy of its entry in the Help Center's list (spert-landing-page `src/data/help.ts`, hub
 * v2.15.2): titles and descriptions verbatim, typographic apostrophes included, in that order. The PDFs are served from
 * this app's own origin (`public/`).
 */
const GUIDES = [
  {
    file: 'MyScrumBudget_Quick_Reference_Guide.pdf',
    title: 'Quick Reference Guide',
    description:
      'What MyScrumBudget is and how it forecasts a project’s labor costs, burn rate and variance from your team’s allocations.',
  },
  {
    file: 'MyScrumBudget_Charter_Budget_Guide.pdf',
    title: 'Charter Budget Reference Guide',
    description:
      'How the Charter Budget adds a risk-based contingency to your estimate, giving a budget you can put in a project charter.',
  },
] as const;

/** The repository the About page links to (help.ts `repo`). Not `famousdavis/MyScrumBudget`, a different, stale repo. */
const REPO = 'https://github.com/famousdavis/myscrumbudget-web';

const TM = <span className="sf-mark sf-mark--tm">™</span>;
const REG = <span className="sf-mark">®</span>;

/** "↗" for a link that opens a new tab, and what a screen reader hears in its place (contract §7 About). */
function NewTab({ label = '' }: { label?: string }) {
  return (
    <>
      <span aria-hidden="true"> ↗</span>
      <span className="sf-sr">{label} (opens in a new tab)</span>
    </>
  );
}

/**
 * The About page (FRAME26 pass 3, contract §3 About page and §7 About, stylesheet v4, v0.47.0). The frame's `.sf-about`
 * styles all of it: no utility class, no `dark:` and no colour of its own. ⚠️ The heading row and `.sf-about` are both
 * DIRECT children of `main`, with nothing between: the contract places the page 16 px below the row (`.sf-about`'s own
 * margin), so there is no `.sf-below` wrapper here and no tagline line under the title.
 *
 * The words are William's (FRAME26-ABOUT-WORDS.md, 2026-11-27, and §7's shared words): change none without him.
 */
export default function AboutPage() {
  return (
    <>
      <HeadingRow>
        About MyScrumBudget<span className="sf-mark sf-mark--tm">™</span>
      </HeadingRow>
      <div className="sf-about" data-sf="about">
        <section>
          <h2>What is MyScrumBudget{TM}?</h2>
          <p>
            MyScrumBudget{TM} is a web-based budget forecasting tool for any project type. It replaces the original
            GPL-licensed Excel spreadsheet with a modern, interactive web application. Project managers can track team
            allocations, calculate costs, create reforecasts, and visualize budget performance — all in the browser.
          </p>
        </section>

        <section>
          <h2>How it works</h2>
          <ol>
            <li>Configure labor rates and working hours in Settings</li>
            <li>Create a project with start/end dates and a baseline budget</li>
            <li>Assign team members from the global team pool</li>
            <li>Enter monthly allocation percentages in the allocation grid</li>
            <li>View calculated costs, ETC, EAC, variance, burn rate, and NPV</li>
            <li>Create reforecasts to track budget changes over time</li>
            <li>Apply productivity windows to adjust hours and cost calculations</li>
          </ol>
        </section>

        <section>
          <h2>Guides</h2>
          <ul className="sf-guides" data-sf="guides">
            {GUIDES.map((g) => (
              <li className="sf-guide" key={g.file}>
                <div className="sf-guide-body">
                  <h3 className="sf-guide-title">{g.title}</h3>
                  <p className="sf-guide-text">{g.description}</p>
                </div>
                <a className="sf-guide-open" href={`/${g.file}`} target="_blank" rel="noopener noreferrer">
                  Open PDF<NewTab label={`: ${g.title}`} />
                </a>
              </li>
            ))}
          </ul>
          <p>
            <a href="https://spertsuite.com/help/myscrumbudget" target="_blank" rel="noopener noreferrer">
              More help in the Help Center<NewTab />
            </a>
          </p>
        </section>

        <section>
          <h2>Your data and storage</h2>
          <p>
            Unless you sign in and choose cloud storage, MyScrumBudget{TM} keeps your projects in this browser, on this
            device, and sends them to no server. Clearing this site&apos;s data deletes them, so export a backup from time
            to time.
          </p>
          <p>
            If you sign in, with Google or with a Microsoft work or school account, and choose cloud storage, your
            projects are saved to your account in Google Firebase, over encrypted (HTTPS) connections. You can then open
            them on any device and share them with other people.
          </p>
        </section>

        <section className="sf-about-legal" data-sf="about-legal">
          <h2>Version and license</h2>
          <p>
            Version {APP_VERSION} · <Link href="/changelog">What&rsquo;s new</Link>
          </p>
          <p>
            Created by William W. Davis, MSPM, PMP ·{' '}
            <a href={REPO} target="_blank" rel="noopener noreferrer">Source code on GitHub<NewTab /></a>
          </p>
          <p>
            &copy; <CopyrightYear /> William W. Davis, MSPM, PMP. MyScrumBudget{TM} is free software: you may use, change
            and share it under the GNU General Public License, version 3, with the additional terms its{' '}
            <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">LICENSE<NewTab /></a> adds
            under Section 7 of that license: attribution and legal notices, trademarks, the marking of modified versions,
            endorsement, and indemnification.
          </p>
          <p>
            SPERT{REG}, Statistical PERT{REG} and Estimation Made Easy{REG} are registered trademarks of famousdavis, LLC.
            GanttApp{TM} and MyScrumBudget{TM} are trademarks of famousdavis, LLC.
          </p>
          <p>
            THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW. EXCEPT WHEN OTHERWISE STATED
            IN WRITING THE COPYRIGHT HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM &quot;AS IS&quot; WITHOUT WARRANTY
            OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
            MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE
            PROGRAM IS WITH YOU. SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL NECESSARY SERVICING,
            REPAIR OR CORRECTION.
          </p>
        </section>
      </div>
    </>
  );
}
