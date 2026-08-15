// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

export interface ChangelogEntry {
  version: string;
  date: string;
  sections: {
    title: string;
    items: string[];
  }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.36.6',
    date: '2026-08-14',
    sections: [
      {
        title: 'Changed',
        items: [
          'Tests only. Nothing in the app itself changed — it behaves identically to v0.36.5.',
          'The step that merges an imported file into your existing data is now fully covered by tests. This is the code that decides, project by project, whether an import adds something new, replaces something you already have, or leaves it alone — and being wrong there means silently losing or overwriting work. It was the most intricate single function in the project and the least completely tested of the ones that matter.',
          'The largest gap was that every existing test ran against local browser storage. The cloud path was untested end to end, including the step that assigns a fresh identifier to each imported project before saving — a step that exists because an imported project may carry an identifier already belonging to someone else’s project in the cloud. Both modes are now tested, and tested against each other, so the difference between them is pinned rather than assumed.',
          'Also newly covered: what happens when the project an import means to replace has been deleted or renamed by someone else in the meantime, when a different project has since taken the name, when saving the team pool or settings fails, and when a failure arrives in an unexpected form. Several of these paths end in a deliberate decision to add rather than replace — protecting an unrelated project from being overwritten — and none had been exercised.',
          'A decision was also recorded not to split this function into smaller pieces. The tests are now strong enough that restructuring it would be safe, which was the open question; the reason for leaving it alone is that every way of splitting it produces a new piece nearly as complicated as the original. That reasoning, and the measurements behind it, now sit alongside the code.',
        ],
      },
    ],
  },
  {
    version: '0.36.5',
    date: '2026-08-14',
    sections: [
      {
        title: 'Changed',
        items: [
          'Tests only. Nothing in the app itself changed — it behaves identically to v0.36.4.',
          'The part of the app that receives changes from the cloud now has tests. It had none at all. When Cloud Storage is switched on, the app listens for changes made elsewhere — another tab, another machine, or someone the project is shared with — and reloads the affected data. That layer had never been exercised by a single test, despite being where several past defects have lived.',
          'Four behaviours are now pinned. Changes the app itself just made are recognised as its own and ignored, rather than treated as news from elsewhere and reloaded in a loop. A change to settings reloads both settings and the team pool, because the two are stored together. When access to a project is withdrawn — a share revoked, or a sign-out elsewhere — the affected data is dropped from view deliberately and without an error message, since the person concerned generally caused it. And a genuine connection failure produces exactly one warning rather than two, even though there are two listeners that can fail at once.',
          'Two of the checks pinned here come from an earlier security review: when a listener fails, the message written to the browser’s developer console contains only an error code, never the underlying details, which can carry project identifiers. That was previously guaranteed by nothing but the code itself.',
          'Also recorded, without changing behaviour: the listening layer is set up when the signed-in user changes, and reads the storage mode at that moment. Switching between local and cloud storage without signing in or out therefore relies on the app reloading the page to reattach the listeners — which it does today. The code now says so, and says what would need to change if that reload ever went away.',
        ],
      },
    ],
  },
  {
    version: '0.36.4',
    date: '2026-08-14',
    sections: [
      {
        title: 'Changed',
        items: [
          'Tests only. Nothing in the app itself changed — it behaves identically to v0.36.3.',
          'Two safety checks that had never been tried are now tried. An audit several releases ago added a set of defensive checks across the app; a review of all seventeen found that eleven had never actually run. Two of those were worth fixing immediately, for opposite reasons.',
          'The first limits how long a name or role may be in an imported spreadsheet, so a deliberately malformed file is rejected cleanly at import rather than failing later with an unhelpful message. It is consulted on every row of every import — twenty times over in the tests alone — and had never once rejected anything, because no test supplied an over-long value. Being consulted constantly is what made it invisible: by the usual measure the code looked thoroughly tested.',
          'The second keeps the contents of a failed save out of the browser console, so a project’s team details cannot end up in a log. The line carrying that guarantee had never executed, because no test had ever made a save fail — in a file where the usual measure reported most of the code as exercised.',
          'Both are now covered, including the exact boundary cases, so a future change that weakens either would be caught. Neither check was altered; only tested. Nine of the eleven remain unexercised and are recorded for later — most sit in two parts of the app with no tests at all, which is a larger piece of work than this one.',
        ],
      },
    ],
  },
  {
    version: '0.36.3',
    date: '2026-08-14',
    sections: [
      {
        title: 'Changed',
        items: [
          'Internal record-keeping only. Nothing in the app itself changed — it behaves identically to v0.36.2.',
          'A decision NOT to restructure the spreadsheet import, and the measurement behind it. The function that reads an uploaded resource-plan spreadsheet is the most intricate single piece of code in the project by some distance, and an obvious candidate for being broken into smaller parts. This release deliberately does not do that — because the tests around it turned out not to be strong enough to make the move safely.',
          'The distinction matters: a test can run a line of code without checking that the line is right. Measuring the second thing rather than the first showed that around a third of deliberate changes to this function go unnoticed by the tests, despite nearly ninety per cent of its branches being exercised. Restructuring code whose tests do not pin down its behaviour is how a rewrite quietly changes what the software does, so the order has been reversed: strengthen the tests first, then revisit the structure.',
          'The standard the decision was measured against was written down before the measurement was taken, rather than chosen afterwards to fit it. That reasoning now sits alongside the code, with the specific gaps to close and the shape the restructuring should take once it is safe — including that the obvious split would create a new piece almost as intricate as the problem it solves.',
          'One gap found along the way is worth naming: the limits on how long a name or role may be in an imported spreadsheet, added as a security measure, have never been exercised by any test.',
        ],
      },
    ],
  },
  {
    version: '0.36.2',
    date: '2026-08-14',
    sections: [
      {
        title: 'Fixed',
        items: [
          'The first-visit notice about the Terms of Service was causing an error on every page load, for every visitor who had not yet dismissed it. Nothing looked wrong on screen — the browser recovered silently by discarding the page it received from the server and rebuilding it — but it was a genuine error on every load, and that rebuild is wasted work on the very first impression of the app.',
          'The cause: the notice decided whether to show itself by reading this browser’s stored settings while the page was still being assembled. The server has no access to those settings and concluded the notice should be hidden; the browser read them and concluded it should be shown. The two disagreeing about what the page contains is exactly the condition browsers report as an error. The notice now starts hidden everywhere and decides whether to appear immediately afterwards, once the page has settled — which is how its sibling notice, the one about data living only in this browser, has worked since v0.21.6.',
          'That sibling is why this is worth explaining. It had the identical bug, fixed fifteen releases ago. This one was missed because the comment above the faulty code asserted it was safe, so every later reader — including whoever fixed the sibling — had been told there was nothing to look at. The comment now records why the pattern is unsafe instead of claiming it is fine.',
          'Every other place in the app that reads stored settings this way was then checked rather than assumed. All of them sit inside a part of the app that does not render until the page has settled, so none can produce this error. One — the Dashboard’s check for whether labor rates have been reviewed — is safe because of where it sits rather than how it is written, and now says so, along with what would make it unsafe again.',
        ],
      },
    ],
  },
  {
    version: '0.36.1',
    date: '2026-08-14',
    sections: [
      {
        title: 'Changed',
        items: [
          'Tests only. Nothing in the app itself changed — it behaves identically to v0.36.0.',
          'The Dashboard now has tests. It did not have any — and it was the largest untested surface in the project as well as the most frequently changed, edited seventeen times while nothing checked that any of those edits left it working. The whole page-level layer of the app, the screens themselves as opposed to the pieces they are assembled from, had no tests at all.',
          'The most valuable of the new tests protects against silent data loss. Archived projects are hidden from the Dashboard, and dragging a card to reorder it rewrites the saved list of projects. If the reordering were ever wired to the visible cards rather than to every project, dragging one card would permanently delete every hidden archived project — no error, nothing on screen, the projects simply gone at the next save. That risk was previously guarded only by a written warning in the code; it is now guarded by a test, confirmed to fail when the mistake is deliberately introduced.',
          'The remaining tests pin the behaviours a future change is most likely to break by accident: archived projects stay hidden until asked for, archiving your last project shows an “all projects are archived” message rather than resurrecting the first-run setup guide, and deleting a project asks first and does nothing if you decline.',
        ],
      },
    ],
  },
  {
    version: '0.36.0',
    date: '2026-08-14',
    sections: [
      {
        title: 'Added',
        items: [
          'Testing tools only. Nothing in the app itself changed — it behaves identically to v0.35.2.',
          'The project can now check whether its tests would actually notice a mistake. Test coverage answers a narrower question than it appears to: it reports which lines ran, not whether anything checked the result. A test that calls a function and inspects nothing counts exactly the same as one that verifies every number it returns.',
          'Mutation testing asks the harder question directly — it makes small deliberate changes to the code, one at a time, and re-runs the tests. Any change the tests fail to complain about is a change that could be made by accident and shipped unnoticed.',
          'That distinction mattered immediately: the file computing project metrics has every line and branch covered, and still failed to notice when the sort was removed from the list of active months. The tests checked which months came back, never in what order.',
          'The calculation engine now has a recorded baseline of 88.8%. Two files with complete line coverage were found to be leaking, and one — the statistical helpers behind the Charter Budget — had no tests of its own at all, so both of its extreme-value branches had never once run. It has proper tests now, which is what moved the engine’s figure up from 73.6%.',
          'The same tooling was pointed once at the import checks tightened in the previous release, to confirm that work was real rather than merely present. All two hundred deliberate changes to that area were caught, after one gap was found and closed: a check on month formats could be loosened to accept text in front of the date, and nothing objected.',
          'This is deliberately a recorded measurement rather than a release requirement — it takes minutes to run and is not part of the release checks. The runner refuses to report a result when a run fails to start, because a run that never starts finds no problems and looks exactly like a run where nothing is wrong.',
        ],
      },
    ],
  },
  {
    version: '0.35.2',
    date: '2026-08-14',
    sections: [
      {
        title: 'Changed',
        items: [
          'Internal safeguards only. Nothing in the app itself changed — it behaves identically to v0.35.1.',
          'Two protections around importing a project file, both covering the same weakness: checks that existed but had never been shown to work.',
          'When a file is imported, every field of every reforecast is checked — dates are real dates, costs are not negative, an end date is not before its start date. Those checks were written, but almost none had ever been observed rejecting anything: of the twenty-three ways a reforecast can be refused, twenty had never once been triggered in testing. Four further checks — covering staffing assignments, monthly allocations, productivity windows and recorded historical costs — had never run at all, because every test file happened to leave those lists empty.',
          'A check that has never rejected anything is indistinguishable from one that cannot. Sixty-three tests now drive each one, starting from the rejection rather than the acceptance, so a check that stopped working would be noticed.',
          'The second protection covers a mistake that has already happened once. Imported files are rebuilt field by field from a list of permitted fields, so nothing unexpected can be smuggled in — but if a new field is added to the app and nobody adds it to that list, the field is silently discarded on every import. That is what happened to project tile colour, quietly dropped from every imported file for seven releases across six weeks. The list is now derived from the field names themselves, so leaving one out stops the build and names the missing field instead of failing silently. Both failure modes were deliberately triggered to confirm the protection fires before it was relied on.',
          'One function here is more intricate than the project’s complexity limit allows. It was measured rather than assumed, and deliberately left alone: the obvious way to break it up would scatter a single readable checklist across several places without making it simpler. The reasoning is recorded alongside the code, and the function is fully covered by the new tests instead.',
        ],
      },
    ],
  },
  {
    version: '0.35.1',
    date: '2026-08-13',
    sections: [
      {
        title: 'Changed',
        items: [
          'Tooling only. Nothing in the app itself changed — it behaves identically to v0.35.0.',
          'The tool that measures how much of the code the tests actually run is now declared as part of the project. It had been in use without ever being written down: the measurements it produced were real, but they relied on a package that happened to be sitting on one machine and was recorded nowhere.',
          'A fresh copy of this project would not have had it, and a routine clean reinstall would have quietly removed it. A measurement nobody else can repeat is not much better than no measurement at all — and this one was being used to decide which parts of the code to work on next.',
          'Declaring it fixes that: a clean copy now installs the tool along with everything else, so the coverage figures can be checked rather than taken on trust. Verified the only way worth trusting — by deleting every installed package, reinstalling from the recorded list alone, and confirming the measurement came back identical.',
          'The package is version-matched to the test runner already in use and has been published for 113 days, comfortably clear of this project’s 60-day waiting period before a new dependency is adopted. Nothing else moved: eleven supporting packages were added, none removed, and no existing package changed version.',
        ],
      },
    ],
  },
  {
    version: '0.35.0',
    date: '2026-08-13',
    sections: [
      {
        title: 'Added',
        items: [
          'Tooling only. Nothing in the app itself changed — it behaves identically to v0.34.9.',
          'The release checks now measure how hard each function in the code is to follow, and refuse a release that makes it harder. The measure is cognitive complexity: roughly, how much you have to hold in your head at once to be sure what a piece of code does. Every branch, loop and nested condition adds to it, and code nested inside other code counts for more than the same logic laid out flat.',
          'Fourteen functions currently score above the limit of fifteen. That number is recorded as the accepted starting point — a baseline, not a list of faults. None of those functions changed in this release, and the goal is not to drive the count to zero: some are complicated because the thing they do is complicated, and simplifying them for the sake of the number would be a poor trade.',
          'The check refuses a release that introduces a fifteenth, and equally refuses one where the count falls to thirteen without the recorded baseline being updated in the same change — otherwise a function that was quietly relocated rather than genuinely simplified would read as progress. Both directions were deliberately triggered and confirmed to fail before the check was trusted.',
          'A new command reports the score for every function in a file rather than only those over the limit, and can estimate what a block of code would score if it were lifted out into a function of its own — so a decision to split something up, or to leave it alone, can be made before any code moves.',
        ],
      },
    ],
  },
  {
    version: '0.34.9',
    date: '2026-08-02',
    sections: [
      {
        title: 'Changed',
        items: [
          'Licensing only. Nothing in the app itself changed — it behaves identically to v0.34.8.',
          'The conditions attached to this project’s licence now number six rather than four, and each follows the wording of the standard licence itself rather than paraphrasing it. What the licence permits is unchanged: anyone may still use, study, modify and share this software freely. The wording matters because the standard licence lets whoever receives the software delete any added condition that strays outside the short list it allows.',
          'Two conditions are new. The author’s name may not be used to endorse or promote a product built from this software without permission — the project’s trademarks are protected whether the licence mentions them or not, but a personal name has no such protection. And anyone who resells this software with a warranty or support contract of their own covers any liability those promises impose on the original author.',
          'The condition covering on-screen credit was rewritten. It used to require any modified version with a user interface to display a notice; the standard licence permits requiring that existing notices be preserved, not that new ones be created. It now requires that where a modified version already shows legal notices, the original author’s name is kept among them.',
          'Two smaller changes: a modified version may no longer misrepresent where this software came from, and the trademark condition now says plainly that naming this project to describe honestly what a fork was derived from is not itself prohibited, provided it does not suggest this project endorses the result.',
        ],
      },
    ],
  },
  {
    version: '0.34.8',
    date: '2026-07-31',
    sections: [
      {
        title: 'Changed',
        items: [
          'Tooling only. Nothing in the app itself changed — it behaves identically to v0.34.7.',
          'The release checks can now be told about every copy of a changelog a project keeps, rather than just one. This project keeps two: the file alongside the source, and this version history inside the app. The new check on this one is deliberately redundant with the existing test that refuses a release where any version is missing from either side — that test remains the stronger guard, and both are kept.',
        ],
      },
    ],
  },
  {
    version: '0.34.7',
    date: '2026-07-31',
    sections: [
      {
        title: 'Changed',
        items: [
          'Tooling only. Nothing in the app itself changed — it behaves identically to v0.34.6.',
          'The automated release checks now read the Node version this repository pins, from the file kept alongside the source, rather than a version written directly into the checks themselves. The two were free to disagree.',
        ],
      },
    ],
  },
  {
    version: '0.34.6',
    date: '2026-07-31',
    sections: [
      {
        title: 'Changed',
        items: [
          'Record-keeping only. Nothing in the app itself changed — it behaves identically to v0.34.5.',
          'The last five releases that were listed here in the app but missing from the changelog file kept alongside the source code — v0.18.6, v0.18.7, v0.18.8, v0.20.0 and v0.28.0 — have now been copied across. The two records are complete and identical for the first time, covering all 84 releases back to v0.1.0.',
        ],
      },
    ],
  },
  {
    version: '0.34.5',
    date: '2026-07-31',
    sections: [
      {
        title: 'Changed',
        items: [
          'Record-keeping only. Nothing in the app itself changed — it behaves identically to v0.34.4.',
          'Sixteen releases from earlier this year — v0.6.0 through v0.16.3 — have always been listed here in the app, but had never been written into the changelog file kept alongside the source code. They have now been copied across word for word, so both records tell the same story. Five older releases are still outstanding; they are tracked automatically, so they cannot quietly be forgotten.',
        ],
      },
    ],
  },
  {
    version: '0.34.4',
    date: '2026-07-30',
    sections: [
      {
        title: 'Fixed',
        items: [
          'A group of tests were not actually checking what they claimed to. Six mock declarations used a form that a recent testing-library upgrade had replaced, and under the old form those mocks quietly accepted any value at all — so the checks around them were passing regardless of what was passed in. The declarations are corrected and every test still passes; this changes what is verified, not how the app behaves.',
        ],
      },
      {
        title: 'Changed',
        items: [
          'Release-process work only. Nothing in the app itself changed — it behaves identically to v0.34.3.',
          'Every proposed change is now checked automatically before it can be merged: the full test suite, the linter, a type check, a production build, and a check that the version number agrees everywhere it appears. This is the first automated checking this project has ever had — previously a green checkmark meant only that a preview had been built, not that the 1,163 tests had been run, because nothing ran them.',
          'The type check runs separately from the build on purpose, because the build only checks the code that ships and skips test files. That gap is exactly where the mock problem above had been hiding.',
          'Added automatic checks that this changelog stays consistent with the copy kept in the repository, that the license file still matches the canonical copy shared across the suite, and that every file the app links to actually exists.',
        ],
      },
    ],
  },
  {
    version: '0.34.3',
    date: '2026-07-29',
    sections: [
      {
        title: 'Changed',
        items: [
          'The license file now reserves the SPERT\u00ae brand. It has always required that the original author be credited, but it said nothing about the brand name itself \u2014 which left room to read the licence\u2019s freedom to copy and modify the code as carrying the name along with it. That was never the intent.',
          'Two clauses were added to cover it. The first names "SPERT", "Statistical PERT" and "Estimation Made Easy" as registered trademarks and "GanttApp" and "MyScrumBudget" as common-law trademarks, and grants no right to use any of them. The second requires anyone who modifies the app to release it under a different name.',
          'The effect is that the code is still free to take, change and share, credit to the original author still has to travel with it, and the brand does not. The GNU GPL v3 text itself is unchanged.',
          'MyScrumBudget was the only one of the nine SPERT\u00ae Suite repositories whose license file was already an exact copy of the suite-wide original, so this release adds the two new clauses and changes nothing else. Nothing in the app itself changed.',
        ],
      },
    ],
  },
  {
    version: '0.34.2',
    date: '2026-07-29',
    sections: [
      {
        title: 'Fixed',
        items: [
          'Shared project members showed a raw internal account ID instead of a name or email address. This affected anyone added through an emailed invitation who had used another SPERT\u00ae Suite app but had never personally signed into MyScrumBudget.',
          'The member list now falls back to the shared suite-wide profile, so the name or email appears immediately \u2014 including for members added before this release. Nothing needs to be re-invited and no action is required.',
        ],
      },
    ],
  },
  {
    version: '0.34.1',
    date: '2026-07-26',
    sections: [
      {
        title: 'Changed',
        items: [
          'Internal repository maintenance only. No functional, data, or interface changes — MyScrumBudget behaves identically to v0.34.0. Housekeeping removed two files from the source repository that described how Firestore security rules are deployed; those rules live in the Firebase Console and are unchanged, and neither file was ever part of the app you run.',
        ],
      },
    ],
  },
  {
    version: '0.34.0',
    date: '2026-07-16',
    sections: [
      {
        title: 'Added',
        items: [
          'Archive / Unarchive projects. Project gains an optional archived flag: undefined or false means active, true hides the project from the Dashboard grid by default. Archiving is not deletion — reforecasts, allocations, and all project data are untouched and remain fully editable if you open an archived project directly. On a shared project, archiving hides it for every member (it acts on the project itself); unlike deleting a shared project (owner-only, confirmation dialog), archiving can be done by any editor and takes effect immediately.',
          '"Show archived (N)" checkbox on the Dashboard, visible only when the workspace has at least one archived project. Checking it reveals archived projects in the grid, dimmed with a small "Archived" badge.',
          'Archive / Unarchive action on each project card. Archive is a hover-revealed action alongside Export and Clone; Unarchive is always visible on an archived card, so there is a reliable way back even on touch devices.',
          'Archived status is preserved through JSON export/import, including in the Dashboard import-preview list, which now labels an incoming archived project — and flags when an existing project it conflicts with is itself archived — so neither case looks like data silently vanished.',
        ],
      },
      {
        title: 'Changed',
        items: [
          'Cloning a project never carries over its archived state — the clone is always active.',
          'The Dashboard empty state now distinguishes "no projects at all" (Getting Started checklist) from "every project is archived" (a plain message pointing at the toggle) — previously the checklist could incorrectly reappear for a user who archived their only project.',
        ],
      },
      {
        title: 'Fixed',
        items: [
          'The JSON import sanitizer was silently stripping a project tile color on import. color was never added to the import field allowlist when it shipped in v0.33.0, so any project tint was dropped on round-trip. Fixed alongside the archiving work since it touches the same allowlist.',
        ],
      },
      {
        title: 'Storage',
        items: [
          'DATA_VERSION bumped to 0.16.0. New structural no-op migration entry mirrors the shape of the existing color migration (absent archived = active; no backfill).',
          'Firestore: FirestoreProjectDoc.archived is stored as boolean | null (Firestore rejects undefined); docToProject only hydrates the field when true. The projects-collection field allowlist in the shared SPERT Firestore rules was updated to include both archived and color, deployed ahead of this release. Cloud-mode project creation was never broken by the missing color entry — a new project writes color: null, and a null-valued field is not counted by the rules keys().hasOnly() check (unlike a non-null value). The archive toggle writes a non-null archived: true, so the allowlist entry keeps that path safe.',
          'The strict import validator now type-checks the optional archived field. The lenient localStorage guard is intentionally unchanged.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '1136 → 1159 across 74 files (+23): archiving coverage across migrations (v0.15.0 to 0.16.0 no-op + idempotency), validation, sanitizeImport, useProjects (archive/unarchive), ProjectCard (badge/buttons/dimming), dashboardCard (clone-drops-archived + getDashboardEmptyState), firestoreUtils (archived hydration), localStorage (reorderProjects data-loss guard), and importUtils (conflict labeling).',
        ],
      },
    ],
  },
  {
    version: '0.33.6',
    date: '2026-06-28',
    sections: [
      {
        title: 'Security',
        items: [
          'Added a postcss ^8.5.10 override to close GHSA-qx2v-qp2m-jg93 (PostCSS cross-site scripting via an unescaped </style> in its CSS stringify output; Moderate, CVSS 6.1, affects postcss < 8.5.10). next 16.2.9 pins postcss 8.4.31; because Tailwind v4 had already pulled a newer postcss 8.5.x to the top level, the copy Next pins could not dedupe and survived as a vulnerable nested node_modules/next/node_modules/postcss 8.4.31. npm audit attributed it to next via the postcss dependency path — a phantom next 16.2.9 → 16.2.9 advisory — which is why the deferred audit in v0.33.5 did not surface it. The override collapses the tree to a single hoisted postcss 8.5.16 and removes the nested copy.',
          'The flaw is in the PostCSS CSS stringifier and is not exercised at runtime by this app (PostCSS runs at build time only), but the line is cleared for a clean audit and suite parity. Taken as a security-driven soak bypass, consistent with the rest of the SPERT suite. Verified this release with live npm audit (zero occurrences of GHSA-qx2v-qp2m-jg93) plus a green production build and all 1136 tests on Node 24.',
        ],
      },
      {
        title: 'Changed',
        items: [
          'No application source changes. The single hoisted postcss floats 8.5.15 → 8.5.16 (current 8.5.x patch) and Next nested 8.4.31 is removed; all other dependencies unchanged (the vite 7.3.2 override is retained). DATA_VERSION stays 0.15.0; 1136 tests across 74 files pass unchanged.',
        ],
      },
    ],
  },
  {
    version: '0.33.5',
    date: '2026-06-28',
    sections: [
      {
        title: 'Security',
        items: [
          'Updated next 16.1.7 → 16.2.9, closing the ~14 Next.js advisories deferred in v0.33.3 (their fix ranges all fall at or below 16.2.6). The cluster includes eight High-severity advisories — Denial of Service via Server Components, Denial of Service via connection exhaustion in Cache Components, server-side request forgery via WebSocket upgrades, and four Middleware / Proxy bypasses (segment-prefetch routes, dynamic route parameter injection, and Pages Router i18n) — plus moderate cross-site scripting (CSP nonces, beforeInteractive scripts) and an Image Optimization DoS, and two low-severity cache-poisoning advisories. Several of the Middleware/Proxy and Image advisories are not reachable in this app (no middleware.ts, no rewrites/redirects, no i18n, no next/image usage), but the line is adopted in full for a clean audit and parity with the rest of the suite.',
          'Soak bypass (security-driven), consistent with the rest of the SPERT suite. next 16.2.9 (published 2026-06-09) has not cleared the 60-day adoption window; the bump is taken as a CVE bypass because the High cluster requires 16.2.6 or newer and the routine-soak path cannot reach a clean state until 16.2.6 clears (~2026-07-06). The other suite apps already adopted 16.2.9 the same way. Live npm audit was deferred to CI for this release; advisory closure is proven by version range.',
          'Deferred items unchanged: vite 7.3.5 (Windows-only, dev/build-only; follow-up after 2026-07-31) and the accepted esbuild (GHSA-g7r4-m6w7-qqqr) and exceljs → uuid (GHSA-w5hq-g745-h8pq) transitive advisories.',
        ],
      },
      {
        title: 'Changed',
        items: [
          'Co-bumped eslint-config-next 16.1.7 → 16.2.9 in lockstep with next. This floats the bundled eslint-plugin-react-hooks 7.0.x → 7.1.1; the code lints clean with no remediation needed. eslint stays on ^9 (eslint-config-next 16.2.9 caps its bundled plugins at eslint 9).',
          'No other dependencies moved (float guard verified): react / react-dom 19.2.5, typescript 6.0.3, vitest 4.1.5, jsdom 29.1.0, @types/node 24.12.2, firebase 12.12.1, tailwindcss 4.2.4, @vitejs/plugin-react 5.2.0, eslint 9.39.4, and the vite 7.3.2 override all unchanged. DATA_VERSION stays 0.15.0; 1136 tests across 74 files pass unchanged.',
        ],
      },
    ],
  },
  {
    version: '0.33.4',
    date: '2026-06-27',
    sections: [
      {
        title: 'Changed',
        items: [
          'TypeScript ^5 → 6.0.3 (5.9.3 → 6.0.3). A dev/build-time-only major-version bump; the production bundle is unchanged. TypeScript 6.0 tightened side-effect import checking, so a one-line ambient declaration (src/types/css.d.ts: declare module "*.css") was added so the build type-check gate accepts the globals.css side-effect import. No deprecated-option migrations were needed (target ES2017 is unaffected); all 1136 tests pass.',
        ],
      },
    ],
  },
  {
    version: '0.33.3',
    date: '2026-06-27',
    sections: [
      {
        title: 'Security',
        items: [
          'Updated next 16.1.6 → 16.1.7, closing "HTTP request smuggling in rewrites" (GHSA-ggv3-7p47-pfv8, Moderate) plus four further advisories that 16.1.7 also resolves: unbounded next/image disk-cache growth, unbounded postponed-resume buffering DoS, and two null-origin CSRF bypasses (Server Actions and dev HMR websocket). ~14 other Next.js advisories (version ranges below 16.2.x) remain in npm audit, deferred until a 16.2.x release clears the 60-day adoption window.',
          'The soak-eligible dependency refresh also cleared a large batch of transitive advisories pulled in by the firebase, next, and vitest updates — the entire protobuf.js code-execution / denial-of-service chain (previously the only Critical), seven undici advisories, and @grpc/grpc-js, tmp, js-yaml, picomatch, brace-expansion, flatted, and @babel/core. npm audit drops from 18 vulnerable packages to 9.',
          'vite stays at 7.3.2 this release. The two Windows-only, dev/build-only vite advisories (GHSA-v6wh-96g9-6wx3, GHSA-fx2h-pf6j-xcff; fixed in vite 7.3.5) remain deferred to a follow-up after 2026-07-31, when 7.3.5 clears the 60-day adoption window — avoiding a soak bypass for a fix that never reaches the production bundle.',
          'esbuild GHSA-g7r4-m6w7-qqqr (Low): a dev-server-only, Windows-only path-traversal advisory that now matches the refreshed esbuild 0.27.7 (a transitive build/test dependency, never in the production bundle; this app never runs esbuild\'s dev server). Accepted; expected to clear when vite advances in the deferred follow-up.',
          'exceljs → uuid (GHSA-w5hq-g745-h8pq): known non-exploitable transitive advisory (the vulnerable uuid v3/v5/v6 + caller-buffer path is unreachable; exceljs uses uuid v4 only). Accepted; no fix attempted.',
        ],
      },
      {
        title: 'Changed',
        items: [
          'Dependency refresh (all soak-eligible): firebase 12.10.0 → 12.12.1; react/react-dom 19.2.4 → 19.2.5; tailwindcss & @tailwindcss/postcss 4.1.18 → 4.2.4; vitest 4.1.4 → 4.1.5; jsdom 28.1.0 → 29.1.0; @types/node 22.x → 24.x (24.12.2); @vitejs/plugin-react 5.1.4 → 5.2.0; eslint 9.39.2 → 9.39.4.',
          'Node 24 LTS adopted: engines.node 22.x → 24.x; .nvmrc 22 → 24.',
          'Realigned eslint-disable directives after eslint-config-next 16.1.7 bundled a newer react-hooks plugin that changed which set-state-in-effect patterns it flags (comment-only; no runtime or behavioral change).',
        ],
      },
    ],
  },
  {
    version: '0.33.2',
    date: '2026-06-19',
    sections: [
      {
        title: 'Security',
        items: [
          'Updated vitest 4.0.18 → 4.1.4, closing a Critical advisory in the Vitest UI server (arbitrary file read and execute, GHSA-5xrq-8626-4rwp).',
          'Pinned vite to 7.3.2 — a transitive build/test dependency that is never shipped to users — closing three advisories: arbitrary file read via the dev-server WebSocket (High), a server.fs.deny bypass via crafted queries (High), and path traversal in optimized-dependency source maps (Moderate).',
          'Two Windows-only vite advisories remain deferred until their fix (vite 7.3.5) clears the 60-day version-adoption window; follow-up is scheduled for around 2026-07-31.',
        ],
      },
      {
        title: 'Fixed',
        items: [
          'Stabilized three date-sensitive data-migration tests that started failing once the calendar passed a fixture date (June 15, 2026); they now pin a fixed clock so results no longer depend on the day the test suite runs. Internal test-only change with no effect on the app, and unrelated to the dependency updates.',
        ],
      },
    ],
  },
  {
    version: '0.33.1',
    date: '2026-06-03',
    sections: [
      {
        title: 'Fixed',
        items: [
          'Dashboard tile action icons. The color swatch and trash (both always shown) had an empty gap between them where the hover-revealed export and clone icons sat. Reordered the icons and made the hover pair collapse fully when hidden, so the swatch and trash now sit together at the right edge and export/clone slide in to their left on hover.',
        ],
      },
    ],
  },
  {
    version: '0.33.0',
    date: '2026-06-03',
    sections: [
      {
        title: 'Fixed',
        items: [
          'Dashboard project tiles showed stale start/finish months. The tile read the frozen project-level dates (creation-time metadata since v0.29.0) instead of the live reforecast window, so editing a reforecast date left the month range stale — even after a refresh. Tiles now show the most-recent reforecast window (both start and finish), consistent with the Budget/EAC already shown.',
          'The project "Start / Finish" tile showed a stale date after editing and saving it. The edit form saved correctly, but the detail page rendered an out-of-date value until a manual refresh. The underlying save now completes synchronously before navigation, so the returned-to page reads the committed value.',
        ],
      },
      {
        title: 'Added',
        items: [
          'Color tint for Dashboard project tiles. A swatch picker on each tile tints the card with a curated palette (Blue, Teal, Slate, Purple, Pink), chosen to avoid the health-status colors so a tint can never be mistaken for a status. Use it to group projects however is meaningful to you.',
          'Most-recent reforecast date on each tile. An "as of {date}" stamp shows the latest reforecast date across all of a project’s reforecasts, so you can tell at a glance whether the numbers are recent. It turns amber once that date is more than 30 days old.',
          'Per-tile JSON export. A hover-revealed export icon downloads just that one project (with the settings and team pool it needs), importable through the usual Dashboard import.',
          'Per-tile clone. A hover-revealed clone icon duplicates a project, naming the copy "<name> - Copy (1)", "- Copy (2)", and so on.',
        ],
      },
    ],
  },
  {
    version: '0.32.1',
    date: '2026-05-30',
    sections: [
      {
        title: 'Documentation',
        items: [
          'New Charter Budget Reference Guide (PDF) added to the About page. A companion to the Quick Reference Guide that documents the full statistical model behind the Charter Budget feature — the coefficient-of-variation calibration by project type, the additive risk-factor adjustments, the three probability distributions (Normal / Lognormal / Beta-PERT), the optimism-bias option, the P80-schedule integration guidance, and the underlying research basis.',
          'Updated Quick Reference Guide (PDF). Now covers the Charter Budget panel, pool-member archiving, the conflict-aware per-project import flow, and other features added since the previous edition.',
        ],
      },
    ],
  },
  {
    version: '0.32.0',
    date: '2026-05-30',
    sections: [
      {
        title: 'Charter Budget',
        items: [
          'New Charter Budget panel on the project detail page turns the deterministic ETC into an uncertainty-adjusted charter budget at a chosen confidence percentile (P60–P95) and distribution (Normal / Lognormal / Beta-PERT). Complete a five-question risk profile — project type, requirements clarity, team experience, org-change impact, integration complexity — and the model derives a coefficient of variation and computes the charter budget, with live ETC as the cost basis. An explainable planning heuristic where every contingency dollar traces to a selection — explicitly not a guarantee.',
          'Live CV breakdown (green favorable / amber unfavorable), results cards (applied CV, σ, P50 median, charter budget), and a distribution-specific mini chart all update as you adjust the profile. Apply writes the charter amount as the reforecast baseline budget.',
          'Optimism-bias uplift (opt-in): a direct-percentage adjustment that raises the cost basis before contingency, shown as a distinct line so expected-overrun correction and risk contingency are separated for the sponsor. Defaults to off.',
          'Manual CV override (8–50%) bypasses the governance ceiling — a deliberately-typed value is not a "scope unstable" signal. The CV is otherwise clamped to [8%, 50%], with the 50% ceiling surfaced as a governance signal that scope may be too unstable to charter.',
          'Schedule-source nudge: flag that the ETC came from a P80+ schedule forecast (e.g. SPERT® Forecaster) and the panel recommends targeting P60 rather than stacking P80 cost on a P80 schedule.',
        ],
      },
      {
        title: 'Charter badge & staleness',
        items: [
          'The Baseline Budget tile shows a compact charter badge (P{n} · distribution, with +N% bias and stale variants) and a Set / Edit charter budget link.',
          'A charter records the ETC it was calculated against. When live ETC later drifts as actuals accrue, the badge and panel show a "stale" indicator — the charter is a point-in-time artifact, so drift is surfaced rather than auto-recomputed.',
        ],
      },
      {
        title: 'Bug fixes',
        items: [
          'Charter "Apply as baseline budget" now rounds to the nearest whole dollar. Previously the raw computed quantile (e.g. 108095.3970112618) was written verbatim into the baseline budget field.',
        ],
      },
      {
        title: 'Data & import',
        items: [
          'The charter budget is stored per-reforecast (alongside the baseline budget), so each reforecast snapshot carries its own charter. Undo/redo, cloud sync, and JSON export/import all round-trip it. No data migration is required — projects without a charter simply have none. Re-baselining (a manual edit of the Baseline Budget field) clears the charter.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '1095/1095 passing across 71 test files. New coverage for the charter-budget math engine (golden multipliers, inverse-normal precision, distribution invariants, CV clamp and governance flags), the apply / clear / no-op-guard write paths, and the import sanitize + strict validation matrix. Independently re-verified by a five-dimension adversarial pass (math, governance, import round-trip, write paths, staleness) with zero blockers.',
        ],
      },
    ],
  },
  {
    version: '0.31.0',
    date: '2026-05-26',
    sections: [
      {
        title: 'Bug fixes',
        items: [
          'E2a — Signing out in local storage mode no longer clears local projects, settings, team pool, changelog, or origin fingerprint. Only cloud-mode sign-out clears these keys. Users who briefly sign into Firebase and sign out without switching to cloud retain all their work.',
          'A3 — Reforecast notes textarea, dashboard threshold inputs, and reforecast date inputs now use local buffers that reject incoming cloud-sync updates while the user is actively typing. Per-keystroke commits to the store are preserved so undo/redo is unaffected. ReforecastToolbar additionally clamps date values through a single source (the same function that writes the store) so the displayed input never diverges from the stored value, and an empty-input clear is safely ignored without leaving a blank display over a populated store.',
          'D2 — Pending debounced saves are flushed on tab close (pagehide and beforeunload). Edits made within 500ms of closing the tab are no longer silently discarded. In cloud mode with no authenticated user, pending writes are cancelled instead of flushed to avoid a guaranteed PERMISSION_DENIED.',
          'I3 — Pending debounced saves for a project are cancelled before deletion, closing the race where an in-flight setDoc(merge:true) could re-create the deleted document. Residual window: ~200ms after a debounce fire (in-flight network, accepted).',
        ],
      },
      {
        title: 'Improvements',
        items: [
          'I2 — Cloud listener permission-denied errors now trigger a data reload to evict inaccessible projects, instead of leaving stale data visible until page refresh. Reloads triggered by permission-denied are silent across the chain (no toast) — useSettings and useTeamPool both react to the same settings-listener bus emit, and silent eviction matches the typical user context (sign-out cascade, admin revocation).',
          'C1 — Firestore project, settings, and team-pool saves now use explicit mergeFields instead of merge:true, making the write contract auditable. Ownership / identity fields (owner, members, order, createdAt, _originRef, _changeLog, schemaVersion) are explicitly excluded from saveProject so the v0.30.0 import "replace" path continues to preserve them.',
          'K2 — Settings documents now include schemaVersion: 2, providing an integration point for future settings-schema migrations. getSettings now carries a comment marking that integration point; legacy docs without schemaVersion should be treated as version 1.',
          'J1 — The import Apply button is disabled while cloud projects are loading (cloud mode only), preventing duplicate-project races on first sign-in. Close the dialog, wait for the dashboard to show existing projects, then re-open the file. Local mode and post-hydration cloud are unaffected.',
        ],
      },
      {
        title: 'Behavioral notes',
        items: [
          'Mid-edit undo (Ctrl+Z while typing notes): the store reverts correctly but the textarea continues to display the typed text while the user remains focused. On next blur, the textarea snaps to the undone value. Undo/redo after blur is fully correct.',
          'msb:originRef and msb:changeLog are now preserved on local-mode sign-out. These per-browser fingerprint keys belong to the browser, not the Firebase account, and should persist across sign-in/sign-out cycles.',
          'Threshold inputs (Settings → Dashboard Thresholds): if the user focuses a threshold field, types, collapses the section without blurring, then focuses a different threshold field and navigates away, the first field\'s typed value is lost — only the second field commits. To save, blur (Tab or click out) before collapsing.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '1055/1055 passing (~44 net additions). New tests: signOutCleanup mode-gating + cloud / local sessionStorage matrix; ReforecastNotes echo-guard + onBeginEdit ordering + onBlur snap; ThresholdSettings local buffer + unmount-commit (new file); ReforecastToolbar date echo-guard; pendingSaveRegistry flushAll + registerKeyed/cancelByKey (full replacement); tabCloseFlush handlers (new file); useDebouncedSave registry integration; useProjects deleteProject ordering + reload error matrix (permission-denied vs network); useSettings + useTeamPool reload error matrix; ImportPreviewSection cloudDataReady Apply gating.',
        ],
      },
    ],
  },
  {
    version: '0.30.0',
    date: '2026-05-19',
    sections: [
      {
        title: 'Level 4 import capability',
        items: [
          'The legacy all-or-nothing "Import JSON" flow in Settings is retired. A new Dashboard import surfaces a per-project preview with conflict detection and per-row decisions (Add / Skip / Replace), plus independent Keep/Replace for Settings and Keep/Merge/Replace for the Team Pool. The default for every conflict is Skip — Replace is always an explicit user choice, never a default.',
        ],
      },
      {
        title: 'Added',
        items: [
          'Per-project import preview with Add / Skip / Replace controls. ID conflicts and name conflicts (case-insensitive, NFC-normalized) are labeled with the colliding project\'s name.',
          'msbExportKind: "dataset" discriminant added to every export. Future-proofs the format guard at the import boundary — any non-"dataset" value is rejected. Legacy exports without the field continue to import.',
          'Duplicate-ID protection in the import file. Subsequent duplicates are dropped; the preview shows a "N of M from file" header and a notice naming the count.',
          'Cloud hydration hint in the preview when cloud mode is active but no existing projects are visible — narrows the post-sign-in race window.',
          'Two-layer stale-data guard during apply: Layer 1 reads existing projects at parse time, Layer 2 re-reads at apply time. If a target was deleted or renamed between layers, "replace" falls back to "add" instead of clobbering an unrelated project.',
        ],
      },
      {
        title: 'Changed',
        items: [
          'DataPortability (Settings page) is now export-only. The Settings "Import JSON" UI and its window.location.reload() onImportComplete consumer are removed. The new flow on the Dashboard notifies subscribers via cloudSyncBus, so the dashboard re-renders without a full page reload.',
          'Apply order is teamPool → settings → projects. firestoreRepo.createProject and saveProject snapshot the team pool at write time; writing the pool first ensures every imported project\'s _teamSnapshot reflects the final pool state.',
          'firestoreRepo.saveProject JSDoc clarifies which fields are written every save vs. preserved by merge:true, and calls out the v0.30.0 import "replace" path\'s dependency on that preservation.',
        ],
      },
      {
        title: 'Security / hardening',
        items: [
          'Import boundary unchanged: same parseImportJson (prototype-pollution-safe), validateAppState, and sanitizeAppState chain from v0.28.2. The msbExportKind discriminant check runs on the raw parsed object before migrate/sanitize.',
          'Cloud "add" decisions regenerate Project.id to prevent Firestore document-ID collision with another workspace\'s unreadable document. Internal IDs (Reforecast, Assignment, Allocation.memberId) are intentionally preserved — they are document-scoped, not cross-document references.',
        ],
      },
      {
        title: 'Deferred (documented limitations)',
        items: [
          'Cloud-flip migration paths (firestoreRepo.importAll) still rewrite createdAt, order, and _originRef on each project. The Level 4 import does not touch this code path, but a local→cloud flip on an existing workspace resets those fields. Tech-debt backlog.',
          'Cloud hydration race on post-sign-in import: importing immediately after enabling cloud sync (before Firestore listeners hydrate) may cause both stale-data layers to read empty, producing duplicate "add" rows. The preview UI now flags this case; wait for the dashboard to show existing projects before importing.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '1011/1011 passing (61 net new). importUtils.test.ts (30), useImportState.test.ts (15), ImportPreviewSection.test.tsx (16). Coverage includes: normalization, conflict detection, dedup, the write-order guard, the name-conflict target-changed guard, the named-success-flag changelog gate, the Layer 2 delete-between-layers guard, the all-skip banner, the cloud hydration hint, role transitions, and component rendering.',
        ],
      },
    ],
  },
  {
    version: '0.29.2',
    date: '2026-05-15',
    sections: [
      {
        title: 'Fixed',
        items: [
          'Edit Project → confirm date change → stale allocation grid columns. useDebouncedSave.flush() previously fired the save as a fire-and-forget Promise; the Edit page\'s "await onSubmit(...)" would resolve before the repo write completed, and router.back() mounted the detail page against stale data. flush() now returns the underlying save Promise, and the Edit page\'s applyAll() awaits it before resolving the dialog Promise. Manual browser refresh is no longer needed — this was a pre-existing bug going back further than v0.29.0.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '950/950 passing. Updated three test files (useDebouncedSave, useTeamPool, useSettings) to discard the Promise via "void" so act() stays in synchronous mode for assertions that don\'t need to await the save.',
        ],
      },
    ],
  },
  {
    version: '0.29.1',
    date: '2026-05-15',
    sections: [
      {
        title: 'UX refinement on v0.29.0 per-reforecast windows',
        items: [
          'The two competing date surfaces v0.29.0 introduced (project header tile vs. new toolbar Start/End inputs) collapse into one. The header tile and the Edit Project page now both edit the ACTIVE REFORECAST\'s window. Toolbar Start/End inputs are removed.',
        ],
      },
      {
        title: 'Changed',
        items: [
          'Header tile (ProjectSummary Start / Finish) displays the active reforecast\'s startDate / endDate. Switching reforecasts updates the displayed dates immediately.',
          'Edit Project page dates apply to the active reforecast (not the project). The v0.29.0 confirmation dialog with {from, to} adjustments now appears here on submit when the change would trim allocations, remove historical-cost entries, clamp the Reforecast Date, or clamp the Actuals Through date.',
          'PrintableReport date header and the Project Summary section\'s Start/End rows now read from the active reforecast.',
          'Productivity-window date input bounds now use the active reforecast\'s window. The fully-out-of-range warning indicator is unchanged.',
        ],
      },
      {
        title: 'Removed',
        items: [
          'Toolbar Start/End date inputs and their confirmation dialog (added in v0.29.0). The toolbar shrinks back to its v0.28.x size.',
          'PrintableReport\'s conditional "Reforecast Window" line — the header now always shows the active reforecast\'s window, so the duplicate is no longer needed.',
          'Project.startDate / Project.endDate are still stored for backward compatibility but no longer drive any runtime UI. Effectively creation-time metadata.',
        ],
      },
      {
        title: 'Data model',
        items: [
          'createNewReforecast signature change: projectStartDate/projectEndDate params replaced by a defaults: { startDate; endDate } object. Caller resolves defaults to either the source reforecast\'s window (when copying) or the baseline reforecast\'s window (when creating blank). Matches the mental model that new scenarios inherit from the original plan.',
          'No migration needed — v0.14.0 schema unchanged.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '950/950 passing. Removed the toolbar Start/End commit-handler props from ReforecastToolbar.test.tsx. createNewReforecast test calls updated to the new defaults-object signature.',
        ],
      },
    ],
  },
  {
    version: '0.29.0',
    date: '2026-05-14',
    sections: [
      {
        title: '⚠️ Breaking semantic change',
        items: [
          'Reforecast.startDate format changed from YYYY-MM to YYYY-MM-DD and is now the runtime driver for the allocation grid, calc engine, and chart rendering. Data files saved in v0.29.0 cannot be opened by v0.28.x or earlier — do not export from v0.29.0 if the destination is on an earlier version.',
        ],
      },
      {
        title: 'Added',
        items: [
          'Per-reforecast Start and End date inputs in the reforecast toolbar. Each what-if scenario carries its own window, independent of the project and of sibling reforecasts. The allocation grid, calc engine, and charts now read from the active reforecast.',
          'Confirmation dialog with exact "from → to" values. When a window change would trim allocations, remove historical-cost entries, clamp the Reforecast Date, or clamp the Actuals Through date, the dialog surfaces precise counts and adjustments before applying. Productivity windows that fall fully outside the new range are listed in the dialog and visually flagged after commit — never auto-deleted.',
          'Reforecast.endDate field (required, YYYY-MM-DD). Migration backfills from project.endDate (or the latest allocation month / rf.startDate if project end is unset). New reforecasts inherit either the project window (blank) or the source reforecast window (copy).',
          '"Reforecast Window" line in PrintableReport, rendered only when the active reforecast\'s window differs from the project\'s.',
        ],
      },
      {
        title: 'Changed',
        items: [
          'Editing the project no longer cascades to existing reforecasts. Project dates seed new reforecasts only. Each reforecast permanently carries its own window from the moment of creation. ProjectForm date helper text makes this explicit.',
          'Mid-month reforecast start dates produce partial first-month working hours. A 1.0 FTE allocation for March on a reforecast starting March 15 produces roughly half a full-March cost (same behavior already applied for project start dates).',
          'reforecastDate ("when this forecast was prepared") is independently editable. Maximum is today\'s date; a reforecastDate past the reforecast\'s end date is permitted (you can document a December forecast for a project that ended in June). Future-dated values in existing data are preserved on read.',
          'actualsThroughDate constrained to [rf.startDate, rf.endDate] when set. Cleared via the × button. Clamped in either direction during migration if it fell outside the new window.',
          'Copying reforecasts inherits the source\'s startDate/endDate, actualCost, historicalCosts, and actualsThroughDate. Carrying the actual cost record forward gives the correct EAC and variance baseline for the new scenario.',
        ],
      },
      {
        title: 'Removed',
        items: [
          'computeTimelineChangeSummary and applyTimelineChangeToReforecasts (the multi-reforecast cascade helpers) — replaced by computeSingleReforecastTimelineChangeSummary and applyTimelineChangeToSingleReforecast. The PendingSave dialog on the project edit page is gone.',
        ],
      },
      {
        title: 'Migration (automatic on first load)',
        items: [
          'Converts Reforecast.startDate from YYYY-MM to YYYY-MM-DD using the day component from project.startDate (defaults to -01 if absent or invalid).',
          'Backfills Reforecast.endDate from project.endDate (fallback chain: latest allocation month → rf.startDate).',
          'Clamps any out-of-range reforecastDate / actualsThroughDate to the new window. Migration-time clamps are silent — if you had a value near the edge of your reforecast window before upgrading, check the toolbar after the first load to confirm it landed where expected.',
          'If pre-migration data is entirely corrupt and all date fields are invalid, the reforecast window defaults to 1970-01-01 as a fail-safe — open the toolbar and enter the correct dates.',
          'Internal AppState.version advances to "0.14.0". The user-facing app version 0.29.0 and the internal schema version are intentionally independent.',
        ],
      },
      {
        title: 'Notes',
        items: [
          'Productivity windows fully outside the active reforecast\'s range receive a warning indicator (!) in the productivity-window table with a tooltip. They are not auto-deleted; the input bounds remain at project-level so users can edit windows back into the rf window without delete-and-recreate.',
          'Known edge case: if the page remains open across midnight, date constraints and confirmation dialog "from → to" values reflect the day captured at render. The committed value always matches what the dialog showed (the dialog freezes today at open time). A page refresh resolves any visual stale-date display.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '950 passing across 62 test files (was 939 / 62). Rewrote timelineChange tests for the single-reforecast helpers (computeClampedReforecastDate, computeSingleReforecastTimelineChangeSummary, applyTimelineChangeToSingleReforecast, filterHistoricalCostsByRange, summaryHasChanges). Updated all Reforecast test fixtures to YYYY-MM-DD startDate + endDate. Added C1 regression guard (end-date-only edit never adjusts reforecastDate). Added productivity-window overlap test (fully out-of-range counted, partial overlap not).',
        ],
      },
    ],
  },
  {
    version: '0.28.2',
    date: '2026-05-09',
    sections: [
      {
        title: 'Security — High',
        items: [
          'H1: myscrumbudget_profiles bulk-enumeration block (rules + code). Replaced `allow read: if isAuth()` with auth-only `get` plus `list: if isAuth() && request.query.limit <= 1` on myscrumbudget_profiles. MSB was the LAST app in the suite still on the legacy unbounded read; the rule change closes the bulk email/displayName/photoURL harvest vector. Companion app-side change deletes SharingSection.tsx and the legacy findUidByEmail / addProjectMember / removeProjectMember in sharing.ts (the only callers of the unbounded getDocs(collection(myscrumbudget_profiles)) query), plus the <SharingSection> ternary branch in src/app/projects/[id]/page.tsx. The active member-add path runs through callSendInvitationEmail (Cloud Function, server-side authority); getProjectMembers survives unchanged for the BulkSharingSection member list.',
          'H2: XLSX export formula-injection sanitization. Added an xlsxSanitize helper in src/features/reforecast/lib/excelExport.ts that prepends \' to any string whose first character is =, +, -, @, \\t, or \\r — Excel/LibreOffice/Sheets evaluate such cells as formulas on file open. With v0.28.0 bulk invitations live, a collaborator could rename themselves to =HYPERLINK(...) or =cmd|\'/c calc\'!A1 and any other collaborator who downloads the Resource Plan would auto-evaluate the payload. Sanitization applied to member name, role, the title cell, and the row-2 metadata line. Allocation cells are numeric and unchanged.',
          'H3: JSON import field-strip pass. Added src/lib/utils/sanitizeImport.ts exporting sanitizeAppState, which reconstructs the entire imported tree using per-entity allowlists drawn directly from the domain types. Applied in DataPortability.handleImport AFTER validateAppState, so the data flowing into repo.importAll (and on cloud-flip into Firestore) is guaranteed to contain only known keys. Closes the smuggle vector where a malicious export file could inject `members: { "<victim_uid>": "owner" }`, `_admin: true`, or other unknown fields onto a project, reforecast, allocation, or settings entity. Defense-in-depth on top of the v0.28.2 (M5) Firestore field allowlist; this layer also covers fields nested inside arrays where no rule guard exists.',
        ],
      },
      {
        title: 'Security — Medium',
        items: [
          'M1: prototype-pollution defense at the JSON parse boundary. Added src/lib/utils/safeJsonParse.ts exporting parseImportJson, which uses a JSON.parse reviver to drop __proto__, constructor, and prototype keys at every depth. DataPortability.handleImport now calls parseImportJson instead of JSON.parse. Closes the prototype-pollution sink where {"__proto__": {"isAdmin": true}} JSON, when later spread into a literal (as multiple migrations in migrations.ts do), would invoke the __proto__ setter and pollute Object.prototype for the runtime.',
          'M2: BulkSharingSection runtime role guard. handleSend now collapses the role state variable to "editor" for any value other than "viewer" before forwarding to callSendInvitationEmail. The setRole(e.target.value as "editor" | "viewer") cast is erased at runtime; a bundle-modified or DevTools-tampered client could send role: "owner" and rely entirely on the Cloud Function\'s own role validation. Defense-in-depth.',
          'M3: callable wrapper runtime input validation. callSendInvitationEmail, callRevokeInvite, and callResendInvite in src/lib/firebase/invitations.ts now reject malformed inputs at the wrapper layer before invoking httpsCallable: non-empty bounded strings for modelId (≤200) and tokenId (≤200), role ∈ {editor, viewer}, emails must be a non-empty array of ≤50 entries. Same defense-in-depth rationale as M2.',
          'M4: rules — myscrumbudget_projects create rule binds top-level owner. Added request.resource.data.owner == request.auth.uid to the create predicate. Closes the split-state vector where members[self] == "owner" but the top-level owner points to another UID, which would break removeCollaborator Guard 2 in src/lib/firebase/invitations.ts:79. Matches the M5 fix already shipped in Story Map v0.29.2 / GanttApp v0.22.2 / Scheduler v0.42.6 / CFD v0.12.2 / Forecaster / AHP.',
          'M5: rules — myscrumbudget_projects field allowlist. Added a myScrumBudgetProjectFields() helper enumerating the 14 legitimate keys (mirrored from firestoreRepo.ts createProject / saveProject / importAll) plus keys().hasOnly() on create and affectedKeys().hasOnly() on update. Rejects any unknown field at the rule layer; allowlist must stay in sync with the converter.',
          'M6: useCloudSync listener error logs narrowed to error code only. Both onSnapshot error callbacks for the projects query and the per-user settings doc previously logged the full FirestoreError object, whose serialization frequently includes the document path (e.g., permission-denied at /myscrumbudget_projects/abc123). A malicious browser extension scraping console output could harvest project IDs. Now logs only (err as { code?: string })?.code ?? "unknown".',
          'M7: XLSX export title/metadata cells sanitized. Applied xlsxSanitize to the title cell and row-2 metadata line even though both currently sit inside a static prefix that shields formula evaluation today. Hardens against a future refactor that drops or reorders the prefix.',
        ],
      },
      {
        title: 'Security — Low',
        items: [
          'L1: legacy SharingSection + sharing.ts paths deleted. See H1 above for the deletion details.',
          'L2: SESSION_KEY cleanup on cloud-flip rejection. useInvitationLanding\'s Effect 2 IIFE catch block now drops msb:invite-session from sessionStorage immediately rather than relying on the 30s timer fallback.',
          'L3: SESSION_KEY cleanup on sign-out mid-claim. New Effect 2b in useInvitationLanding: when user becomes null while state === "claiming", clear the stale token and reset state to "idle". Without this, a sign-out + sign-in within the 30s timer window could re-enter the flow with the previous user\'s token.',
          'L4: [sharing] log hygiene. getProjectMembers no longer interpolates the failing UID into its console.warn message and now logs only the error code.',
          'L5: [profileWrites] log hygiene. writeSpertsuiteProfile and writeMyscrumbudgetProfile now log only the error code on failure, not the full FirebaseError.',
          'L6: sessionStorage cleared on sign-out. Added a SESSION_CLEAR_ON_SIGN_OUT array beside CLEAR_ON_SIGN_OUT in signOutCleanup.ts and a matching loop in performSignOutCleanup. Closes the leak where msb:invite-session (a per-tab invite token) survived a same-tab sign-out and would surface to the next signed-in user.',
          'L7: bare signOut() export removed from src/lib/firebase/auth.ts. The wrapper had no callers and was a footgun — autocomplete-driven imports could bypass performSignOutCleanup and revoke credentials without clearing localStorage / sessionStorage / storage mode / repo. All sign-outs now route through performSignOutCleanup (or useAuth().signOut, which calls it).',
          'L8: passive token expiry routes through performSignOutCleanup. AuthProvider.subscribeToAuth now tracks a previousUserRef and, on transition from non-null → null without an explicit signOut(), fires performSignOutCleanup. An idempotency flag inside performSignOutCleanup makes the explicit-then-passive double-call safe (the second invocation short-circuits). Closes the gap where a passive expiry would leave a debounced save firing against a revoked credential plus localStorage/storage-mode pointing at the previous user\'s session.',
          'L9: defensive comments in useDebouncedSave. Both save() and flush() console.error sites now carry a comment explaining that value (the closed-over T) MUST NOT be added to the log because it can contain member emails / UIDs. Future-maintainer trap mitigation.',
          'L10: resend-cap UX-only-disable comment in BulkSharingSection. Documents that the disabled={atCap} button is UX only — the 5×/invitation cap is enforced authoritatively by the resendInvite Cloud Function plus allow write: if false on spertsuite_invitations.',
          'L11: Excel import length caps. excelImport.ts row-parse loop now rejects rows where the name exceeds 200 chars or the role exceeds 100 chars with a new E10 error code. Replaces a cryptic post-save Firestore-1MB-doc-limit error with a clean parse-time rejection.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '939 passing across 62 test files (was 911 / 59). New test files: safeJsonParse.test.ts (6 tests), sanitizeImport.test.ts (7 tests), excelExport.sanitize.test.ts (7 tests). Extended invitations.test.ts with 8 new tests covering the M3 runtime input validation paths (empty modelId, oversized modelId, role: owner, role: arbitrary string, empty emails array, oversized emails array, empty tokenId, oversized tokenId).',
        ],
      },
      {
        title: 'Out of scope / deferred',
        items: [
          'L12 (useProject undo/redo nested-setState pattern): no security impact. Existing investigation-flag comment from v0.28.1 remains. Revisit before any React major upgrade or strict-mode tightening.',
          'All dependency upgrades: every non-current dep was inside the 60-day hold window per the v0.28.1 audit. Unchanged in v0.28.2.',
        ],
      },
    ],
  },
  {
    version: '0.28.1',
    date: '2026-05-09',
    sections: [
      {
        title: 'Refactored',
        items: [
          'Extracted Excel-import diff logic from ResourcePlanExcelPanel.tsx into src/features/reforecast/lib/importDiff.ts. The two pure helpers computeImportDiff and countAllocationDiffs (and the ImportDiff interface) are pure data transforms with typed inputs/outputs and no React or UI state — they were doing the heaviest lifting in the file (member matching by lowercased name, fallback-to-Unknown logic, symmetric-diff allocation counting) but couldn\'t be unit-tested through the component surface. Moving them to a sibling library file shrinks the panel from 486 → 328 LOC and unlocks direct testing. ResourcePlanExcelPanel.tsx now imports computeImportDiff and the ImportDiff type from ../lib/importDiff. warningToToastMessage, slug, and ImportConfirmDialog stay in the parent file — no reuse surface and tightly coupled to the panel\'s render path.',
        ],
      },
      {
        title: 'Fixed',
        items: [
          'useDebouncedSave.flush() now wraps the synchronous saveFn call in Promise.resolve(...).catch(...) to match the existing pattern in the debounced save() callback. saveFn is typed (value: T) => void, but real callers (notably persistProject in useProject) return a Promise. When the user triggered an undo/redo (which calls flush() to bypass the 500ms debounce) and the underlying Firestore save rejected — permission change, network drop, etc. — the rejection became an unhandled-promise warning rather than a logged error. flush() now logs the same [useDebouncedSave] flush failed: prefix that save() already used.',
        ],
      },
      {
        title: 'Tidy',
        items: [
          'Loosened stripUndefined\'s generic constraint from <T extends Record<string, unknown>> to <T extends object> in src/lib/storage/firestoreUtils.ts. Interface types like FirestoreProjectDoc are not structurally assignable to Record<string, unknown>, which previously forced two callers in firestoreRepo.ts (createProject, project import) to use `as unknown as Record<string, unknown>` double casts. The function body iterates Object.entries(obj) so the runtime is unchanged; only the call-site type signatures get cleaner. Both double casts removed.',
          'Investigation-flag comments added at two sites that work today but warrant a second look before adjacent changes: (1) useProject.ts undo/redo nest setRedoStack/setProject/setUndoStack updaters in a way that technically violates React\'s "updaters are pure" contract — revisit before any React major upgrade or strict-mode tightening; (2) firestoreRepo.ts saveProject/createProject invoke repo.getTeamPool() through the delegating module — revisit before introducing any concurrent or cross-tab path that could swap the active repo while a save is awaiting the pool snapshot. No behavior change in either case.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '911 passing across 59 test files (was 899 across 58). New: src/features/reforecast/lib/__tests__/importDiff.test.ts covering computeImportDiff (case-insensitive pool match + assignment-id reuse, fallback-to-Unknown when role is not in laborRates, role kept when it matches a labor rate, orphaned existing assignments → removedCount, only emits new allocations for value > 0, detects allocation changes vs. active reforecast) and countAllocationDiffs (identity case, increase, removal, newly-added month, assignment-id rotation with stable poolMemberId/value as a non-change). Extended useDebouncedSave.test.ts with a flush() rejected-promise path that asserts console.error fires with the [useDebouncedSave] flush failed: prefix.',
        ],
      },
    ],
  },
  {
    version: '0.28.0',
    date: '2026-05-08',
    sections: [
      {
        title: 'Added',
        items: [
          'Feature flag enabled — bulk invitations live in production as of 2026-05-08.',
          'Bulk project invitations. Project owners can invite collaborators by email from the project Sharing section: paste a list of emails (separated by commas, spaces, or newlines), pick a role (Editor or Viewer), and send. Existing SPERT Suite users are auto-added as members; new users receive a one-click join link via email.',
          'Pending invitations list: each pending row shows the invitee email, role, and resend counter (N/5). Owners can Resend (capped at 5 per invitation) or Revoke (with a ConfirmDialog). Resend success shows an inline "Invitation re-sent." confirmation that auto-clears after ~3 seconds.',
          'Result chips render after each send: green Added (auto-added existing user), blue Invited (new user, email sent), red Failed (CF rejected — rate limit, malformed, etc.), amber Invalid (client-side EMAIL_RE rejection — these never hit the CF, so the textarea retains its content for correction).',
          'New /?invite=<token> URL handler: when a user lands on MyScrumBudget via an invite email link, an InvitationBanner appears as a centered card above the page content. Pre-auth state shows Sign in with Google / Microsoft buttons (powered by the new shared useSignInWithTosGate hook). After sign-in, the banner transitions through Verifying → "You now have access to: <project name>" or a 30-second-grace timeout to a "didn\'t match your account" failure message.',
          'Backed by four Firebase Functions in the shared spert-suite project (us-central1): sendInvitationEmail, claimPendingInvitations, revokeInvite, resendInvite. The daily expireInvitations scheduled function (03:00 UTC) sweeps stale pending invitations to expired across all SPERT apps automatically.',
        ],
      },
      {
        title: 'Changed (flag-independent — ships in all v0.28.0 builds)',
        items: [
          'User profiles dual-written to spertsuite_profiles on every auth resolution. The new cross-app collection enables email→uid lookup for the invitation system. Writes are fire-and-forget; failures are warned to the console but do not block sign-in. Privacy-relevant: every signed-in MSB user now has a doc in this shared collection (displayName normalized via getFirstName, email lowercased, photoURL).',
          'myscrumbudget_profiles write moved from auth.ts ensureProfile() into AuthProvider.onAuthStateChanged. Previously the profile write only happened at explicit signInWithPopup resolve; it now runs on every auth resolution including page reloads. Returning users\' lastLogin timestamp updates on every page load. Body preserved verbatim from ensureProfile (no normalizeDisplayName, "" email fallback, conditional createdAt) — this is a move, not a refactor.',
          'AuthProvider callback ordering fixed: setLoading(false) now fires BEFORE setUser(user) inside subscribeToAuth\'s callback. React 18 batches the two synchronous state updates, but the order matters for downstream effects with deps [user] or [loading] — they now see a clean (loading=false, user=X) transition in a single render instead of an intermediate (loading=true, user=X) state.',
          'TOS-gated sign-in logic deduplicated. The pendingProvider/showTosModal/handleSignIn/handleTosAccepted pattern previously inlined separately in CloudStorageModal.tsx and CloudStorageSection.tsx is now in a shared useSignInWithTosGate hook. Behavior identical: auth/popup-closed-by-user and auth/cancelled-popup-request silent-return; auth/popup-blocked surfaces an inline "Pop-up was blocked..." message; all other errors flow through sanitizeFirebaseError. Both consumers refactored to use the hook.',
          'Cloud-flip helpers extracted to src/lib/storage/cloudFlipHelpers.ts. setHasUploaded and getHasUploaded were duplicated as private functions in both cloud storage components; they are now shared exports so the new useInvitationLanding hook can flip storage mode on invite arrival without re-implementing the same localStorage protocol.',
          'New shared invitation modules: src/lib/firebase/profileWrites.ts (writeSpertsuiteProfile and writeMyscrumbudgetProfile, each with intentional asymmetry comments), src/lib/firebase/claimPendingInvitations.ts (claimPendingInvitationsAndNotify with emailVerified/db/functions guards and Lesson 27 payload gate before dispatching spert:models-changed), src/lib/firebase/invitations.ts (listPendingInvites filtering on (inviterUid, modelId) per Lesson 52, removeCollaborator with three-guard runTransaction per Lesson 50, async callable wrappers with requireFunctions() null-check, mapInvitationError with context discriminator per Lesson 13).',
          'src/hooks/useInvitationLanding.ts: state machine driving the InvitationBanner (idle → pre_auth → claiming → claimed | failed). Module-level captureInviteTokenFromUrl() captures ?invite= synchronously at import time before MigrationGuard\'s null-render can block the banner from mounting. SESSION_KEY consumed on claimed transition, on auto-fail timer, and on dismiss — page reload after any of these does NOT re-show the banner. Effect 5 filters claimed[] to MSB-only (cross-app claims still happen server-side; only the MSB banner display is per-app).',
        ],
      },
      {
        title: 'Performance',
        items: [
          'Parallelized getProjectMembers profile lookups. The legacy serial for-of loop with await getDoc inside scaled wall-time as O(N) round-trips. Now uses Promise.allSettled across all member uids — wall-time drops to O(1) round-trips. A rejected per-uid lookup is logged to console.warn and the member is still surfaced with empty displayName/email (matches prior per-uid try/catch fallback). The existing SharingSection benefits from this immediately; BulkSharingSection inherits it.',
        ],
      },
      {
        title: 'Security',
        items: [
          'CSP connect-src expanded to include https://*.run.app. Firebase Functions v2 callables may resolve to either *.cloudfunctions.net or *.run.app at runtime; without *.run.app, Cloud Run-backed callables would be blocked in production only (localhost cannot detect this). Slated for narrowing to a more specific pattern (likely *.uc.a.run.app for us-central1 v2) in a follow-up commit before the feature flag flips.',
          'New runTransaction-based removeCollaborator in src/lib/firebase/invitations.ts replaces the legacy updateDoc-based removeProjectMember (which only had Guard 3, owner-target). The new function adds Guard 1 (self-removal pre-check, before transaction) and Guard 2 (caller-must-be-owner, defense-in-depth inside the transaction read). UI is owner-gated, so Guard 2 should never fire in normal use; it logs a console.warn if it does ("non-owner attempted remove — UI gating bypass?"). First use of runTransaction in the MSB codebase.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '899 passing across 58 test files (was 863 across 53). New: parseBulkEmails (10 cases — delimiter variants, dedup, empty input, mixed valid/invalid), invitations.ts (10 cases — three guards × two failure paths × happy path × null-functions guard × Lesson 13 mapInvitationError context discriminator), claimPendingInvitations (4 cases — emailVerified guard, payload gate, success dispatch, console.error on CF failure), profileWrites (7 cases — null email skip, lowercased email, normalized displayName, no uid field, serverTimestamp after spread, conditional createdAt, "" fallback for legacy compatibility), captureInviteTokenFromUrl (5 cases — happy path, enabled=false no-op, no-?invite= no-op, idempotency, fragment preservation). vi.hoisted profileWrites mock template documented but skipped — Step 0c audit found zero AuthProvider tests render <AuthProvider>.',
        ],
      },
    ],
  },
  {
    version: '0.27.1',
    date: '2026-05-06',
    sections: [
      {
        title: 'Fixed',
        items: [
          'Tightened print/PDF report column alignment and label/value spacing. The three executive-summary tables on page 1 (Project Summary, Active Reforecast, Forecast Metrics) previously rendered as independent <table> elements with no fixed column widths, so each table auto-sized its 4 columns from its own content. Two visible problems: (1) cross-section zig-zag — column edges landed at different X positions across sections because Project Summary stretched its label column to fit "Estimate to Complete (ETC)" while Forecast Metrics only needed enough room for "Budget Ratio"; (2) within each row, labels and their values sat at opposite edges of a half-width band with a large dead gap between them.',
          'Five-track shared layout — all three tables now use a shared <colgroup> of 27% / 14% / 18% / 27% / 14% (label-L | value-L | GAP | label-R | value-R) with table-layout: fixed via the table-fixed Tailwind class. Each value sits directly next to its own label, the two label/value pairs are separated by a visible 18% whitespace channel in the middle, and column edges line up at identical X positions across all three sections regardless of label length.',
          'Each row renders five <td>s with an empty aria-hidden spacer cell at index 2 to occupy the gap track. Page-side margins are unchanged (still set by @page in globals.css).',
          'Value cells (column 2 and column 5) are right-aligned. Currency stacks cleanly — $250,000 over $20,000 align by their last digit, which is the standard convention for financial reports. The colored EAC value cell on the Project Summary row keeps its RAG color and bold weight, just right-aligned now.',
          'Print-only label tweaks so the longest labels comfortably fit the narrower 27% label column without crowding their numeric values: "Estimate to Complete (ETC)" → "Est. to Complete (ETC)", "Estimate at Completion (EAC)" → "Est. at Completion (EAC)", and "NPV" → "Net Present Value" (the acronym is not otherwise explained in the printed report). The on-screen ProjectSummary and ForecastMetricsPanel keep their full "Estimate" / "NPV" labels — these tweaks are scoped to PrintableReport.tsx only.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '863 passing across 53 test files (no test changes — purely a print-only CSS/layout adjustment with no behavioral surface).',
        ],
      },
    ],
  },
  {
    version: '0.27.0',
    date: '2026-05-06',
    sections: [
      {
        title: 'Added',
        items: [
          'Violet "Under Budget" health status. A fourth dashboard status indicator activates when a project\'s EAC tracks more than a user-configurable percentage below its baseline budget (default: 20%). The business trigger: teams running materially under budget often need to issue a formal change request to sponsors and stakeholders. Configure in Settings → Dashboard Thresholds → "Violet under (%)".',
          'Boundary semantics for violet are exclusive (variancePercent === -20 stays green; variancePercent < -20 is violet), symmetric with the existing amber/red boundaries. The amber/red over-budget logic is unchanged — only the previously-always-green under-budget half is split into green (within violet threshold) and violet (beyond it).',
          'Violet display surface area: dashboard project cards, project detail summary, and the printable PDF report all render the violet dot indicator (●) and "Under Budget" label using text-violet-600 / dark:text-violet-400 (text-violet-700 in print, light-only).',
          'Settings → Dashboard Thresholds gained a "Violet under (%)" input row beneath the existing red row, plus an inline warning when violetPercent === 0 ("any under-budget project will trigger Violet"). The legend paragraph beneath the inputs documents all four bands.',
        ],
      },
      {
        title: 'Fixed',
        items: [
          'Cloud-mode users with pre-v0.27.0 Firestore settings docs would have read trafficLightThresholds without violetPercent — the existing data.trafficLightThresholds ?? DEFAULT_SETTINGS.trafficLightThresholds short-circuit returns the truthy LHS object, so the violet field was never injected on first load. firestoreRepo.ts:56 now uses a merge-with-defaults pattern: { ...DEFAULT_SETTINGS.trafficLightThresholds, ...(data.trafficLightThresholds ?? {}) }. User-customized amberPercent/redPercent values still survive the merge; missing violetPercent gets the 20 default. localStorage-mode users get the same outcome via the v0.13.0 migration.',
          'Form-control hygiene sweep on ThresholdSettings.tsx: the existing amber and red inputs gained autoComplete="off" (matching the standing form-hygiene rule). The new violet input also gets it.',
        ],
      },
      {
        title: 'Migration',
        items: [
          'Data migration v0.13.0 backfills violetPercent: 20 into all existing trafficLightThresholds objects. The migration is conservative: it spreads existing thresholds first so user-customized amberPercent/redPercent values are preserved, and only injects violetPercent when absent (a user who somehow already has a customized value keeps it).',
          'The historical v0.7.0 migration (which originally introduced trafficLightThresholds) is unchanged — the v0.13.0 migration runs after it in all upgrade paths.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '863 passing across 53 test files (+13 net additions). New coverage: getTrafficLightStatus boundary tests (vp = -20 green, vp = -20.1 violet), zero-threshold edge case (any under-budget triggers violet), high-threshold edge case (-99 stays green when threshold is 100), NaN regression test (degenerate metrics return green not violet), getTrafficLightDisplay("violet") shape, validateAppState rejection of missing/negative violetPercent, three new v0.13.0 migration tests (backfill, idempotency on user-customized value, preservation of amber/red).',
          'Bulk-bumped 28 migrations.test.ts assertions from 0.12.0 → 0.13.0 (final-state assertions only; intermediate-state assertions like "v0.11.0 → v0.12.0 as a no-op" were updated explicitly to acknowledge that v0.13.0 now adds violetPercent to settings).',
        ],
      },
    ],
  },
  {
    version: '0.26.4',
    date: '2026-05-03',
    sections: [
      {
        title: 'Fixed',
        items: [
          'Form-field hygiene residual sweep. The v0.26.3 pass added autoComplete to four inputs but left a substantial backlog of Chrome DevTools form/accessibility warnings: 13 unassociated <label> elements (label sibling, no htmlFor, no implicit wrap), and ~32 <input>/<textarea>/<select> elements missing both id and name. This release closes those gaps. Goal: opening Chrome DevTools Issues panel on any page produces zero form-field-related entries.',
          'Forms with unassociated labels (ProjectForm, SharingSection, AddPoolMemberForm, ThresholdSettings, ProductivityWindowPanel add-form) now use the established useId() + htmlFor pattern (matching BaseDialog, CloudStorageModal, ReforecastNotes, ExportAttribution, SettingsForm, NewReforecastDialog, ReforecastToolbar). One useId() per component, suffixed per field. Fields also got semantic name= attributes (projectName, projectStartDate, baselineBudget, shareInviteEmail, memberName, amberThresholdPercent, addProductivityWindowStart, etc.).',
          'Tabular edit/add inputs (HolidayTable 6 inputs + 1 bulk-year checkbox, RateTable 4 inputs, PoolMemberTable edit name, ProductivityWindowPanel 6 edit-row inputs) got name= attributes. No <label> was added because the column headers serve as the visual labels per standard tabular UX.',
          'Standalone inputs with existing aria-labels (HistoricalCostsTable cost cell, ReforecastNotes textarea, ResourcePlanExcelPanel file input) and bare-context inputs (ProjectSummary inline edit, AllocationGridAddRow member-picker select, AllocationGridRow grid cell, DataPortability import-JSON file, LocalStorageWarningToggle checkbox, TosConsentModal checkbox) all got semantic name= attributes.',
          'ReforecastToolbar orphan htmlFor fixed. When editingName is true, the <select id="rf-select"> unmounts and <input id="rf-name-edit"> mounts in its place, but the surrounding <label htmlFor="rf-select"> was left pointing at the now-unmounted control. The label\'s htmlFor is now driven dynamically based on editingName, so the label always associates with whichever control is rendered.',
        ],
      },
      {
        title: 'Architecture',
        items: [
          'RoleSelect shared wrapper extended. Added optional id?: string prop (default undefined). The wrapper now always sets name="role" internally, so both call sites (AddPoolMemberForm, PoolMemberTable edit row) satisfy Chrome\'s id-or-name rule via the wrapper rather than per-call-site. Backward-compatible: existing callers without id continue to render unchanged.',
        ],
      },
      {
        title: 'Adjacent accessibility fixes (in passing)',
        items: [
          'Added aria-label to four form controls while editing them for name=/id=: ProjectSummary inline-edit input (label-as-aria for the input itself, since the wrapping role="button" container\'s aria-label only covers the static state), AllocationGridAddRow member-picker select ("Add team member to reforecast"), AllocationGridRow grid cell ("Allocation for {name} in {month}"), ResourcePlanExcelPanel and DataPortability file inputs.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '850 passing across 53 test files (no test additions or removals; same suite, all green).',
        ],
      },
    ],
  },
  {
    version: '0.26.3',
    date: '2026-05-03',
    sections: [
      {
        title: 'Fixed',
        items: [
          'Surface Firestore write errors to the user. Routine settings, project, and team-pool saves go through useDebouncedSave, which previously caught every save failure with a silent console.error — a user editing a project offline (or with revoked Firestore permissions) saw no signal that their work was not persisted. Each consumer hook (useSettings, useTeamPool, useProject) now wraps its repo.save* call with a try/catch that emits a red error toast before rethrowing so useDebouncedSave\'s existing console log still fires.',
          'Surface Firestore real-time listener errors to the user. Both onSnapshot listeners in useCloudSync (projects query, per-user settings doc) now register error callbacks. On listener termination — permission rule change, network drop, invalid query — the handler logs to console and shows a red toast ("Cloud sync connection issue. Recent changes may not appear until reconnect."). A per-effect-cycle flag suppresses duplicate toasts when both listeners fail in the same tick. An inline comment notes that no automatic resubscribe runs — full reconnect is deferred and the user must reload or re-sign-in.',
          'Add autoComplete to four form inputs. <input type="email"> in the project Sharing section (collaborator invite) now has autoComplete="off", eliminating the unconditional browser DOM warning. Export Attribution Name field gets autoComplete="name" (user\'s own name; browser autofill is correct UX). Team Pool add-member name field and the inline edit-name field both get autoComplete="off" (third-party name; browser autofill of the user\'s saved name would be wrong).',
        ],
      },
      {
        title: 'Architecture',
        items: [
          'addToastGlobal escape hatch added to Toast.tsx. A module-level pointer that the active ToastProvider registers on mount and clears on unmount; while no provider is mounted (e.g. test harness rendering a hook directly), calls are no-ops with a console breadcrumb. Lets non-context consumers — bare-rendered hooks in tests, listener callbacks outside provider scope — surface toasts without altering hook signatures or test setup. The existing useToast() context API is unchanged.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '850 passing across 53 test files (no test additions or removals; same suite, all green).',
        ],
      },
    ],
  },
  {
    version: '0.26.1',
    date: '2026-04-30',
    sections: [
      {
        title: 'Added',
        items: [
          'Branded favicon and header icon. New spert-favicon-myscrumbudget.png (192×192 PNG, green #16a34a panels with rounded corners) replaces the default Next.js favicon as the browser tab icon and now appears to the left of the app name in the sidebar header. A charcoal dark-mode variant (spert-favicon-myscrumbudget-dark.png) auto-swaps when the active theme is dark, driven by the existing useDarkMode() hook.',
        ],
      },
    ],
  },
  {
    version: '0.26.0',
    date: '2026-04-30',
    sections: [
      {
        title: 'Added',
        items: [
          'Undo / Redo on the project detail page. Every mutation that flows through updateProject (allocation edits, assignment add/remove, productivity windows, actuals, baseline, reforecast metadata, notes, etc.) now pushes a snapshot onto a session-scoped undo stack. Ctrl+Z undoes, Ctrl+Shift+Z redoes — also Cmd+Z / Cmd+Shift+Z on Mac. Stack depth is capped at 50 (UNDO_STACK_LIMIT); history clears on navigation away from the page (in-memory only, never persisted).',
          'Undo and Redo toolbar buttons in the project page header, positioned between Print and the trash icon. Buttons are disabled (not hidden) when their respective stacks are empty so the toolbar layout stays stable; both are excluded from the print report.',
          'Commit-based grouping for the notes textarea. Focusing the notes field calls beginUndoGroup() which pushes one pre-edit snapshot and sets a guard ref; while the guard is active, subsequent updateProject calls during typing skip pushing. Blur calls endUndoGroup() which clears the guard. Net effect: an entire notes editing session — however many keystrokes — costs exactly one undo entry.',
          'Mid-edit undo/redo correctness. Both undo() and redo() clear the group flag at the very top, so a Ctrl+Z while the textarea is still focused leaves the user able to keep editing with a fresh undo entry seeded on the very next keystroke. The seeding is driven defensively from onChange (not just onFocus), since onFocus does not refire when the same focus session resumes typing after a mid-edit undo. Without these two coupled pieces, post-undo typing would be unrecoverable.',
          'Ctrl+Z and Ctrl+Shift+Z entries added to the Global group in the keyboard shortcuts dialog (Ctrl+?).',
        ],
      },
      {
        title: 'Changed',
        items: [
          'useProject hook surface extended with undo, redo, canUndo, canRedo, beginUndoGroup, endUndoGroup. Existing callers (updateProject, flush) unchanged — purely additive. Snapshots store Project references directly rather than deep clones; the existing spread-based mutators guarantee the live tree never mutates a snapshot in place. cloudSyncBus reloads bypass updateProject entirely, so inbound cloud-sync updates correctly do NOT enter the local undo history.',
          'useKeyboardShortcut shift option is now tristate. shift: true requires Shift to be pressed, shift: false requires Shift to be ABSENT, and shift: undefined matches either (the previous default, preserved for backward compatibility with the Ctrl+? registration in the sidebar). Without the false case, registering Ctrl+Z for undo would also fire on Ctrl+Shift+Z and cancel the redo handler.',
          'undo() and redo() bypass the 500ms debounce. They call persistProject(snapshot) followed immediately by flush(), so the restored snapshot is durable on the wire (localStorage or Firestore) before the function returns — no stale debounce can clobber it later.',
        ],
      },
      {
        title: 'Architecture',
        items: [
          'Single intercept point. All undo/redo bookkeeping lives in updateProject and the four group/operation callbacks on useProject. No mutation site outside the hook is undo-aware. Snapshots are pushed pre-update (so undo restores to "the state before this mutation"), and the redo stack is invalidated on every fresh user mutation.',
          'Stack containers chosen for re-render semantics. undoStack and redoStack are useState<Project[]> so the derived canUndo / canRedo flags trigger toolbar button enable/disable on push and pop. undoGroupActiveRef is a useRef<boolean> so toggling it on every keystroke\'s surrounding focus/blur cycle does NOT cause re-renders.',
          'New shared icons. UndoIcon and RedoIcon added under src/components/icons/ matching the existing Heroicons-style pattern used by TrashIcon, PencilIcon, etc.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '830 → 850 passing across 53 test files (+20 net additions, no removals). useProject.test.ts (new file, 13 tests) covers: initial load, undo/redo round-trip, redo clearing on new mutation, no-op undo/redo on empty stacks, single-entry grouping for beginUndoGroup/endUndoGroup, idempotency of beginUndoGroup, mid-group undo correctly clears the flag for continued editing, UNDO_STACK_LIMIT cap (60 mutations → 50 retained), synchronous persistence of restored snapshots via flush(), and the cloudSyncBus reload-does-not-push invariant. ReforecastNotes.test.tsx (new file, 6 tests) covers expand/collapse, value forwarding, onBeginEdit/onEndEdit on focus/blur, defensive onBeginEdit on every keystroke, and graceful operation without optional callbacks. ShortcutsDialog.test.tsx extended with one assertion covering the new Undo/Redo entries.',
        ],
      },
    ],
  },
  {
    version: '0.25.0',
    date: '2026-04-29',
    sections: [
      {
        title: 'Added',
        items: [
          'Archive / Unarchive pool members. PoolMember gains an optional archived?: boolean flag. Archived members disappear from the "+ Add member" picker dropdown everywhere — both new project rows and existing reforecasts — but continue to render normally in any saved reforecast that already references them. Historical integrity is preserved at the resolveAssignments boundary (the resolver drops the archived flag when producing TeamMember[]), so charts, EVM metrics, and AllocationGrid rows treat archived members identically to active members. The archive flag lives only on PoolMember; it never enters ProjectAssignment, TeamMember, or Firestore _teamSnapshot.',
          'Show archived (N) toggle on the Team Pool page. When the pool contains any archived members, a small toggle appears above the table; clicking it reveals a second band of archived rows below the active rows, separated by a dashed divider. Archived rows are visually muted (opacity-60) but not strikethrough — strikethrough reads as "deleted" and would mis-signal. Each archived row gets an "Unarchive" action where active rows show "Archive."',
          'Inline Archive button on delete-blocked errors. When the user attempts to delete a pool member who is referenced in any reforecast, the per-row error message now offers an "Archive instead" button right next to the offending row (instead of the previous global red banner above the table). One click archives the member and clears the error. Archived-but-still-in-use members get a different error message and no Archive button (they are already archived).',
          'AddPoolMemberForm archived-name collision dialog. Typing the name of an archived member surfaces a new "Archived Member Found" dialog with three actions: Unarchive (reactivates the existing pool entry), Add as new (creates a new active member with the same name), or Cancel (preserves the typed input for editing). The pre-existing duplicate-name dialog for active members is unchanged.',
          'Excel resource plan import auto-unarchive (W5). When an imported row\'s name matches an archived pool member (case-insensitive), the importer now reactivates that member rather than creating a duplicate. Surfaces as a new soft warning W5 ("Archived member \\"X\\" was reactivated because they appeared in the imported resource plan.") via toast. The W5 warning rides the existing ImportWarning discriminated union and is dispatched through the same warningToToastMessage pipeline as W1–W3. W2 (role mismatch) still fires independently if the Excel role differs from the pool role.',
        ],
      },
      {
        title: 'Changed',
        items: [
          'useTeamPool.deletePoolMember return type extended from { ok: boolean; reason?: string } to { ok: boolean; reason?: string; canArchive?: boolean }. The new canArchive signal lets the UI render the inline Archive button without re-deriving membership state. canArchive is true only when the in-use guard fires AND the member is not already archived. Reason copy now explicitly mentions archiving as the alternative path.',
          'PoolMemberTable refactored to a two-band layout (active rows above, archived rows below the dashed divider) with per-row delete-error display. The previous global error banner is replaced with a Fragment-wrapped error <tr> rendered immediately after the offending member\'s main <tr>. The same Fragment pattern is applied to BOTH the active band and the archived band so a delete attempt on an archived member surfaces its error inline next to the right row.',
        ],
      },
      {
        title: 'Storage',
        items: [
          'DATA_VERSION bumped 0.11.0 → 0.12.0. New no-op migration entry follows the v0.9.0 shape exactly (assertArray on teamPool, version stamp). The archived field is optional and defaults to "active" when absent — no backfill is required or desirable. Existing v0.11.0 data round-trips through the migration unchanged except for the version field.',
          'Strict import validator (validatePoolMember) now type-checks the optional archived field: must be boolean if present. Lenient localStorage guard (isValidPoolMemberArray) is intentionally unchanged — basic-shape lenient checks permit unknown fields for back-compat.',
          'No Firestore rules change required. PoolMembers are nested inside the owner-scoped myscrumbudget_settings/{userId} doc with no field-level allowlist; archived rides along with the existing teamPool array.',
        ],
      },
      {
        title: 'Architecture',
        items: [
          'The picker filter (.filter(pm => !pm.archived)) lives ONLY in AllocationGridAddRow — never upstream. Lifting the filter to useTeam, the project page, or resolveAssignments would silently break historical reforecasts: any saved assignment referencing an archived poolMemberId would render as "(Unknown)" because the resolver could no longer find the member in the filtered pool. An inline comment at the filter site warns future refactors not to lift it. Tests in AllocationGrid.test.tsx lock this invariant: an archived member who is also in teamMembers (resolved from a saved assignment) renders normally even while being excluded from the picker.',
        ],
      },
      {
        title: 'Tests',
        items: [
          '811 → 830 passing across 51 test files (+19 net additions). useTeamPool tests cover archive/unarchive state mutation and all four deletePoolMember outcomes (unassigned active, unassigned archived, assigned active with canArchive: true, assigned archived with canArchive: false). team.test.ts adds the historical-integrity proof: an archived member referenced in two reforecasts resolves with full name/role in both. teamResolution.test.ts asserts the archived flag is dropped at the resolver boundary (deep equality, no extraneous keys). AllocationGrid.test.tsx covers picker exclusion, all-archived empty-state, and the archived-row-renders-normally case. validation.test.ts covers archived: true, archived: false, missing field, and non-boolean rejection. migrations.test.ts covers the v0.11.0 → v0.12.0 no-op migration and v0.12.0 idempotency. excelImport.test.ts adds W5 emission and the W1-vs-W5 mutual-exclusion proof (matched archived member must NOT also emit W1, otherwise the importer would create a duplicate).',
        ],
      },
    ],
  },
  {
    version: '0.24.0',
    date: '2026-04-29',
    sections: [
      {
        title: 'Refactored',
        items: [
          'Reforecasts now own their team roster. assignments: ProjectAssignment[] moved from Project to Reforecast — each reforecast becomes a true point-in-time snapshot. Removing a member from the active reforecast no longer rewrites historical reforecasts; the same pool member can be on the team in one reforecast and absent in another. Allocation linkage is preserved because assignment IDs remain stable when reforecasts are cloned (createNewReforecast deep-clones source assignments preserving IDs).',
          'Migration v0.10.0 → v0.11.0 copies the existing project-level assignments verbatim (same IDs) into every existing reforecast that doesn\'t already have its own assignments array. Idempotent on re-run, allocation linkage preserved, no manual fix-up required.',
          'Firestore docToProject() gains a backward-compat read path: legacy docs (schemaVersion: 1, top-level assignments) hydrate into reforecast-scoped assignments on load. New writes use schemaVersion: 2 and never write the top-level field. Per-reforecast assignments win when both legacy and modern fields are present (idempotency).',
          'useTeam hook fully rewritten to mutate only the active reforecast (private withActiveReforecast helper). useTeamPool delete-guard now scans across all reforecasts of all projects to detect in-use pool members.',
          'validateAssignment moved from validateProject to validateReforecast — error paths shift from projects[i].assignments[k] to projects[i].reforecasts[j].assignments[k].',
        ],
      },
      {
        title: 'Added',
        items: [
          'Resource Plan Excel export/import. New collapsible section on the project detail page (below the allocation grid) lets resource managers round-trip the active reforecast\'s allocation grid as an .xlsx file. Powered by exceljs@^4.4.0.',
          'Export writes a "Resource Plan" worksheet with row 1 title (merged), row 2 metadata (project, reforecast, reforecast date, ISO timestamp), row 4 header (Name, Role, then one column per project month as YYYY-MM strings), and data rows with allocation cells in Excel\'s built-in 0% percentage format. Empty allocations export as 0 (rendered "0%"), never blank — resource managers need to see the cell. Freeze panes lock row 4 and the Name/Role columns. A hidden worksheet "_msb_meta" (state: veryHidden) carries a JSON identity tuple ({schema, appVersion, projectId, projectName, reforecastId, reforecastName, generatedAt}) consumed by import.',
          'Import validates the file structure, project identity, header row, and allocation cells. Hard errors block import: E1 (not .xlsx), E2 (missing Resource Plan sheet), E3 (missing/malformed _msb_meta — confirms the file originated from a MyScrumBudget export), E4 (project ID mismatch — prevents importing a different project\'s plan), E5 (header row 4 doesn\'t match expected months), E6 (row missing Name or Role), E7 (non-numeric allocation cell), E8 (allocation outside 0–100), E9 (duplicate Name, case-insensitive). Errors aggregate (not short-circuit) so users see every issue in one alert dialog.',
          'Soft warnings surface as toasts after a successful import, except W4 which is shown in the import-confirm dialog. W1: a new pool member was added (with role match) or with role "Unknown" (when role is not in labor rates — name renders red in AllocationGridRow). W2: an existing pool member\'s role differed in Excel — pool role kept, Excel role ignored. W3: a member was removed from the active reforecast (sibling reforecasts retain them — the snapshot semantics preserved by the Phase 1 refactor). W4: the Excel was exported from a different reforecast than the currently-active one — confirmation dialog includes the source vs. active names.',
          'Allocation interpretation is dual: 0 ≤ v ≤ 1 is treated as a decimal (Excel\'s percentage-formatted cell returns 0.75 for 75%), 1 < v ≤ 100 is treated as a whole-number percentage and divided by 100 (so a hand-typed 75 becomes 0.75). Anything outside 0–100 is a hard E8.',
          'AllocationGridRow renders the role text in red (text-red-600 / dark:text-red-400) when member.role === UNKNOWN_ROLE — a visual cue that the member came from an Excel import and needs a real labor-rate role assigned before cost calculations make sense.',
          'Pale yellow (#FFFF99) input-cell shading on every allocation cell in the exported Resource Plan sheet — financial-modeling convention signaling the edit zone to resource managers. Name and Role columns intentionally unshaded.',
          'New constants in src/lib/constants.ts: RESOURCE_PLAN_SHEET_NAME, RESOURCE_PLAN_META_SHEET_NAME, UNKNOWN_ROLE.',
        ],
      },
      {
        title: 'Fixed',
        items: [
          'AllocationGrid Remove Team Member confirmation dialog copy. Was "All allocations for this member across every reforecast will be lost" — incorrect after the v0.24.0 refactor since cascade is now scoped to the active reforecast only. Updated to "Their allocations in this reforecast will be lost. Other reforecasts are not affected."',
        ],
      },
      {
        title: 'Tests',
        items: [
          '775 passing → 811 passing across 51 test files (+36 net additions). v0.11.0 migration tests added covering all four edge cases (project with assignments, project with empty assignments, project missing assignments key, reforecast that already has its own assignments). firestoreUtils tests added for legacy schemaVersion:1 backward compat. Per-reforecast roster independence tests added to team.test.ts. excelExport tests cover header rows, percentage format, freeze panes, hidden meta sheet, merged title rows, and the FFFF99 input-cell fill. excelImport tests cover the happy path round-trip plus E1–E9, W1–W4, allocation interpretation matrix, trailing-blank tolerance, and error aggregation.',
        ],
      },
    ],
  },
  {
    version: '0.23.0',
    date: '2026-04-28',
    sections: [
      {
        title: 'Added',
        items: [
          'Per-chart Copy Image icon in the panel header. Each cost chart on the project detail page (Monthly Cost bar chart and Cumulative Cost line chart) gains an independent Heroicons document-duplicate icon button in the upper-right of its panel header, alongside the chart title. Clicking the button rasterizes the entire panel (rounded border + title + legend + SVG) to a 2x-scale PNG via html2canvas and writes it to the system clipboard via navigator.clipboard.write + ClipboardItem, then fires a success toast. The two buttons are entirely independent — separate useRef on each panel, separate handler, no shared state. The button itself is excluded from the capture by the html2canvas ignoreElements: el.classList.contains(\'copy-image-button\') predicate. Disabled in Firefox (which silently fails on image/png clipboard writes without an about:config opt-in) with an explanatory aria-label',
          'Print button on project detail pages. Page header gains a printer-icon + "Print" muted utility button (Heroicons printer outline, h-4 w-4) between Edit and Delete that calls window.print(). The browser\'s native print dialog opens with a "Save as PDF" destination available on macOS, Windows, and Chrome OS. No new route, no jsPDF dependency, no new test infrastructure — strictly browser-native printing',
          'PrintableReport component (src/components/PrintableReport.tsx) — hidden on screen via Tailwind hidden print:block, visible only in print. Compact 2-page layout: page 1 holds the executive summary (header + status banner + project summary + active reforecast + forecast metrics, all as dense 4-column label/value tables — no bordered tiles); page 2 begins via break-before-page and contains the Monthly Cost chart, Cumulative Cost vs Budget chart (both with forceLightMode={true}), Cost by Period table, and the footer. Header follows SPERT Scheduler\'s pattern: light-grayscale all-caps brand line "MYSCRUMBUDGET™ V0.23.0", project name, window dates, "Reforecast: {name}" scenario line, "Generated {timestamp}" line, and a horizontal rule divider',
          'Colored RAG (Red-Amber-Green) status indicator on the printed report. Renders as "● Status: On Track / At Risk / Over Budget" in green-700 / amber-600 / red-700 respectively (light-only color classes). Prints in actual color thanks to the print-color-adjust: exact rule on .print-report descendants. The EAC value in the Project Summary is also rendered in the matching RAG color so the headline number pops at a glance',
          'forceLightMode prop on MonthlyCostBarChart and CumulativeCostLineChart. Optional boolean (defaults to false) that overrides the useDarkMode() result so SVG inline fill/stroke attributes always render in light-mode colors regardless of the .dark class on <html>. The hook is always called (hooks-rules compliant); only the consumed value is overridden. PrintableReport passes forceLightMode={true} so charts print with their light palette even when the user is browsing the app in dark mode',
          '@media print block in globals.css. Uses display: none on chrome elements (nav, footer, button, [aria-live="polite"], a[href="#main-content"]), the :has(> .print-report) selector to hide siblings of the report inside its parent (class-agnostic — works regardless of the page wrapper className), main > *:not(:has(.print-report)) to hide non-ancestor direct children of <main>, layout reset on body/body>div/main to strip flex constraints so reports flow across pages, -webkit-print-color-adjust: exact + print-color-adjust: exact to prevent ink-saving wash-out, .print-section-keep page-break rule, and @page size: letter; margin: 0.5in. The :has() selectors deliberately do NOT use the (buggy) main:has(.print-report) *:not(.print-report):not(:has(.print-report)) pattern that would have hidden the report\'s own descendants',
          'Dynamic document.title on the project detail page. A useEffect builds the title as `${APP_NAME} for ${project.name} - ${formatDateLong(today)}` using local-time date construction (not toISOString) so the date doesn\'t drift to UTC\'s "tomorrow" on evenings west of GMT. The browser\'s native print page header (when "Headers and footers" is enabled) reflects this title — matches SPERT Scheduler\'s "SPERT Scheduler for Procurement Project - April 28, 2026" pattern. Restores the previous title on unmount or project change',
        ],
      },
      {
        title: 'Changed',
        items: [
          'Tooltip readability on both cost charts (ChartTooltip.tsx). Font text-xs → text-base (12 → 16 px), padding px-2 py-1 → px-3 py-2, width 140 → 220 px. The tooltip now auto-sizes its height based on a new optional lineCount prop (default 2) so the line chart\'s 2-line tooltip ends up ~72 px tall and the bar chart\'s blended-month 4-line variant ends up ~120 px tall — the line chart tooltip no longer floats far above the cursor because of unused vertical space. Vertical positioning is computed as Math.max(0, y - height - 8) so the tooltip\'s bottom edge always sits ~8 px above the hovered point regardless of content size. Tooltips are not printed and not captured by Copy Image — only visible during hover',
          'New dependency: html2canvas@1.4.1 (exact pin, no caret, for build reproducibility). Adds ~50 KB gzipped. Used only for the per-chart Copy Image feature; bundled statically because the cost is acceptable for the chart-bearing project detail route. The export helper (src/components/charts/export-chart.ts) wraps html2canvas with two important workarounds: (1) a neutralizeOklch onclone callback that walks the cloned DOM and rewrites Tailwind v4 modern color functions (oklch, oklab, lab, lch, color-mix, color()) into rgb()/rgba() because html2canvas@1.4.1 cannot parse them; (2) the lazy Promise<Blob> ClipboardItem form, which preserves the original user-gesture context across the html2canvas rasterization step (otherwise Chrome rejects the clipboard write as "not in a user gesture")',
          'CopyImageButton component (src/components/CopyImageButton.tsx) — reusable icon-only button with toast wiring. SSR-safe Firefox detection via typeof navigator !== \'undefined\' guard at module level. Required class hook copy-image-button on the rendered <button> so html2canvas\'s ignoreElements predicate can filter it from the capture',
        ],
      },
      {
        title: 'Tests',
        items: [
          'Baseline unchanged: 762 passing across 49 test files. Implementation is purely additive to the rendering tree — no existing assertions touch the affected props, DOM structure, or computed values. The Copy Image clipboard pipeline and PrintableReport rendering are validated manually in dev (matches SPERT Scheduler precedent for the same feature set)',
        ],
      },
    ],
  },
  {
    version: '0.22.5',
    date: '2026-04-28',
    sections: [
      {
        title: 'Added',
        items: [
          'EVM hover tooltips on the project summary card. The three EVM-coded tiles in the project summary row — Actual Cost, ETC, EAC — now expose the full earned value management term as a native HTML title tooltip on hover: "Actual Cost (AC)", "Estimate to Complete (ETC)", "Estimate at Completion (EAC)". The visible label text is unchanged so the 5-column tile row stays on a single line at every viewport width — an inline-label expansion was evaluated and rejected because the longer strings (26–28 chars) would have wrapped to two lines on a full-screen display while the shorter sibling labels (e.g. "Baseline Budget" at 15 chars) would not, producing visually uneven tile heights. Native title is a zero-layout-impact alternative that surfaces the full term to sighted users hovering for clarification while leaving screen-reader behavior governed by the existing visible labels and the editable tile\'s aria-label. The Baseline Budget and Start/Finish tiles are not EVM-coded and were intentionally left without tooltips',
          'Optional tooltip prop on the local InlineEditableField component (src/features/projects/components/ProjectSummary.tsx) — threads through to a title attribute on the outer container div. Coexists with the existing aria-label="Edit ${label}" (no conflict). Used by the Actual Cost tile to surface "Actual Cost (AC)" without changing the visible label or the inline-edit contract (Enter commits, Escape cancels, focus auto-selects)',
        ],
      },
      {
        title: 'Out of Scope (deliberate, per user direction)',
        items: [
          'Dashboard ProjectCard — keeps the abbreviated EAC: label (space-constrained tile)',
          'CostByPeriodTable — already uses Forecast Subtotal (ETC) / Total (EAC) row labels',
          'Chart legends in MonthlyCostBarChart and CumulativeCostLineChart — stay short ("Actual" / "Forecast")',
          'About page features list — descriptive prose, abbreviations already understood in PM context',
          'ForecastMetricsPanel — already used the expanded Estimate to Complete (ETC) / Estimate at Completion (EAC) labels',
        ],
      },
      {
        title: 'Tests',
        items: [
          'Baseline unchanged: 762 passing across 49 test files. No assertions touched these label strings (verified by grep), and the change is additive (a title attribute) with no visible-text or behavior change',
        ],
      },
    ],
  },
  {
    version: '0.22.4',
    date: '2026-04-26',
    sections: [
      {
        title: 'Added',
        items: [
          'Inline reforecast rename via pencil button. Previously the only way to correct a reforecast name typo was to delete the reforecast and recreate it (which would discard allocations and historical-cost entries). Added a small pencil icon to the right of the reforecast dropdown that swaps the dropdown for a text input in-place — same toolbar slot, no layout shift. Enter commits, Escape cancels, blur commits (matches the existing inline-edit contract used by InlineEditableField, HistoricalCostsTable, and ReforecastNotes). Validation: trim, reject empty, 50-char clamp (matches NewReforecastDialog\'s maxLength={50} for parity). The dropdown is intentionally hidden while editing — switching reforecasts mid-rename is ambiguous, and the user must Enter or Escape first',
          'PencilIcon shared component (src/components/icons/PencilIcon.tsx) — Heroicons-style pencil SVG matching the shape of TrashIcon. Idle muted gray, hover blue (non-destructive). Available for any future rename affordance',
          'updateName operation on useReforecast hook — mutates the active reforecast\'s name field with trim + 50-char clamp + empty/no-op guards inside the hook so all callers (UI today, programmatic in future) get the same guarantees. Appends a reforecast / update changelog entry on commit, mirroring updateHistoricalCosts',
        ],
      },
      {
        title: 'Tests',
        items: [
          'Baseline: 749 → 762 passing across 49 test files (+13, no removals). 8 new toolbar tests (pencil renders/hides, click-to-edit, Enter/Escape/blur commit semantics, empty-input rejection, no-switch-while-editing assertion via select absence). 5 new transformation-style tests for the rename updater logic in reforecast.test.ts',
        ],
      },
    ],
  },
  {
    version: '0.22.3',
    date: '2026-04-26',
    sections: [
      {
        title: 'Reverted',
        items: [
          'Project summary tile label "Actual" → "Actual Cost". The v0.22.0 rename was unintentional and broke alignment with EVM (earned value management) convention, which uses "Actual Cost" as the canonical term for cumulative-cost-incurred-to-date. Restored the original label on the project summary bar. The cumulative chart legend (also touched in v0.22.0) is left as-is for now — separate decision',
        ],
      },
    ],
  },
  {
    version: '0.22.2',
    date: '2026-04-25',
    sections: [
      {
        title: 'Security audit (v0.22.0/v0.22.1 surface area)',
        items: [
          'Targeted security audit of the v0.22.0 Historical Costs Breakdown surface area as left by the v0.22.1 refactor. Two confirmed defects fixed; two lower-severity defense-in-depth items deferred and explicitly tracked in CLAUDE.md',
        ],
      },
      {
        title: 'Fixed',
        items: [
          'F1 — Stale actualsThroughDate / reforecastDate could persist out of project bounds after a timeline tightening. The Timeline Change confirmation dialog detected out-of-range allocations but did not examine reforecast-level date fields or the historicalCosts array. After a user shrunk project.startDate or project.endDate past existing reforecast dates, the stored values silently sat outside project bounds (HTML5 min/max on the inputs is advisory only — it prevents direct entry but does not normalize already-stored values). Calc-engine clipping and the materializeBucketAt range guard tolerated the divergence, but the data invariant ("stored reforecast dates lie within the project window") was broken and the displayed cutoff bucket could include or exclude entries inconsistently with the edit ceiling. Fixed by extracting two pure helpers (computeTimelineChangeSummary, applyTimelineChangeToReforecasts) wired into the project edit page. The apply callback passes the NEW bounds explicitly to the helper, eliminating any sequencing ambiguity. The Timeline Change dialog surfaces all three counts (allocations removed, dates adjusted, historical-cost entries stripped). Date fields are clamped (not cleared) to preserve user intent',
          'F2 — Edit ceiling and display bucket disagreed when out-of-range historical entries were present. commitHistoricalCostEdit filtered "other earlier entries" by month < cutoffMonth only — buildHistoricalCostsView filtered by month >= projectStartMonth && month < cutoffMonth. Result: a stored entry from before the project\'s current start month (e.g., a phantom Jan entry on a project later tightened to start in Feb) did NOT subtract from the displayed cutoff bucket but DID subtract from the edit ceiling. Users saw the displayed sum equal actualCost, then got clamped at a lower-than-expected ceiling when editing an earlier-month row. Fixed by passing projectStartMonth through to commitHistoricalCostEdit and applying the same in-range filter. The negative-bucket clamp itself (Math.max(0, ...)) was already intact in both paths — F2 was a correctness/UX defect, not a security one',
        ],
      },
      {
        title: 'Deferred (tracked in CLAUDE.md)',
        items: [
          'F3 — Migration 0.10.0 does not type-check rebuilt entry fields. Filters scenario entries, then maps surviving entries without asserting e.month is a string or e.cost is a finite non-negative number. No production write path produces malformed entries; deferred as cheap-insurance hardening, not in response to a known exploit',
          'F4 — Strict import validator (validateHistoricalCostEntry) does not reject extra properties on entries. Hand-crafted JSON at version 0.10.0+ could re-introduce source: "scenario"-shaped entries and bypass the cleanup migration (which only runs at version ≤ 0.9.0). Defense-in-depth gap; deferred until a hardening pass',
        ],
      },
      {
        title: 'Cleanup',
        items: [
          'Deleted 46 stale macOS Finder copy artifacts (filenames like routes.d 3.ts, validator 3.ts) from the gitignored .next/ build cache. These were producing a spurious npx tsc --noEmit duplicate-identifier error that hid the (clean) source-level baseline. After deletion, npx tsc --noEmit is 0 errors',
        ],
      },
      {
        title: 'Tests',
        items: [
          'Baseline: 733 → 749 passing across 49 test files (+16, no removals). New file timelineChange.test.ts covers F1 with 14 cases (summary counting, clamping, stripping, immutability, end-to-end scenario including the cutoff-equals-end-date case). 2 new cases appended to historicalCostsView.test.ts cover F2',
        ],
      },
      {
        title: 'Audit posture',
        items: [
          'Confirmed clean (no fix required): input parsing in commitHistoricalCostEdit (NaN/Infinity/negative all collapse to 0); toast firing on cap; DATA_VERSION gating prevents double-application of migrations; the 0.10.0 cleanup filter strips both useForHistory and source: "scenario" correctly; negative-bucket protection via Math.max(0, ...) in both view and edit paths; no production code path writes source or useForHistory (verified by grep); sanitizeCurrency wraps all actualCost/baselineBudget writes; floating-point drift bounded and not exploitable',
        ],
      },
    ],
  },
  {
    version: '0.22.1',
    date: '2026-04-25',
    sections: [
      {
        title: 'Fixed',
        items: [
          'Stale historicalCosts could persist after a cutoff advance under specific over-allocation sequences. When materializeBucketOnAdvance legitimately returned an empty array (because the prior-cutoff bucket evaluated to 0 and there was a stale entry to remove), the call site only conditionally set the field, so the existing stale value inherited via spread persisted. Fixed by treating the helper\'s return as authoritative — set when non-empty, delete (not assign []) when the field was previously present and the helper returned empty. Repro required reducing actualCost to 0 with only a previously-materialized bucket entry stored, then advancing the cutoff. Added two regression scenarios using \'historicalCosts in next\' assertions to prove the key is actually deleted (or never introduced)',
        ],
      },
      {
        title: 'Changed',
        items: [
          'DRY: extracted materializeBucketAt helper. The bucket-computation formula (max(0, actualCost − sum(strictly-earlier entries)) with project-start range guard) was duplicated between materializeBucketOnAdvance (cutoff-advance path) and the inline block in createNewReforecast (copy-from-source path). Both now delegate to a single materializeBucketAt helper in historicalCostsView.ts. materializeBucketOnAdvance becomes a thin wrapper that handles the should-we-materialize-at-all guards. No behavior change — both call sites preserved their existing project-start range-guard semantics',
          'Extracted commitHistoricalCostEdit pure function. The cap-and-upsert logic for inline edits in the Historical Costs Table (over-allocation clamping, no-op skip, entry build) was embedded in the React component. Moved to historicalCostsView.ts as a pure function returning { next, cappedAt } — independently testable without React/toast scaffolding. Component glue shrank to a few lines that route the result to addToast/onUpdate. Existing component tests preserved (they assert externally-observable behavior). Added 7 unit tests for the pure function covering happy path, over-allocation cap, zero-entry removal, no-op detection, and invalid-input coercion',
          'Validator alignment fix: dropped dead !== null defensive checks for optional actualsThroughDate and notes fields in validateReforecast. The type contract uses the optional-field modifier (?) which only allows undefined, but the validator was accepting both undefined and null. No production write path produces null for either field (verified by full-history git log --pickaxe-regex and write-path audit), so no real-world import is affected. The change aligns the validator with the type contract — if a future code path ever produces null, it\'ll fail loudly with a validation error rather than silently passing',
          'Doc clarity: added a comment to Reforecast.startDate documenting the YYYY-MM format. Sibling fields (reforecastDate, actualsThroughDate) already had format comments; the missing one was a small footgun for new contributors',
        ],
      },
      {
        title: 'Type-debt cleanup (test files only)',
        items: [
          'Cleared all 41 pre-existing tsc --noEmit errors across 6 test files. Drift had accumulated across prior sprints whenever a domain type gained a new field but old test fixtures weren\'t updated. None of these errors blocked CI (Next.js production build only typechecks production code, and Vitest doesn\'t enforce strict types). After this cleanup, npx tsc --noEmit produces 0 errors across the repo',
          'Files touched: spreadsheet-1.5.ts fixture, localStorage.test.ts, useGridKeyboard.test.ts, AllocationGrid.test.tsx, ReforecastToolbar.test.tsx, migrations.test.ts. Production code untouched',
        ],
      },
      {
        title: 'Dependencies',
        items: [
          'jsdom 28.0.0 → 28.1.0 (test infrastructure, patch bump, 69 days post-release per the 60-day scrutiny rule). All other minor/patch updates currently available are blocked by the 60-day rule and were intentionally deferred (firebase 12.12.1, vitest 4.1.5, tailwindcss 4.2.4, react 19.2.5, @vitejs/plugin-react 5.2.0, eslint 9.39.4 — none older than 50 days as of release)',
        ],
      },
      {
        title: 'Tests',
        items: [
          'Baseline: 724 → 733 passing across 48 files (+9 new tests, no removals: 2 B1 regression scenarios + 7 R2 unit tests)',
        ],
      },
    ],
  },
  {
    version: '0.22.0',
    date: '2026-04-25',
    sections: [
      {
        title: 'Added',
        items: [
          'Per-month historical cost breakdown under the cost charts on the project detail page. Collapsible table renders one row per month from project start through the cutoff month (driven by actualsThroughDate). Earlier months are user-editable inline numeric inputs; the cutoff-month row is read-only and auto-derives as actualCost minus the sum of earlier-month entries so the column always sums exactly to the project total. Over-allocation attempts clamp to the available ceiling and surface a "Capped at $X" toast. Inputs commit on Enter (matches the Baseline Budget / Actual inline-edit contract from ProjectSummary); Escape cancels and restores the original value',
          'Bucket materialization on copy/advance — when copying a reforecast or advancing the cutoff to a later month, the prior cutoff month\'s effective bucket value is captured as a stored entry so it survives downstream edits. Always overwrites any pre-existing entry at that month (the cutoff row is never user-editable, so any prior entry there is stale by construction). Range-guarded so a cutoff before project start never materializes a phantom entry',
          'Date input range validation — the Reforecast Date and Actuals Through Date inputs now constrain to project start/end via native min/max attributes, preventing out-of-project-range typos from polluting the historical breakdown',
          'New TrashIcon shared component (src/components/icons/TrashIcon.tsx) so all three delete surfaces (dashboard tile, project detail page, reforecast toolbar) draw from a single source of truth',
        ],
      },
      {
        title: 'Changed',
        items: [
          'Monthly cost bar chart is now stacked — actual portion (teal) sits below the forecast portion (blue) per month, and mid-month cutoffs render as two-segment stacks that visualize the actual/forecast split explicitly. Tooltips on blended bars break down Actual / Forecast / Total. The earlier 3-color blended palette (with a tertiary purple for cutoff months) was scrapped in favor of this clearer stacked treatment',
          'Cumulative cost line chart split into two segments — solid teal through any month containing actuals (including the blended cutoff month), dashed blue for the pure forecast trajectory beyond the cutoff. Cumulative chart right margin bumped 16→60 so the "Budget" label fits inside the plot area without clipping',
          'Reforecast dropdown sorted newest-first by reforecastDate desc, with createdAt desc as tiebreaker — quicker navigation in projects with many weekly reforecasts. New Reforecast dialog defaults Copy From to the newest source',
          'Actual Cost tile renamed to Actual on the project summary bar',
          'Reforecast Delete button replaced by an icon-only trash glyph at the far-right edge of the toolbar, past + New Reforecast. Demotes the destructive action visually, keeps + New Reforecast from drifting horizontally as the toolbar widens with the Actuals Through input. Idle muted gray, hover red. Confirmation dialog unchanged',
          'Project Delete button replaced by the same icon-only trash glyph on the project detail page, beside Edit. Same idle/hover semantics, sized one notch larger to balance the taller Edit button',
          'Dashboard tile delete glyph refactored to use the shared TrashIcon component (visual unchanged — same Heroicons trash SVG it was already drawing)',
          'Chart x-axis label fontSize 13→15 and y-offset 16→18 for legibility',
          'Cumulative chart legend "Actuals" → "Actual" for consistency with the bar chart and project summary tile',
        ],
      },
      {
        title: 'Migration',
        items: [
          'DATA_VERSION 0.8.0 → 0.9.0 — additive, no-op for existing data; allows the new optional Reforecast.historicalCosts field',
          'DATA_VERSION 0.9.0 → 0.10.0 — cleanup migration that strips a useForHistory: true flag and historicalCosts entries with source: "scenario" from a scrapped earlier v0.22.0 design that polluted some users\' localStorage during pre-fix testing. Most users will see no change',
        ],
      },
    ],
  },
  {
    version: '0.21.6',
    date: '2026-04-24',
    sections: [
      {
        title: 'Fixed',
        items: [
          'LocalStorageWarningBanner hydration mismatch. The component used a lazy useState initializer with a typeof-window guard intended to be SSR-safe, but the guard actually produced the mismatch: SSR returned false (no banner), first client render returned true (banner present), and React logged a recoverable hydration error on every page load where the banner was eligible to show. Reworked to always initialize visible: false on both SSR and first client render, then flip via useEffect after hydration. No visual change — just silences the console warning and lets the React tree hydrate cleanly on first render',
        ],
      },
    ],
  },
  {
    version: '0.21.5',
    date: '2026-04-24',
    sections: [
      {
        title: 'Fixed',
        items: [
          'v0.21.4 expanded the Reforecast name dropdown floor from min-w-48 (192px) to min-w-64 (256px) — a +64px jump that produced obvious dead space between the selected value and the dropdown chevron on typical short names. Pulled back to min-w-56 (224px, +32px from the original 192px) so the dropdown is modestly wider for longer names without looking comically empty for short ones',
        ],
      },
    ],
  },
  {
    version: '0.21.4',
    date: '2026-04-24',
    sections: [
      {
        title: 'UX',
        items: [
          'Reforecast name dropdown floor width raised from min-w-48 (192px) to min-w-64 (256px). After the v0.21.3 date-input shrinkage left visible slack between the Actuals Through × button and the Delete / "+ New Reforecast" button pair, expanded the scenario dropdown to use some of that slack so longer reforecast names display fully without truncation. Chosen conservatively so the single-line desktop layout from v0.21.3 is preserved',
        ],
      },
    ],
  },
  {
    version: '0.21.3',
    date: '2026-04-24',
    sections: [
      {
        title: 'Fixed',
        items: [
          'Reforecast toolbar date fields actually shrunk this time. Prior v0.21.1 (w-[140px]) and v0.21.2 (w-36 min-w-0 shrink) Tailwind class combinations did not measurably shrink the native date input in practice — either the arbitrary-value class did not compile, or the browser-default min-width dominated. Switched to inline style={{ width: 120, minWidth: 120 }} which is bulletproof against both CSS-compilation and browser-default interference. Each date input is now exactly 120px wide, freeing ~160px of horizontal space for the Delete / "+ New Reforecast" button pair',
          '"+ New Reforecast" and "Delete" buttons received whitespace-nowrap so their labels no longer break into a second line when the toolbar gets tight',
          'Button group received shrink-0 so it holds its width when space gets constrained',
        ],
      },
    ],
  },
  {
    version: '0.21.2',
    date: '2026-04-24',
    sections: [
      {
        title: 'Fixed',
        items: [
          'Reforecast toolbar wrap regression follow-up to v0.21.1. The prior w-[140px] arbitrary-value width on the date inputs was insufficient: the native date input has an intrinsic min-width that can override a declared width, and the flex-wrap container was still pushing Delete + "+ New Reforecast" to a second line on desktop widths. Switched to w-36 min-w-0 shrink (standard utilities + explicit min-width override) and added md:flex-nowrap md:gap-3 to the container so the toolbar stays single-line at ≥768px. Below that breakpoint the layout still wraps gracefully for narrow mobile viewports',
        ],
      },
    ],
  },
  {
    version: '0.21.1',
    date: '2026-04-24',
    sections: [
      {
        title: 'UX',
        items: [
          'Baseline Budget and Actual Cost inline-edit inputs now auto-select their existing value on focus. Clicking to edit and typing immediately replaces the prior number — no more backspacing through the previous value',
          'Reforecast toolbar date inputs (Date, Actuals Through) constrained to 140px. The native date-picker default width left enough slack at common viewport sizes that the Delete + "+ New Reforecast" button pair wrapped to a second line; tightening the two date fields keeps the whole toolbar on one line. Scenario-name dropdown retains its min-w-48 so long reforecast names stay readable',
        ],
      },
    ],
  },
  {
    version: '0.21.0',
    date: '2026-04-23',
    sections: [
      {
        title: 'Added',
        items: [
          'Cloud Storage modal — a lightweight centered-overlay dialog triggered by any click on the auth chip (top-right of every page). Replaces navigating to /settings#cloud-storage to sign in or switch storage modes. Settings retains its Cloud Storage section as a secondary access path',
          'Signed-out modal state shows two side-by-side primary-blue sign-in buttons with full-color Google and Microsoft brand logos. Cloud radio is disabled until the user authenticates',
          'Signed-in-local modal state offers an identity card (normalized display name + email + red "Sign out" link), an enabled Cloud radio, and a "Keep using local storage" button that explicitly closes the modal without changing modes',
          'Signed-in-cloud modal state offers the same identity card plus a Local radio that triggers a switch-to-local confirmation; mode cascade on sign-out is centralized in performSignOutCleanup',
          'Full display-name normalization: Microsoft Azure AD "Last, First MI" format now renders as "First MI Last" in natural reading order. New normalizeDisplayName() utility sibling to the existing getFirstName(), applied at every display surface',
          'Inline SVG <GoogleLogo> and <MicrosoftLogo> brand-mark components in src/components/icons/',
          'Export Attribution and the localStorage-warning toggle now render inside the modal in addition to Settings, so users can adjust adjacent preferences without leaving the dialog',
        ],
      },
      {
        title: 'Changed',
        items: [
          'Auth chip (StorageStatusPill) lost its popover menus in favor of single-click modal-open behavior. All three chip variants — signed-out, signed-in-local, signed-in-cloud — route every click through a shared onOpen prop. Lost behaviors (sign-out button in popover, "Switch to Cloud Storage" direct-link) are preserved inside the modal',
          'Notifications checkbox ("Warn me on startup when using local storage") extracted into a shared LocalStorageWarningToggle component. Settings page and modal both render the same component so toggle state stays in lock-step across surfaces',
          'StorageStatusPill derives mode during render rather than via useEffect(setMode). usePathname() and useAuth() trigger re-render on navigation or auth change; the render-time getStorageMode() read picks up fresh localStorage values. Eliminates a react-hooks/set-state-in-effect pattern',
        ],
      },
      {
        title: 'Tests',
        items: [
          '9 new tests for normalizeDisplayName: Microsoft comma format with and without middle initial, Google format passthrough, single-name passthrough, null/undefined/empty handling, whitespace trimming, and degenerate comma positions (empty last or first segment returns input unchanged)',
          'Total: 671 tests across 44 files (up from 662)',
        ],
      },
    ],
  },
  {
    version: '0.20.2',
    date: '2026-04-23',
    sections: [
      {
        title: 'Added',
        items: [
          'Per-reforecast Notes field — free-text narrative (max 2000 characters) to record why a reforecast exists (scope change, team shift, delay, executive ask, etc.)',
          'Collapsible Notes panel renders directly below the reforecast toolbar. Collapsed by default; the note/document icon fills and a dot indicator appears when a reforecast has content, so context is discoverable at a glance',
          'Live character counter (N / 2000) during editing',
          'Notes roundtrip through JSON export/import and persist independently per reforecast (switching reforecasts surfaces that reforecast\'s own notes)',
        ],
      },
      {
        title: 'Data Model',
        items: [
          'Reforecast.notes?: string added to the domain type',
          'Data version bumped 0.7.0 → 0.8.0; additive migration backfills notes: \'\' on every existing reforecast. Coerces non-string values to empty string',
          'validateAppState extended to reject non-string notes and notes exceeding the 2000-character cap on import',
          'REFORECAST_NOTES_MAX_LENGTH = 2000 centralized in src/lib/constants.ts',
        ],
      },
      {
        title: 'Tests',
        items: [
          '14 new tests across hook, migration, and validation layers (update/truncate/empty/isolation, migration backfill/preserve/coerce, validation accept/reject at boundary)',
        ],
      },
    ],
  },
  {
    version: '0.20.1',
    date: '2026-04-19',
    sections: [
      {
        title: 'Fixed',
        items: [
          'Fixed a latent Rules-of-Hooks violation in CloudStorageSection where a useCallback was declared after an early return. Constant at runtime today (Firebase config is env-derived), but the hoist to above the early return is correct per React\'s invariants',
        ],
      },
      {
        title: 'Maintenance',
        items: [
          'Lint gate cleanup: npm run lint now exits 0. Prior state on main was 35 problems (17 errors, 18 warnings) stemming from new React 19-era rules and miscellaneous unused-variable warnings',
          'Converted 4 useEffect(() => setState(localStorage...)) sites to lazy useState(() => ...) initializers with typeof window guards (page.tsx, settings/page.tsx, LocalStorageWarningBanner, FirstRunBanner)',
          'Pragma-suppressed react-hooks/set-state-in-effect on 5 legitimate external-subscription hooks (useProject, useProjects, useSettings, useTeamPool, useTheme) with inline justification. The rule cannot distinguish cloudSyncBus-driven refetches from cascading renders; useTheme\'s setMounted(true) is the canonical SSR hydration guard. useTheme is flagged as a candidate for a future useSyncExternalStore refactor',
          'Pruned 7 unused type imports from validation.ts and 4 unused imports across test files and components',
          'Replaced 5 as any casts in localStorage.test.ts with narrower as unknown as Record<string, unknown> assertions for the legacy-shape migration tests',
          'Applied prefer-const to 3 let declarations in usaFederalHolidays.ts',
        ],
      },
    ],
  },
  {
    version: '0.20.0',
    date: '2026-04-19',
    sections: [
      {
        title: 'Security',
        items: [
          'Hardened sign-out against cross-user data leakage. A centralized performSignOutCleanup() now cancels pending debounced saves before revoking Firebase credentials, clears per-user localStorage keys (msb:projects, msb:settings, msb:teamPool, msb:changeLog, msb:originRef, msb:exportAttribution, msb:ratesReviewed, msb:hasUploadedToCloud), resets storage mode to local, swaps the delegating repo to localStorage, calls firebaseSignOut inside a try/finally, and reloads the page',
          'try/finally guarantees the page reload fires even if firebaseSignOut rejects (network failure, revoked token), so the user is never left in a partially-cleaned-up state',
          'Local→Cloud migration now reads from the in-memory delegating repo (not a freshly-constructed LocalStorageRepository), closing a cross-user vector where a prior user\'s localStorage residue could be uploaded to a new user\'s Firestore account',
          'Sign-out preserves device-scoped keys: msb-workspace-id, spert_tos_accepted_version, msb:suppressLocalStorageWarning, msb:theme, msb:version, spert_firstRun_seen (documented inline in signOutCleanup.ts)',
          'AuthProvider.signOut now delegates to performSignOutCleanup; CloudStorageSection.handleSignOut and StorageStatusPill.handleSignOut are thin wrappers — no parallel cleanup drift',
          'Debounced saves are now cancellable in bulk via a module-level pendingSaveRegistry (each useDebouncedSave instance self-registers on mount)',
          'Debounced save errors are now caught and logged to console.error instead of becoming unhandled promise rejections',
        ],
      },
      {
        title: 'UX',
        items: [
          'Auth chip now renders four distinct states. Previously, a signed-in user in local mode saw the same "Sign in" chip as a signed-out user — an already-authenticated user staring at a Sign-in button. New signed-in-local state shows avatar + first name + lock icon, with a popover offering "Switch to Cloud Storage" (navigates to /settings#cloud-storage) and "Sign Out"',
          'Clicking "Switch to Cloud Storage" in the chip popover does NOT auto-switch mode; it navigates to the Cloud Storage section where the user explicitly confirms via the existing radio toggle (respects the upload-or-cancel prompt)',
          'First-name extraction (Microsoft "Last, First" vs. Google "First Last") extracted to a shared getFirstName utility — no more duplicated logic across chip branches',
          'Popup sign-in cancellations no longer surface red error banners. Closing the OAuth popup (auth/popup-closed-by-user) or double-clicking the sign-in button (auth/cancelled-popup-request) is now a silent no-op. Blocked popups show an actionable "Pop-up was blocked. Allow pop-ups for this site and try again." message',
          'Cloud Storage section has an id="cloud-storage" anchor for deep-linking from the chip popover',
        ],
      },
      {
        title: 'Technical',
        items: [
          'New src/lib/storage/pendingSaveRegistry.ts — module-level cancel registry for useDebouncedSave instances',
          'New src/lib/auth/signOutCleanup.ts — zero-argument performSignOutCleanup() with load-bearing execution order documented inline',
          'New src/lib/utils/getFirstName.ts — shared "Last, First" / "First Last" display-name parser',
          'StorageStatusPill re-reads storage mode on user changes (not just pathname changes) so sign-in without navigation correctly flips to the new signed-in-local chip branch',
          'CloudStorageSection split confirmUpload (main local→cloud migration, reads via delegating repo) from confirmReupload (re-upload stragglers, reads a fresh LocalStorageRepository — signposted as the only place this is safe)',
          'Added 22 new tests: 5 for pendingSaveRegistry, 10 for getFirstName, 7 for signOutCleanup (including the try/finally reload-on-reject guard). Total: 648 tests',
        ],
      },
    ],
  },
  {
    version: '0.19.1',
    date: '2026-04-09',
    sections: [
      {
        title: 'UX',
        items: [
          'Auth chip is now a single clickable button — avatar, name, divider, and cloud icon form one unified click target',
          'Clicking the signed-in chip opens a lightweight popover showing the user\'s display name, email, and a Sign Out button',
          'Sign Out from the chip mirrors the Settings → Cloud Storage sign-out handler exactly (signs out of Firebase and resets storage mode to Local)',
          'Popover dismisses via Escape key, outside click, or Cancel button; dismissal is disabled while sign-out is in flight to prevent inconsistent state',
          'Signed-out chip remains a single button that navigates to Settings for the sign-in flow',
          'Removed nested <button>/<Link> elements inside the chip to comply with accessibility requirements (one chip, one click target)',
        ],
      },
    ],
  },
  {
    version: '0.19.0',
    date: '2026-04-05',
    sections: [
      {
        title: 'Legal',
        items: [
          'Updated Terms of Service and Privacy Policy to v04-05-2026',
          'Added SPERT® AHP to list of covered apps',
          'Updated effective date to April 5, 2026',
        ],
      },
    ],
  },
  {
    version: '0.18.9',
    date: '2026-04-05',
    sections: [
      {
        title: 'UX',
        items: [
          'Standardized auth chip to Option C split-pill design — matches SPERT Suite convention across all six apps',
          'Signed-in state now shows 26px avatar circle with first initial, first name only (not full name), vertical divider, and cloud icon linking to Settings',
          'Local/signed-out state shows lock icon with "Local only" label, vertical divider, and "Sign in" link to Settings',
          'Suite-standard blue (#0070f3) used for avatar, cloud icon, and sign-in label regardless of app accent color',
        ],
      },
    ],
  },
  {
    version: '0.18.8',
    date: '2026-04-04',
    sections: [
      {
        title: 'UX',
        items: [
          'Added persistent top bar to all pages — shows storage mode (Local/Cloud) and signed-in user in the upper-right corner, consistent with other SPERT Suite apps',
          'StorageStatusPill: gray "Local" pill when using local storage; blue pill with user initial and display name when signed into cloud; amber "Sign in" pill when cloud mode is selected but not authenticated — all states link to Settings',
          'Moved theme toggle (Light/Dark/System) from sidebar bottom to top bar for consistent placement across SPERT Suite apps',
        ],
      },
      {
        title: 'New Components',
        items: [
          'StorageStatusPill (src/components/StorageStatusPill.tsx) — three-state storage/auth indicator with reactive mode detection on navigation',
          'TopBar (src/components/TopBar.tsx) — right-aligned utility bar housing ThemeToggle and StorageStatusPill',
        ],
      },
    ],
  },
  {
    version: '0.18.7',
    date: '2026-04-03',
    sections: [
      {
        title: 'UX',
        items: [
          'Allocation grid row delete buttons (✕) are now gray by default and turn red on hover, reducing visual clutter',
        ],
      },
    ],
  },
  {
    version: '0.18.6',
    date: '2026-04-02',
    sections: [
      {
        title: 'Features',
        items: [
          'Added "Export All Projects" button to Dashboard header for quick JSON export without navigating to Settings',
          'Added localStorage warning banner — amber caution banner on every app load when data is stored locally, session-dismissable via "Got it"',
          'Added Notifications section in Settings with toggle to permanently suppress the localStorage warning banner',
        ],
      },
    ],
  },
  {
    version: '0.18.5',
    date: '2026-03-31',
    sections: [
      {
        title: 'Maintenance',
        items: [
          'Updated Terms of Service and Privacy Policy to v03-31-2026',
          'Updated canonical legal document URLs to spertsuite.com',
          'Updated consent UI text to SPERT® Suite branding',
          'Added License footer link (links to GitHub LICENSE file)',
          'Updated LICENSE project name to SPERT® Suite',
        ],
      },
    ],
  },
  {
    version: '0.18.4',
    date: '2026-03-16',
    sections: [
      {
        title: 'UX',
        items: [
          'Revised first-run notification wording to clarify that using the app implies agreement to Terms of Service and Privacy Policy',
        ],
      },
    ],
  },
  {
    version: '0.18.3',
    date: '2026-03-11',
    sections: [
      {
        title: 'Infrastructure',
        items: [
          'Pinned Node.js >=22 LTS in package.json engines field and .nvmrc for deployment readiness before Node 20 EOL',
          'Aligned @types/node to ^22 to match deployment target',
        ],
      },
    ],
  },
  {
    version: '0.18.2',
    date: '2026-03-11',
    sections: [
      {
        title: 'Security',
        items: [
          'Added 10 MB file size limit on JSON import to prevent memory exhaustion',
          'Replaced isNaN() with Number.isFinite() in RateTable, ThresholdSettings, and AllocationGrid to reject Infinity values',
          'Added min={0} HTML constraint on RateTable number inputs for browser-level enforcement',
          'Added maxLength={100} on PoolMemberTable edit name input for consistency with add form',
          'Strengthened date validation to reject syntactically valid but semantically invalid dates (e.g. 9999-99-99)',
          'Added X-Content-Type-Options, Referrer-Policy, X-Frame-Options, and Permissions-Policy security headers',
        ],
      },
    ],
  },
  {
    version: '0.18.1',
    date: '2026-03-11',
    sections: [
      {
        title: 'Refactoring',
        items: [
          'Extracted keyboard navigation logic from AllocationGrid into dedicated useGridKeyboard hook for better separation of concerns and testability',
          'Moved sanitizeCurrency utility from useReforecast hook to shared format.ts module',
          'Replaced non-null assertion (!) with conditional rendering for AllocationGridAddRow',
        ],
      },
      {
        title: 'Dependencies',
        items: [
          'Updated @vitejs/plugin-react to 5.1.4 (patch)',
          'Updated @types/react to 19.2.14 and @types/node to 24.12.0 (patches)',
        ],
      },
      {
        title: 'Testing',
        items: [
          '626 passing tests across 40 test files (+22 new tests)',
          'New useGridKeyboard hook tests (17 tests: arrow navigation, Enter/Escape/Tab, Delete, digit entry, boundary clamping, readonly guard)',
          'New sanitizeCurrency tests (5 tests: finite values, NaN, Infinity, negative, zero)',
        ],
      },
    ],
  },
  {
    version: '0.18.0',
    date: '2026-03-11',
    sections: [
      {
        title: 'Legal',
        items: [
          'Added Terms of Service and Privacy Policy consent flow',
          'Footer now includes links to Terms of Service and Privacy Policy',
          'First-run banner introduces cloud storage consent for new users',
          'Cloud sign-in gated behind ToS acceptance modal (checkbox required)',
          'Acceptance recorded in Firestore; returning users skip modal',
        ],
      },
    ],
  },
  {
    version: '0.17.1',
    date: '2026-03-10',
    sections: [
      {
        title: 'UX',
        items: [
          'Dashboard empty state replaced with a 3-step Getting Started guide — directs new users to (1) review labor rates in Settings, (2) build the Team Pool, (3) create their first project',
          'Steps show a green checkmark when complete (labor rates reviewed, team members added)',
        ],
      },
      {
        title: 'Bug Fixes',
        items: [
          'Fixed role dropdown in Team Pool showing options in light gray text when opened — options now render in normal text color',
        ],
      },
    ],
  },
  {
    version: '0.17.0',
    date: '2026-03-10',
    sections: [
      {
        title: 'Actuals Through Date (ETC Cutoff)',
        items: [
          'New per-reforecast "Actuals Through Date" field — tells the calc engine where actuals end so ETC excludes already-covered costs',
          'Pre-cutoff months automatically zeroed (fully covered by actuals)',
          'Cutoff month prorated — only workdays after the cutoff date contribute to ETC',
          'Charts, cost table, and all derived metrics (EAC, variance, burn rate) automatically reflect adjusted costs',
          'Date picker with clear button in ReforecastToolbar alongside existing Reforecast Date',
          'Field is optional — undefined means no cutoff (identical to prior behavior); no data migration needed',
        ],
      },
      {
        title: 'Calculation Engine',
        items: [
          'New getEtcStartDate() helper computes cutoff + 1 calendar day',
          'getMonthlyWorkHours() gains optional etcStartDate parameter — additional lower bound on effective start date',
          'Burn rate now uses cost-based active months instead of allocation-based, naturally excluding pre-cutoff months',
          'createNewReforecast() copies actualsThroughDate from source when present',
        ],
      },
      {
        title: 'Testing',
        items: [
          '604 passing tests across 39 test files (+20 new tests)',
          'New getEtcStartDate tests (day+1 logic, month/year boundaries)',
          'New getMonthlyWorkHours tests with etcStartDate (pre-cutoff, cutoff partial, post-cutoff, combined with holidays)',
          'New calculateProjectMetrics tests with actualsThroughDate (zeroed pre-cutoff, prorated mid-month, burn rate adjustment)',
          'New createNewReforecast tests for actualsThroughDate copy behavior',
        ],
      },
    ],
  },
  {
    version: '0.16.3',
    date: '2026-03-10',
    sections: [
      {
        title: 'Copyright & Attribution',
        items: [
          'Added copyright headers to all 134 source files (TS, TSX, CSS, MJS) with appropriate comment syntax per file type',
          'Added author attribution block to top of LICENSE file — identifies William W. Davis, MSPM, PMP as original author with repository link',
          'Appended Section 7 additional terms to LICENSE — attribution preservation and UI notice preservation requirements per GNU GPL v3',
          'Added Copyright & Attribution Standing Instructions to CLAUDE.md — ensures all future sessions maintain copyright headers on new files',
        ],
      },
      {
        title: 'About Page',
        items: [
          'Updated "Your Data & Privacy" section to "Your Data & Storage" — now documents both Local Storage (default) and Cloud Storage (optional) modes, matching the pattern used across the SPERT suite',
          'Added Import & Export subsection for clearer data portability guidance',
        ],
      },
    ],
  },
  {
    version: '0.16.2',
    date: '2026-03-10',
    sections: [
      {
        title: 'Security Hardening',
        items: [
          'Removed unsafe-eval from Content Security Policy script-src directive',
          'Added server-side email format validation in project sharing before Firestore query',
          'Reduced email enumeration in sharing error messages — no longer reveals whether an email exists in the system',
          'Updated minimatch (ReDoS fix), rollup (path traversal fix), and ajv (ReDoS fix) to patched versions',
        ],
      },
    ],
  },
  {
    version: '0.16.1',
    date: '2026-03-10',
    sections: [
      {
        title: 'Bug Fixes',
        items: [
          'Fixed mode switch (local/cloud) not refreshing hooks or setting up cloud sync listeners — all mode switch paths now reload the page to ensure correct data source',
          'Fixed ensureProfile overwriting createdAt timestamp on every sign-in — now only sets createdAt on first profile creation',
          'Removed redundant sign-in error AlertDialog (inline error display is sufficient)',
        ],
      },
      {
        title: 'Refactoring',
        items: [
          'Extracted shared Firestore collection name constants to src/lib/firebase/collections.ts — eliminates duplication across 4 files',
          'Extracted pure utility functions (buildTeamSnapshot, stripUndefined, docToProject) from firestoreRepo.ts to src/lib/storage/firestoreUtils.ts for independent testability',
          'Cleaned up useCloudSync.ts — removed dead beforeunload handler and unnecessary initializedRef guard',
          'Moved deleteField to static import in sharing.ts for proper tree-shaking',
        ],
      },
      {
        title: 'Testing',
        items: [
          '584 passing tests across 39 test files (+16 tests)',
          'New test file: firestoreUtils.test.ts — 13 tests for buildTeamSnapshot, stripUndefined, docToProject',
          'New tests for resolveAssignments teamSnapshot fallback (shared project viewing)',
        ],
      },
    ],
  },
  {
    version: '0.16.0',
    date: '2026-03-10',
    sections: [
      {
        title: 'New Feature: Firebase Cloud Storage',
        items: [
          'Optional cloud storage via Firebase Firestore — sync data across devices and browsers',
          'Firebase Authentication with Google and Microsoft SSO sign-in',
          'Cloud Storage section in Settings — toggle between Local and Cloud modes with one-click migration',
          'Local-to-cloud migration with upload confirmation, cleanup prompt, and re-upload detection',
          'Real-time sync via Firestore onSnapshot — changes propagate across browser tabs automatically',
          'Project sharing — owners can invite editors and viewers by email address',
          '"Shared" badge on dashboard project cards for projects with multiple members',
          'Team snapshot embedding — shared project viewers see correct team member names without needing them in their pool',
        ],
      },
      {
        title: 'Architecture',
        items: [
          'Delegating repository wrapper — repo.ts forwards calls to active implementation (local or cloud) with zero hook refactoring',
          'Firestore repository implementing full Repository interface with merge-safe saves and ownership-aware creates',
          'Cloud sync event bus (cloudSyncBus) for decoupled real-time update propagation',
          'Echo prevention via hasPendingWrites in onSnapshot listeners',
          'HMR-safe Firebase initialization with memoryLocalCache',
          'User-friendly Firebase error mapping (sanitizeFirebaseError)',
          'Storage mode persistence (msb:storageMode localStorage key)',
          'Separate createProject vs saveProject — only createProject sets owner/members fields',
        ],
      },
      {
        title: 'New Files',
        items: [
          'src/lib/firebase/config.ts — Firebase initialization with HMR guard',
          'src/lib/firebase/auth.ts — Authentication (Google, Microsoft SSO, profile management)',
          'src/lib/firebase/errors.ts — Error code to user-friendly message mapping',
          'src/lib/firebase/cloudSyncBus.ts — Pub/sub event bus for real-time sync',
          'src/lib/firebase/sharing.ts — Project member management (add/remove by email)',
          'src/lib/storage/firestoreRepo.ts — Full Firestore Repository implementation',
          'src/lib/storage/storageMode.ts — Storage mode getter/setter',
          'src/components/AuthProvider.tsx — React context for Firebase auth state',
          'src/components/CloudSyncProvider.tsx — Activates onSnapshot listeners',
          'src/hooks/useCloudSync.ts — Firestore real-time subscription management',
          'src/features/settings/components/CloudStorageSection.tsx — Cloud storage UI in Settings',
          'src/features/projects/components/SharingSection.tsx — Project sharing UI',
          'firestore.rules — Firestore security rules for spert-suite project',
          'firebase.json — Firebase project configuration',
        ],
      },
      {
        title: 'Bug Prevention',
        items: [
          'Incorporated 13 critical bug prevention patterns from 4 completed SPERT suite migrations',
          'Data-loss guard: empty cloud results never overwrite non-empty local data',
          'Debounced save cancel() method added alongside existing flush()',
          'Collision detection during import with try/catch for PERMISSION_DENIED on non-existent docs',
          'CSP headers updated for Firebase domains (script-src, frame-src, connect-src)',
        ],
      },
      {
        title: 'Testing',
        items: [
          '568 passing tests across 38 test files (+20 tests, +4 test files)',
          'New test files: sanitizeFirebaseError, cloudSyncBus, storageMode, delegating repo wrapper',
        ],
      },
    ],
  },
  {
    version: '0.15.2',
    date: '2026-03-09',
    sections: [
      {
        title: 'Documentation',
        items: [
          'Quick Reference Guide — PDF download link added to About page (hosted on GitHub, not bundled with Vercel deployment)',
        ],
      },
    ],
  },
  {
    version: '0.15.1',
    date: '2026-03-02',
    sections: [
      {
        title: 'UX Improvements',
        items: [
          'Duplicate team member warning — adding a member with the same name shows a confirmation dialog (Cancel / Add Anyway)',
          '$0/hour labor rates — infrastructure roles that cost nothing to a project can now be added for resource planning',
          'Allocation grid member dropdown sorted alphabetically by name for faster scanning and type-ahead filtering',
          'Tighter Team Pool table layout — reduced row spacing and constrained width for better readability on large monitors',
        ],
      },
    ],
  },
  {
    version: '0.15.0',
    date: '2026-02-22',
    sections: [
      {
        title: 'Data Integrity',
        items: [
          'Hook flush consistency — useSettings and useTeamPool now expose flush(), matching useProject pattern',
          'Unmount cleanup on all pages with pending saves — Settings, Team Pool, Project Detail, and Edit Project pages flush debounced saves on navigation',
        ],
      },
      {
        title: 'Code Quality',
        items: [
          'Decomposed AllocationGrid (701 lines) into 4 focused sub-components: AllocationGridHeader, AllocationGridRow, AllocationGridSummaryRows, AllocationGridAddRow',
          'Deleted 7 macOS duplicate files ("file 2.ext" artifacts)',
        ],
      },
      {
        title: 'New Features',
        items: [
          'Toast notification system — auto-dismissing success/error/info toasts for export, import, bulk holiday add, and project delete operations',
          'Skeleton loading screens — shimmer placeholders on Dashboard, Project Detail, Edit Project, Team Pool, and Settings pages',
          'Keyboard shortcuts help modal — press Ctrl+? or click "Keyboard Shortcuts" in sidebar to view all allocation grid and global shortcuts',
        ],
      },
      {
        title: 'New Components & Hooks',
        items: [
          'ToastProvider + useToast (src/components/Toast.tsx)',
          'Skeleton, SkeletonProjectCard, SkeletonProjectDetail (src/components/Skeleton.tsx)',
          'ShortcutsDialog (src/components/ShortcutsDialog.tsx)',
          'useKeyboardShortcut (src/hooks/useKeyboardShortcut.ts)',
          'AllocationGridHeader, AllocationGridRow, AllocationGridSummaryRows, AllocationGridAddRow (src/features/reforecast/components/)',
        ],
      },
      {
        title: 'Testing',
        items: [
          '548 passing tests across 34 test files (+111 tests, +10 test files)',
          'New component tests: BaseDialog, Toast, Skeleton, ShortcutsDialog, ProjectForm, ReforecastToolbar, AllocationGrid',
          'New hook tests: useSettings, useTeamPool',
        ],
      },
    ],
  },
  {
    version: '0.14.0',
    date: '2026-02-20',
    sections: [
      {
        title: 'New Features',
        items: [
          'Export attribution — new section in Settings for attaching name and identifier to JSON exports for team workflow traceability',
          'Workspace reconciliation tokens — exports include _originRef and _storageRef for cross-session data provenance tracking and localStorage hydration recovery',
          'Export pipeline diagnostics — dataset maintains a lightweight _changeLog of structural operations for client-side telemetry',
        ],
      },
      {
        title: 'Technical',
        items: [
          'New localStorage key msb-workspace-id for deterministic workspace binding',
          'Workspace utilities in src/lib/storage/fingerprint.ts for identity, changelog, and attribution management',
          'Import preserves _originRef and _changeLog from source data for provenance chain continuity',
        ],
      },
    ],
  },
  {
    version: '0.13.0',
    date: '2026-02-03',
    sections: [
      {
        title: 'Accessibility & UX Polish',
        items: [
          'Replaced browser window.confirm() in Holiday Calendar with styled ConfirmDialog',
          'Replaced browser alert() and confirm() in Data Export/Import with styled dialogs',
          'Added unique ARIA IDs to BaseDialog for accessibility compliance (useId)',
          'Added scope="col" to all table headers for screen reader compatibility',
        ],
      },
      {
        title: 'New Components',
        items: [
          'AlertDialog — informational dialog for error/success messages (non-destructive variant of ConfirmDialog)',
        ],
      },
    ],
  },
  {
    version: '0.12.0',
    date: '2026-02-03',
    sections: [
      {
        title: 'Security Hardening',
        items: [
          'Deep validation for imported JSON — validates nested structures (reforecasts, allocations, assignments)',
          'Type guards in migration functions — throws descriptive errors instead of silent data corruption',
          'Runtime type validation on localStorage reads with optional validator callbacks',
          'Storage quota error detection — throws user-friendly error when localStorage is full',
          'Text input length limits — project names (150), member names (100), holiday names (100), role names (50)',
        ],
      },
      {
        title: 'Codebase Improvements',
        items: [
          'New validation utility module (src/lib/utils/validation.ts)',
          'StorageQuotaError class for explicit quota handling',
          'Theme init script documented with STORAGE_KEYS reference',
          '437 passing tests across 24 test files',
        ],
      },
    ],
  },
  {
    version: '0.11.0',
    date: '2026-02-02',
    sections: [
      {
        title: 'Dark Mode Toggle',
        items: [
          'Three-state theme toggle (Light / Dark / System) in sidebar',
          'Theme preference persisted in localStorage',
          'No flash of wrong theme on page load (blocking script in <head>)',
          'Tailwind v4 class-based dark mode via @custom-variant directive',
          'System preference mode tracks OS changes in real time',
        ],
      },
      {
        title: 'Allocation Grid UX',
        items: [
          'One-click add member \u2014 select from dropdown to immediately add (no extra "Add" button)',
          'Enter/Return in edit mode saves value and moves cursor down with wrap-around',
        ],
      },
      {
        title: 'US Federal Holidays',
        items: [
          'Bulk-add US Federal Holidays for 2026, 2027, 2028 (11 holidays per year)',
          'Observed date rules (weekend → nearest weekday)',
          'Duplicate detection skips already-added holidays',
        ],
      },
      {
        title: 'Bug Fixes',
        items: [
          'Fixed ThemeToggle SSR hydration mismatch (mounted guard in useTheme)',
          'Fixed useDarkMode returning true when user chose light mode but OS was dark',
          'Fixed RateTable using array index as React key (editing wrong row after deletion)',
          'Fixed reorderAssignments unsafe non-null assertion',
          'Fixed SettingsForm discount rate missing upper bound validation',
        ],
      },
      {
        title: 'Refactoring',
        items: [
          'Extracted shared date formatters (formatDateSlash, formatDateLong, formatDateMedium) to format.ts',
          'Extracted shared chart colors (getChartColors) to svg-utils.ts',
          'Extracted changelog data to changelogData.ts (page dropped from 424 to 63 lines)',
          'ProductivityWindowPanel now uses shared CollapsibleSection',
        ],
      },
      {
        title: 'Housekeeping',
        items: [
          'Deleted 4 stale duplicate files (macOS " 2" copies)',
          '437 passing tests across 24 test files',
        ],
      },
    ],
  },
  {
    version: '0.10.0',
    date: '2026-02-02',
    sections: [
      {
        title: 'Dependencies',
        items: [
          'Updated react and react-dom from 19.2.3 to 19.2.4',
          'Updated @vitejs/plugin-react from 5.1.2 to 5.1.3',
          'Updated @types/node from ^20 to ^24 (matching Node.js 24 LTS runtime)',
          'Updated jsdom from ^27.4.0 to ^28.0.0',
          'Cleaned up extraneous native addon packages',
          'All dependencies at latest stable versions for JFrog vulnerability scan compliance',
        ],
      },
      {
        title: 'Testing',
        items: [
          '387 passing tests across 21 test files (unchanged)',
        ],
      },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-02-01',
    sections: [
      {
        title: 'Traffic-Light Dashboard',
        items: [
          'Three-state traffic-light status on dashboard project tiles (Green/Amber/Red)',
          'Status derived from variance percentage against configurable thresholds',
          'Colored EAC value with status indicator and text label ("On Track" / "At Risk" / "Over Budget")',
          'Traffic-light thresholds configurable in Settings > Dashboard Thresholds',
          'Traffic-light coloring applied to EAC on project detail page summary bar',
        ],
      },
      {
        title: 'Refactoring',
        items: [
          'Consolidated 3 delete dialogs into a single reusable ConfirmDialog component',
          'Extracted drag-to-reorder logic into a generic useDragReorder hook',
          'Extracted collapsible section pattern into a shared CollapsibleSection component',
          'Removed dashboard arrow-key reorder buttons (drag handles are sufficient)',
          'Sticky sidebar navigation on desktop',
        ],
      },
      {
        title: 'Architecture',
        items: [
          'TrafficLightThresholds type added to Settings with data migration v0.7.0',
          'Pure getTrafficLightStatus() and getTrafficLightDisplay() calculation functions',
          'Deleted 3 redundant dialog components and 2 stale untracked files',
        ],
      },
      {
        title: 'Testing',
        items: [
          'Traffic-light status and display tests',
          'Holiday subtraction and productivity window integration tests for calculateProjectMetrics',
          'generateId utility tests',
          '387 passing tests across 21 test files',
        ],
      },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-01-31',
    sections: [
      {
        title: 'Holiday Calendar',
        items: [
          'Global holiday calendar in Settings \u2014 non-work days subtracted from workday calculations',
          'Holiday CRUD table with inline editing, delete confirmation, and date auto-fill',
          'Collapsible Settings sections (Labor Rates, Holiday Calendar) with chevron toggle and count badges',
        ],
      },
      {
        title: 'Allocation Grid',
        items: [
          'Sortable "Team Member" column header (cycles None \u2192 Name A\u2192Z \u2192 Role\u2192Name)',
          'Inline drag handles (\u2839) for manual row reorder',
          'Sticky name column with z-index layering for cell selection outlines',
        ],
      },
      {
        title: 'UX',
        items: [
          'Reforecast dropdown widened with min-w-48',
          'Form input UX polish: placeholder styling, submit guard, numeric clearing',
        ],
      },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-01-30',
    sections: [
      {
        title: 'Architecture',
        items: [
          'Moved Baseline Budget from project-level into each Reforecast for per-snapshot budget tracking',
          'Added Reforecast Date \u2014 user-editable date recording when the reforecast was prepared',
          'Data migration v0.5.0 moves baselineBudget into all reforecasts, derives reforecastDate from createdAt',
          'Dashboard project tiles now show metrics from the most-recent reforecast (by date)',
          'New getMostRecentReforecast() helper with date sort and createdAt tie-breaking',
        ],
      },
      {
        title: 'UX',
        items: [
          'Baseline Budget is now inline-editable in the project summary bar (click to edit)',
          'Reforecast Date picker appears alongside the reforecast dropdown in the toolbar',
          'Switching reforecasts updates Baseline Budget, variance, budget ratio, and chart budget line',
          'Creating a reforecast copies the source budget; date always defaults to today',
        ],
      },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-01-30',
    sections: [
      {
        title: 'Architecture',
        items: [
          'Moved Actual Cost from project-level into each Reforecast for point-in-time cost snapshots',
          'Data migration v0.4.0 moves existing actualCost into the active reforecast',
          'Every new project auto-creates a Baseline reforecast with $0 actual cost',
          'Projects without reforecasts receive a synthetic Baseline during migration',
        ],
      },
      {
        title: 'UX',
        items: [
          'Actual Cost is now inline-editable in the project summary bar (click to edit)',
          'Switching reforecasts updates Actual Cost, EAC, charts, and cost table',
          'Removed Actual Cost from the project create/edit form',
          'Creating a reforecast from an existing one copies its Actual Cost',
        ],
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-01-29',
    sections: [
      {
        title: 'Calculation Engine',
        items: [
          'Replaced fixed "Working Hours per Month" setting with workday-based calculation engine',
          'Available hours derived from actual weekdays (Mon\u2013Fri) \u00D7 8 hours/day',
          'Partial first/last months clipped to project start/end dates for accurate cost calculation',
          'A 2-day project now correctly calculates 16 hours instead of 160',
          'Removed "Working Hours per Month" input from Settings page',
        ],
      },
      {
        title: 'UX',
        items: [
          'Confirmation dialog for team member removal from allocation grid',
          'Empty team pool shows link to Team Pool page instead of dead-end dropdown',
          'Consistent add-member experience in allocation grid',
        ],
      },
      {
        title: 'Architecture',
        items: [
          'Data migration v0.3.0 strips deprecated hoursPerMonth from stored settings',
          'New countWorkdays() and getMonthlyWorkHours() date utilities',
          'HOURS_PER_DAY = 8 constant replaces configurable hoursPerMonth setting',
        ],
      },
      {
        title: 'Testing',
        items: [
          'New workday utility tests (countWorkdays, getMonthlyWorkHours)',
          'Recomputed all golden-file regression test values for workday-based engine',
          '224 passing tests across 16 test files',
        ],
      },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-01-29',
    sections: [
      {
        title: 'Bug Fixes',
        items: [
          'Last reforecast deletion guard \u2014 prevents deleting the only reforecast',
          'Negative budget/actual cost validation with 3-layer protection (HTML, JS clamp, submit)',
          'Import now runs data migrations before persisting (fixes stale-format imports)',
          'Fixed empty-state early return hiding the "+ Add member" control in allocation grid',
        ],
      },
      {
        title: 'Accessibility',
        items: [
          'Skip-to-content keyboard link (hidden until Tab-focused)',
          'Color-only information remediation \u2014 Unicode indicators (\u25B2/\u25BC) and text labels on variance, ratio, and EAC',
          'Keyboard-accessible project reordering (move up/down buttons alongside drag handle)',
        ],
      },
      {
        title: 'UI/UX',
        items: [
          'Mobile-responsive sidebar navigation with hamburger menu',
          'Empty states with dashed borders and hint text across allocation grid, team pool, and metrics panel',
          'Confirmation dialog for reforecast deletion (replaces inline Yes/No)',
        ],
      },
      {
        title: 'Testing',
        items: [
          'Edge-case tests: zero-budget projects, single-month projects, orphaned assignments, productivity windows',
          'Import/export round-trip and migration-on-import tests',
          '204 passing tests across 15 test files',
        ],
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-01-29',
    sections: [
      {
        title: 'Reforecasts',
        items: [
          'Create, switch, and delete reforecasts for any project',
          'Copy allocations from a prior reforecast when creating a new one',
          'Default copy-from selection is the most recently added reforecast',
        ],
      },
      {
        title: 'Productivity Windows',
        items: [
          'Define date-ranged productivity factors that adjust hours and cost',
          'Day-weighted blending for months that span window boundaries',
          'Productivity is a calculation overlay \u2014 stored allocations are never mutated',
        ],
      },
      {
        title: 'Dashboard & UX',
        items: [
          'Drag-to-reorder project tiles on the Dashboard',
          'Auto-focus project name field on New Project form',
          'End date calendar defaults to start date + 1 business day',
          'Currency fields display formatted values ($327,160) and switch to raw input on edit',
          'Team Pool: add-member form moved above the member list, sorting by name or role',
        ],
      },
      {
        title: 'Charts & Metrics',
        items: [
          'Cumulative cost chart now includes actual cost (EAC trajectory)',
          'ETC (Estimate to Complete) added to project summary bar',
        ],
      },
      {
        title: 'Bug Fixes',
        items: [
          'Fixed stale data when navigating away from project edit (debounced save flush)',
          'Fixed productivity factor day-weighted blending calculation',
        ],
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-01-29',
    sections: [
      {
        title: 'Global Team Pool',
        items: [
          'Centralized team member management at /team with add, edit, and delete',
          'In-use guard prevents deleting team members assigned to projects',
          'Project assignments via pool picker in the allocation grid',
        ],
      },
      {
        title: 'Calculation Engine',
        items: [
          'Full calculation engine: ETC, EAC, variance, budget ratio, burn rate, NPV',
          'Golden-file spreadsheet parity tests ensuring math matches the original Excel',
        ],
      },
      {
        title: 'Charts',
        items: [
          'SVG monthly cost bar chart',
          'SVG cumulative cost line chart',
        ],
      },
      {
        title: 'Architecture',
        items: [
          'Data migration system with MigrationGuard component',
          'Repository pattern with async interface for future backend support',
          'Debounced save hook for responsive UI with batched persistence',
        ],
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-01-28',
    sections: [
      {
        title: 'Initial Release',
        items: [
          'Settings page with labor rates, hours/month, and discount rate configuration',
          'JSON export/import for data portability',
          'Project CRUD with dashboard and project detail pages',
          'Allocation grid with inline editing, multi-cell selection, and drag-to-fill',
          'Dark mode support',
          'localStorage-based persistence',
        ],
      },
    ],
  },
];
