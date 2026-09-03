# Changelog

All notable changes to MyScrumBudget are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.37.6] - 2026-09-03

### Fixed
- **A team member's role could be labelled "(rate removed)" when it had not been.** On the Team Pool page, editing a member in the moment before your labor rates finished loading showed their role marked as though its rate had been deleted — the page waits for the team pool to load but not for the settings that hold the rates, so for that moment it had no rates to check against and treated "not loaded yet" as "no rate exists". Nothing was ever saved incorrectly; the label was wrong, not the data. The role selector now stays quiet until it actually knows, and still marks a role whose rate is genuinely gone.

## [0.37.5] - 2026-09-03

### Fixed
- **A team member whose role has no labor rate is now marked in the allocation grid.** The red "Role not in labor rates" marker previously appeared only for people imported from a resource plan carrying the placeholder role "Unknown". If you deleted or renamed a labor rate that people were already assigned to, their cost quietly fell to $0 and the grid gave no sign at all — so the case you are most likely to cause was the one it could not show. Any member whose role has no matching rate is now marked, whatever the cause, and the marker clears again once you add a rate for that role. Nobody is marked while your settings are still loading.

## [0.37.4] - 2026-09-03

Labor rate table fixes. The rate table could end up holding two rates with the same name, and once it did, editing or deleting either one acted on both.

### Fixed
- **Two labor rates can no longer be given the same name.** Renaming a role onto a name that already exists — or adding one — is now refused, with a message naming the rate it collides with, instead of quietly creating a second row with that name. Capitalisation is no longer a loophole: "ba" is treated as the same role as "BA". Rates you already have are left alone; the check applies when you add or rename one.
- **Deleting a labor rate now deletes only the rate you clicked.** When two rates shared a name, deleting either one destroyed both. The table then redrew showing the rate you had just deleted still sitting there and a different one gone, so the loss did not look like a loss until the page was reloaded.
- **Editing a labor rate now opens only the row you clicked, and saving changes only that row.** When two rates shared a name, clicking Edit on one opened both for editing, and a single Save rewrote both.
- **A Save button in the rate table that cannot be used now says why.** Clearing the role name, entering a negative rate, or typing a name that already exists left Save looking usable while clicking it did nothing at all.
- **A team member whose labor rate was deleted no longer looks like they have no role.** The Role dropdown appeared to be sitting on "Select role..." while the member still held the deleted role underneath, so saving wrote it straight back. The dropdown now shows the missing role by name, marked "(rate removed)", so it is clear what has to be re-picked.

## [0.37.3] - 2026-08-27

Documentation only — no application code changed and nothing about how the app behaves is different.

### Fixed
- **The changelog no longer tells you that a cloud saving failure never happened.** The v0.34.0 entry said that creating a project in cloud mode was never broken while one field was missing from the shared security rules, and gave a reason: a field explicitly set to "no value" supposedly did not count towards the rules' field check. That reason is wrong. It has since been tested directly against Firestore's own rules engine, with controls in both directions, and a field explicitly set to "no value" does count — so the check rejected the write. Between 3 June 2026, when project colours shipped, and 16 July 2026, when the rules were corrected, creating and saving projects in cloud mode were rejected.
- Cloud storage is used by almost nobody here and no report was ever received, so whether this reached a real user is **unknown**. That is stated as unknown rather than as no harm, which is the mistake the original entry made.
- The v0.34.0 entry has been corrected here and in `src/app/changelog/changelogData.ts`. The original wording is quoted inside each correction rather than deleted, so a reader who saw the old claim can see exactly what changed and when.

### Note
- The same false explanation was also written into the shared SPERT Firestore rules file, which is not part of this project. It is being corrected separately.

## [0.37.2] - 2026-08-22

Development tooling only — no application code changed and nothing about how the app behaves is different.

### Fixed
- **The mutation-testing safety check no longer passes the run it exists to catch.** Mutation testing makes small deliberate changes to the code and asks whether any test notices. A wrapper around it exists to refuse a run that produced no real results but reports a clean-looking one, because that failure is silent and flattering. The wrapper counted "no test reaches this code" as a real result — so a run in which every single change went unchecked, scoring zero per cent with nothing actually tested, was reported as having produced real verdicts. The precise failure it was written to prevent, surviving inside it.
- **The fix separates two questions that had been sharing one sum.** Whether a change was left unchecked is a real fact about the code, and still counts towards the score exactly as before. Whether the suite ever ran at all is a different question, and an unchecked change is silence rather than evidence. Only the second question changed; one line of running code differs.

### Changed
- **The note explaining it now names no cause, deliberately.** The suite's records blamed one specific misconfiguration for the all-unchecked state. Five attempts were made to produce that state on purpose, across two sibling projects — including the one where the misconfiguration should do the most damage, because its test configuration sits at a non-standard filename with no standard one to fall back on. None of them produced it. The tool either refuses to start when no test covers the changed code, or runs the whole suite and reports the changes as surviving instead. A note explaining a fault by pointing at one cause stops being true when the cause changes; a note describing what is being refused does not.

### Note
- **This project's stored measurement is not evidence for this change, and that is worth stating.** Four hand-built cases were run through the real checking script both before and after the change, and every stored measurement across the projects still passes with an identical score. But the case this change had to leave alone is a run containing some unchecked code, and this project's stored measurement contains none — it passes identically under the old logic and the new, so it cannot tell them apart. Two of the four projects provide that evidence; this is not one of them.

## [0.37.1] - 2026-08-22

Development and release tooling only — no application code changed and nothing about how the app behaves is different.

### Fixed
- **The shared release-checking script no longer says there is no automated checking.** The script that checks a release before it ships is deliberately the same file in all nine SPERT® Suite projects. The note at the top of it said there was no automated checking anywhere in the suite — that a green tick on a proposed change meant only that a preview copy had been built, and that nothing ran the tests. That has not been true since the script existed. Automated checking runs on every one of the nine projects, on every proposed change and on every merge, and what it runs is this very script.
- **The statement did not go out of date — it was untrue on the day it was written.** The same set of edits that added the script also switched the automated checking on, so the file contradicted a change sitting beside it. That distinction decides the remedy, which is why it is recorded here: a statement that decays can be helped by writing down when it was made; a statement that was never true cannot. What went wrong was that a claim about the projects was written into an explanation without being checked against them, and an explanation is read as background rather than as an assertion somebody has to verify.

### Added
- **A note that automated checking and a check run by hand are complementary rather than ranked.** The automated one works from a clean copy, so it catches anything that quietly depends on a file existing only on the author's own machine; but it also has less of the project to look at, so certain checks step aside there and only a hand-run finds what those cover.
- **A note explaining how the code-style step is judged.** That step compares the number of reported issues against an agreed figure instead of reading pass or fail, and it does so for opposite reasons in different projects: in most of them the step reports failure at the agreed figure, so reading pass-or-fail would be too strict; in one it reports success at the agreed figure, so reading pass-or-fail would be too lenient and would let new issues through unnoticed. One mechanism, two reasons. The note also warns that the figure counts every kind of issue rather than the one kind a project set it for, and that when it reaches zero the setting must be removed rather than set to zero — at zero the tool prints no count at all, and the step then fails asking for a number that was never printed.

## [0.37.0] - 2026-08-20

### Fixed
- **Cloud storage did not actually store anything in the cloud after the first page load — and the app said it did.** Turning cloud storage on worked for as long as you stayed on the page. From the next page load onward, everything you did was saved to this browser instead, while the cloud badge in the top bar still showed cloud storage as active. Nothing failed, nothing was reported, and the work looked saved because it was saved — to the wrong place. Projects created or edited after that point never reached the cloud, so they would not appear on another device and were not backed up.
- **Signing out could then delete the local copy.** When you signed out of cloud storage, the app cleared this browser's copy of your work on the reasonable assumption that the cloud already had it. Because of the fault above, sometimes it did not. Sign-out now checks that your work really is in the cloud before clearing anything local, and simply skips the clean-up if it cannot confirm it. Leaving a stale copy behind is harmless; deleting the only copy is not.

### Changed
- **The fix removes the pattern that allowed this, rather than patching the symptom.** Which storage the app uses is no longer a setting recorded in one place and a decision made separately somewhere else — it is now worked out directly from whether you are signed in and which mode you chose, in one place, every time. The practical consequence is that the app can no longer display one storage mode while using another, and a test can now ask which storage is in use and get an answer. That test did not exist before, and could not have been written.

### Note
- This affected cloud storage only. If you use MyScrumBudget without signing in — the default — nothing was ever at risk and nothing about your data changes.

## [0.36.16] - 2026-08-19

### Changed
- **Microsoft sign-in now requires a work or school account.** Personal Microsoft accounts — outlook.com, hotmail.com, live.com — are no longer accepted, and are refused at the sign-in screen before any password is entered. Microsoft itself enforces this, not the app. The change was made for institutions evaluating the Suite, who reasonably expect "sign in with Microsoft" to mean an organisational account rather than any account at all.
- **Nothing changes for personal use — sign in with Google instead.** Google still accepts personal accounts, so anyone can still enable cloud storage. The cloud storage window and the Settings page now say so, rather than letting you choose Microsoft and discover the restriction from an error message.

## [0.36.15] - 2026-08-17

Comments only — nothing about the app changed, and no code runs differently.

A note in this project's build-check configuration stated that two sibling projects had been verified as free of type errors, including in their test files, and so did not need the extra check this project carries. That was tested and holds for only one of the two. The check the claim rested on cannot see test files at all, so it reported success without ever examining them — and one sibling has in fact carried three such errors, undetected, since July. The note now records what was measured, where, on what date, and with which command.

## [0.36.14] - 2026-08-16

Comments only — nothing about the app changed, and no code runs differently.

Two files that handle signing in and accepting a project invitation now carry a written note explaining that they were deliberately left without tests, what was measured before that decision was taken, and on what date. The note is there so the next person to look does not have to re-measure to find out whether it was a considered choice or an oversight. It was a considered choice.

This closes the maintenance run that began at v0.35.1 — a stretch of releases spent on tests, measurement and internal safeguards rather than features. Across it the app gained no new capability and changed no stored data. What it gained is roughly three hundred additional tests, checks the compiler now performs before a build can succeed, and a written record beside several decisions that were previously only implicit.

Normal feature work resumes after this.

## [0.36.13] - 2026-08-16

Mostly tests, plus three lines of dead code removed — so not tests-only, though nothing you can see behaves differently.

The project Sharing panel — where you invite collaborators by email, see who has access, and resend or revoke pending invitations — had no tests at all. It is the largest untested file left in the project, and it now has seventeen.

Some of what those tests now hold in place: only the project owner sees the panel; a failed load shows an error message rather than silently hiding it; the collaborator list excludes the owner from its "Remove" controls; a pending invitation that has been resent five times shows its Resend button disabled; and removing or revoking always asks for confirmation first.

**A correction to what v0.36.11 told you.** That release said an over-length email address is shown as Invalid and "the box keeps its contents so you can correct it." That is true only when nothing else in the box was valid. If you paste one over-length address alongside several good ones, the good ones are sent and **the box is cleared** — the over-length address remains visible as an amber Invalid chip, but its text is gone from the box. Both behaviours are now tested; the earlier entry is left as written, since shipped release notes are annotated rather than rewritten.

The dead code: a leftover import and an unreachable line, along with a comment referring to a file deleted back in v0.28.2.

## [0.36.12] - 2026-08-16

Tests only — no functional, data, or interface changes. The app behaves identically to v0.36.11.

The code that reads and writes your data when cloud storage is switched on had no tests at all. It has thirty now.

This is the layer that saves a project to the cloud, reads it back, creates a new one, imports a whole workspace, and deletes things. Every one of its twenty-one functions had never been executed by a test — while also being simple enough, function by function, that the project's complexity checker had nothing to say about it. It was invisible to both of the automated checks this project runs, which is a large part of why it needed doing by hand.

Some of what is now pinned down:

- A save writes exactly nine fields and deliberately leaves seven others alone — ownership, creation date, ordering and similar. That omission is what lets the import feature replace a project's contents without stealing its ownership, and nothing was checking it.
- Clearing a project's colour or un-archiving it has to write an explicit "empty" rather than simply omitting the field, or the old value survives in the cloud. Now tested in both directions.
- Reading a project back drops the cloud-only bookkeeping and restores cleared values as genuinely absent rather than as empty ones.
- A settings record saved before v0.27.0 is missing the violet threshold. It gets filled in from defaults while keeping whatever you had customised — this was a real bug fixed in v0.27.0 and it now has a test. The three neighbouring fields that look like they have the same bug do not, for a reason now written down, so nobody "fixes" them into a genuine one.

One known rough edge is now documented rather than repaired: importing a whole workspace into the cloud resets each project's creation date and ordering. That was already on the tech-debt list. The test asserts the current behaviour in a form that will fail — correctly — on the day someone fixes it, rather than in a form that would have to be rewritten.

## [0.36.11] - 2026-08-16

**Behaviour change, and a low-severity performance guard, on the bulk-invite email box.**

**What changes for you.** When you paste a list of addresses into the project Sharing box, any single address longer than 320 characters is now shown as **Invalid** (the amber chip) instead of being accepted. It is not discarded — it stays visible with the rest, and the box keeps its contents so you can correct it. Previously such an address was accepted and sent onward.

320 is deliberately generous. The email standard caps a whole address at 254 characters; 320 is the loosest figure the standard can be read to allow, so nothing a mail system would consider legal is rejected. **What happens to an over-length address once it leaves this app was not verifiable from this codebase** — the sending step runs in a separate service — so this release makes no claim about that, only that such an address is beyond the standard's maximum and you now see the problem when you paste rather than after you send.

**The performance part, severity LOW.** The pattern used to check an address had a worst case that took about a second on a single 64 KB pasted token, which would briefly freeze the tab. It is low severity and not a vulnerability fix: the input is your own paste, it stays in your own browser tab, and there is no remote or cross-user path to it. The length check bounds it — at the cap the worst case is around a thirty-thousandth of that.

Also corrected: a comment in that file referred to a companion pattern that was deleted in v0.28.2.

Two similar-looking patterns used to build filenames for exports were examined and left alone, with the reasoning recorded next to them. They are safe because of the order the replacements run in, not because the pattern is inherently safe — a note worth having, since reusing that pattern elsewhere would not be.

## [0.36.10] - 2026-08-16

Compile-time safeguards only — no runtime behaviour change, no data-model change. The app does exactly what it did in v0.36.9, and the cloud sync path was verified to produce byte-identical results before and after.

This is the first release in this maintenance run to touch code the app actually runs, so it is worth being precise about what changed: three checks were added that the TypeScript compiler evaluates before the app is ever built. Nothing was added to the running program.

The project record the app stores in the cloud is described in a second place, by hand, separately from the project record the app uses internally. Nothing connected the two descriptions, so adding a field to a project could leave the cloud copy quietly short — and every place that writes to the cloud would still compile, because each is checked against the hand-written copy rather than against the real thing. That is not hypothetical: the tile colour added in v0.33.0 went missing from imports for seven releases before anyone noticed.

Adding a field already produced one compiler error, in the import sanitiser, naming the field. What that error does not do is mention the cloud, so it is possible to satisfy it and stop. There are now three errors instead of one, at three different layers, each naming the missing field: the internal-to-cloud mapping, the list of fields a save writes, and — the one nothing on the writing side could ever catch — the step that reads a cloud record back into the app. A field can be written correctly by every save and still never appear on screen, and no test that runs without the cloud would notice.

Two other ways of writing the first check were measured and rejected. One produced an error that never named the missing field. The other was silent: it looked like the stronger form and quietly accepted exactly the case the check exists to catch.

Equivalence was proven rather than reasoned about — the order of fields sent on a save, and a fully populated cloud record read back including the cleared-value cases, were captured before and after the change and compared. Identical.

## [0.36.9] - 2026-08-15

Tests only — no functional, data, or interface changes. The app behaves identically to v0.36.8.

A large group of tests that appeared to cover the reforecast logic were testing copies of it instead.

Fifty-eight tests carried the name of the code that creates, switches, deletes and edits reforecasts. Four of them actually ran that code. The other fifty-four ran hand-written imitations kept inside the test files, and passed whether or not the real code worked.

The more serious problem is that the imitations had fallen out of date. When you copy a reforecast, it takes its start and finish dates from the reforecast you copied — that has been true since v0.29.1. The imitation still took them from the project, the way the app worked ten releases earlier, and it also failed to carry across the actuals cutoff date and the month-by-month cost breakdown. So those tests were not merely silent about the real behaviour; they quietly insisted on behaviour the app had abandoned. Anyone reconciling the code to them would have undone the newer, correct version.

One test file was headed "B1 regression coverage" and pinned a named, already-fixed bug against a copy of the very code that had contained the bug. Removing the fix from the real code did not fail it.

All thirteen imitations across three files are gone, replaced by tests that drive the real code. Removing the fix now does fail that regression test, and rewiring the team logic so it edits every reforecast instead of the active one now fails three tests — neither of which was possible before. A further set of operations that had never been tested at all is now covered, including the allocation grid's write path, the two timeline-commit paths, and both halves of the actuals-cutoff behaviour.

The reforecast test file is 109 lines shorter than it was: the imitations leaving.

## [0.36.8] - 2026-08-15

Tests only — no functional, data, or interface changes. The app behaves identically to v0.36.7.

Two checks that run on every file you import turned out never to have been tested. Both are now.

The first concerns the Charter Budget. When you import a file, the app verifies that the five risk-profile answers it carries — project type, requirements clarity, team experience, organisational change, integration complexity — along with the chosen distribution, are all values it recognises. There are twenty-one such values, and only six had ever appeared in a test. If any of the other fifteen had been lost or mistyped, a perfectly valid saved file would have been rejected on import and the charter budget inside it silently dropped. All twenty-one are now checked, and the full list is written out so that adding a new option without a matching check fails immediately.

Worth noting why the tests take the shape they do: a test that confirms a *bad* value is rejected still passes if a *good* value has gone missing from the list. Only a test that confirms each good value is accepted can catch that, so there is now one per value.

The second concerns holidays. The check that validates each holiday entry in an imported file had never run at all — not once, in any test. Every existing test happened to supply a file with an empty holiday list, so the check was reachable but never reached. It is now tested one branch at a time, including a name made only of spaces, a date that looks right but does not exist on the calendar, and a faulty entry sitting second in the list rather than first.

Each new test was verified by deliberately breaking the corresponding check and confirming the right test — and only the right test — failed.

No production code changed in this release. The file containing both validators is byte-for-byte identical to v0.36.7.

## [0.36.7] - 2026-08-14

Internal restructuring and tests — no functional, data, or interface changes. The chart it concerns draws exactly as before.

The small distribution chart in the Charter Budget panel had no tests, and could not have had useful ones in the form it was in.

It is drawn onto a canvas, and the drawing code returns nothing — there is no result to inspect. The testing environment used here cannot produce a canvas at all, so a test that simply called the drawing function would have run three lines, stopped, passed, and reported the file as better tested than before while checking nothing whatsoever. That kind of test is worse than none, because it removes the appearance of a gap without removing the gap.

The fix was to separate the decisions from the drawing. Two pieces were lifted out: the one that works out how wide the chart's horizontal axis must be, and the one that computes the curve's height at a given point. Those are ordinary calculations with inputs and outputs, and they are where the judgement calls live — how far past the expected cost to extend the axis for each distribution shape, how to handle a spread wide enough that the curve would otherwise run into negative money, and how much room to leave so the confidence-level marker is never flush against the edge.

Twenty-three tests now cover those decisions. They check properties rather than specific numbers — where the curve peaks, whether it is symmetric, which regions are exactly zero — because the curve is drawn for its shape and its absolute height is deliberately arbitrary. Checking specific heights would have failed against perfectly correct code.

The restructuring was verified to change nothing: the complete sequence of drawing instructions was recorded before and after, across five different chart configurations, and compared instruction by instruction. All 2,014 were identical.

One side effect worth noting: the drawing function is no longer flagged as too complicated to follow, so the project's accepted count of such functions falls from fourteen to thirteen.

## [0.36.6] - 2026-08-14

Tests only — no functional, data, or interface changes. The app behaves identically to v0.36.5.

The step that merges an imported file into your existing data is now fully covered by tests.

This is the code that decides, project by project, whether an import adds something new, replaces something you already have, or leaves it alone — and being wrong there means silently losing or overwriting work. It was the most intricate single function in the project and the least completely tested of the ones that matter.

The largest gap was that every existing test ran against local browser storage. The cloud path was untested end to end, including the step that assigns a fresh identifier to each imported project before saving. That step exists because an imported project may carry an identifier that already belongs to someone else's project in the cloud; reusing it would collide. Both modes are now tested, and tested against each other, so the difference between them is pinned rather than assumed.

Also newly covered: what happens when the project an import means to replace has been deleted or renamed by someone else in the meantime, when a different project has since taken the name, when saving the team pool or settings fails, and when a failure arrives in an unexpected form. Several of these paths end in a deliberate decision to add rather than replace — protecting an unrelated project from being overwritten — and none of them had been exercised.

A decision was also recorded not to split this function into smaller pieces. The tests are now strong enough that restructuring it would be safe, which was the open question; the reason for leaving it alone is that every way of splitting it produces a new piece nearly as complicated as the original. That reasoning, and the measurements behind it, now sit alongside the code.

## [0.36.5] - 2026-08-14

Tests only — no functional, data, or interface changes. The app behaves identically to v0.36.4.

The part of the app that receives changes from the cloud now has tests. It had none at all.

When Cloud Storage is switched on, the app listens for changes made elsewhere — in another browser tab, on another machine, or by someone the project is shared with — and reloads the affected data when they arrive. That listening layer had never been exercised by a single test, despite being where several past defects have lived.

Four behaviours are now pinned. Changes the app itself just made are recognised as its own and ignored, rather than being treated as news from elsewhere and reloaded in a loop. A change to settings reloads both settings and the team pool, because the two are stored together. When access to a project is withdrawn — a share revoked, or a sign-out elsewhere — the affected data is dropped from view deliberately and without an error message, since the person concerned generally caused it. And a genuine connection failure produces exactly one warning rather than two, even though there are two listeners that can fail at once.

Two of the checks pinned here are from an earlier security review: when a listener fails, the message written to the browser's developer console contains only an error code, never the underlying details, which can carry project identifiers. That was previously guaranteed by nothing but the code itself.

Also recorded, without changing any behaviour: the listening layer is set up when the signed-in user changes, and reads the storage mode at that moment. Switching between local and cloud storage without signing in or out therefore relies on the app reloading the page to reattach the listeners — which it does today. The code now says so, and says what would need to change if that reload ever went away.

## [0.36.4] - 2026-08-14

Tests only — no functional, data, or interface changes. The app behaves identically to v0.36.3.

Two safety checks that had never been tried are now tried.

An audit two years of releases ago added a set of defensive checks across the app. Most of them have been exercised by the tests ever since. A review of all seventeen found that eleven had never actually run — and two of those eleven were worth fixing immediately, for opposite reasons.

The first limits how long a name or role may be in an imported spreadsheet, so that a deliberately malformed file is rejected cleanly at import rather than failing later with an unhelpful message. The check is consulted on every row of every import — twenty times over in the tests alone — and had never once rejected anything, because no test had ever supplied an over-long value. Being consulted constantly is what made it invisible: by the usual measure, the code looked thoroughly tested.

The second keeps the contents of a failed save out of the browser console, so that a project's team details cannot end up in a log. The line carrying that guarantee had never executed, because no test had ever made a save fail — in a file where the usual measure reported that most of the code was exercised.

Both are now covered, including the exact boundary cases, so a future change that weakens either would be caught. Neither check was altered; only tested. Nine of the eleven remain unexercised and are recorded for later — most of them sit in two parts of the app that have no tests at all, which is a larger piece of work than this one.

## [0.36.3] - 2026-08-14

Internal record-keeping only — no functional, data, or interface changes. The app behaves identically to v0.36.2.

A decision not to restructure the spreadsheet import, and the measurement behind it.

The function that reads an uploaded resource-plan spreadsheet is the most intricate single piece of code in the project by some distance. It is an obvious candidate for being broken into smaller parts, and this release deliberately does not do that — because the tests around it turned out not to be strong enough to make the move safely.

The distinction matters. A test can run a line of code without checking that the line is right. Measuring the second thing rather than the first showed that around a third of deliberate changes to this function go unnoticed by the tests, despite nearly ninety per cent of its branches being exercised by them. Restructuring code whose tests do not pin down its behaviour is how a rewrite quietly changes what the software does, so the order has been reversed: strengthen the tests first, then revisit the structure.

The standard the decision was measured against was written down before the measurement was taken, rather than chosen afterwards to fit it. That reasoning now sits alongside the code, together with the specific gaps to close and the shape the restructuring should take once it is safe — including the observation that the obvious split would create a new piece almost as intricate as the problem it solves.

One gap found along the way is worth naming: the limits on how long a name or role may be in an imported spreadsheet, added as a security measure, have never been exercised by any test.

## [0.36.2] - 2026-08-14

Bug fix. No data or interface changes.

The first-visit notice about the Terms of Service was causing an error on every page load, for every visitor who had not yet dismissed it.

The error was invisible in the sense that mattered least and visible in the sense that mattered most: nothing looked wrong on screen, because the browser silently recovered by discarding the page it had received from the server and rebuilding it. But it was a genuine error, reported on every load, and the rebuild it forced is wasted work on the very first impression of the app.

The cause was a notice that decided whether to show itself by reading the browser's stored settings while the page was first being assembled. The server has no access to those settings and concluded the notice should be hidden; the browser read them and concluded it should be shown. The two disagreeing about what the page contains is precisely the condition browsers report as an error. The notice now starts hidden everywhere and decides whether to appear immediately afterwards, once the page is settled — which is how its sibling notice, the one about data living only in this browser, has worked since v0.21.6.

That sibling is the reason this is worth explaining. It had exactly the same bug, fixed fifteen releases ago. This one was missed because the comment sitting above the faulty code asserted that it was safe — so every subsequent reader, including the one who fixed the sibling, had been told there was nothing to look at. The comment has been corrected to say what the sibling's says, and now records why the pattern is unsafe rather than claiming it is fine.

Every other place in the app that reads stored settings this way was then checked rather than assumed. All of them sit inside a part of the app that does not render until the page has settled, so none of them can produce this error. One of those — the Dashboard's check for whether labor rates have been reviewed — is safe only because of where it sits rather than how it is written, and now says so, along with what would make it unsafe again.

## [0.36.1] - 2026-08-14

Tests only — no functional, data, or interface changes. The app behaves identically to v0.36.0.

The Dashboard now has tests. It did not have any.

That was the largest untested surface in the project, and the one most often changed: the Dashboard screen has been edited seventeen times, more than any comparable piece of the code, while nothing checked that any of those edits left it working. The whole page-level layer of the app — the screens themselves, as opposed to the pieces they are assembled from — had no tests at all.

The most valuable of the new tests protects against silent data loss. Archived projects are hidden from the Dashboard, and dragging a project card to reorder it rewrites the saved list of projects. If the reordering were ever wired to the visible cards rather than to every project, dragging one card would permanently delete every hidden archived project — no error, nothing on screen, the projects simply gone at the next save. That risk was previously guarded only by a written warning in the code. It is now guarded by a test, which was confirmed to fail when the mistake is deliberately introduced.

The remaining tests pin the behaviours a future change is most likely to break by accident: archived projects stay hidden until asked for, archiving your last project shows an "all projects are archived" message rather than resurrecting the first-run setup guide, and deleting a project asks first and does nothing if you decline.

## [0.36.0] - 2026-08-14

Testing tools only — no functional, data, or interface changes. The app behaves identically to v0.35.2.

The project can now check whether its tests would actually notice a mistake.

Test coverage answers a narrower question than it appears to. It reports which lines ran, not whether anything checked the result — a test that calls a function and inspects nothing counts exactly the same as one that verifies every number it returns. Mutation testing asks the harder question directly: it makes small deliberate changes to the code, one at a time, and re-runs the tests. Any change the tests fail to complain about is a change that could be made by accident and shipped unnoticed.

That distinction turned out to matter immediately. The file that computes project metrics has every line and branch covered by tests, and still failed to notice when the sort was removed from the list of active months — the tests checked which months came back, never in what order.

The calculation engine now has a recorded baseline of 88.8%. Two files that already had complete line coverage were found to be leaking; one file — the statistical helpers behind the Charter Budget — had no tests of its own at all and was reached only sideways, so both of its extreme-value branches had never once run. It has proper tests now, which is what moved the engine's figure from 73.6%.

The same tooling was pointed once at the import checks tightened in the previous release, to confirm that work was real rather than merely present. Every one of the two hundred deliberate changes made to that area was caught, after one gap was found and closed: a check on month formats could be loosened to accept text in front of the date, and nothing objected.

This is deliberately a recorded measurement rather than a release requirement — it takes minutes to run and is not part of the release checks. The runner refuses to report a result when a run fails to start, because a run that never starts finds no problems and looks, to anything reading the output, exactly like a run where nothing is wrong.

## [0.35.2] - 2026-08-14

Internal safeguards only — no functional, data, or interface changes. The app behaves identically to v0.35.1.

Two protections around importing a project file, both covering the same weakness: checks that existed but had never been shown to work.

The first is the part of the import that rejects malformed data. When a file is imported, every field of every reforecast is checked — dates are real dates, costs are not negative, an end date is not before its start date. Those checks were written, but almost none of them had ever been observed rejecting anything: of the twenty-three ways a reforecast can be refused, twenty had never once been triggered in testing. Four further checks — covering staffing assignments, monthly allocations, productivity windows and recorded historical costs — had never run at all, because every test file happened to leave those lists empty. A check that has never rejected anything is indistinguishable from one that cannot. Sixty-three tests now drive each one, starting from the rejection rather than the acceptance, so a check that stopped working would be noticed.

The second protects against a specific mistake that has already happened once. Imported files are rebuilt field by field from a list of permitted fields, so that nothing unexpected can be smuggled in. The risk is the opposite one: if a new field is added to the app and nobody adds it to that list, the field is silently discarded on every import. That is exactly what happened to project tile colour, which was quietly dropped from every imported file for seven releases across six weeks before anyone noticed. The list is now derived from the field names themselves, so leaving one out stops the build and names the missing field instead of failing silently. Both failure modes were deliberately triggered to confirm the protection fires before it was relied on.

One function in this area is more intricate than the project's complexity limit allows. It was measured rather than assumed, and deliberately left alone: the obvious way to break it up would scatter a single readable checklist across several places without making it any simpler. The reasoning is now recorded alongside the code, and the function is fully covered by the new tests instead.

## [0.35.1] - 2026-08-13

Tooling only — no functional, data, or interface changes. The app behaves identically to v0.35.0.

The tool that measures how much of the code the tests actually run is now declared as part of the project.

It had been in use without ever being written down. The measurements it produced were real, but they relied on a package that happened to be sitting on one machine and was recorded nowhere. A fresh copy of this project would not have had it, and a routine clean reinstall would have quietly removed it. A measurement nobody else can repeat is not much better than no measurement at all, and this one was being used to decide which parts of the code to work on next.

Declaring it fixes that. A clean copy of the project now installs the tool along with everything else, so the coverage figures can be checked rather than taken on trust. This was verified the only way worth trusting: by deleting every installed package, reinstalling from the recorded list alone, and confirming the measurement came back identical — 152 files, 44.89% of branches.

The package is version-matched to the test runner already in use, and has been published for 113 days, comfortably clear of this project's 60-day waiting period before a new dependency is adopted. Nothing else moved: eleven supporting packages were added, none removed, and no existing package changed version.

## [0.35.0] - 2026-08-13

Tooling only — no functional, data, or interface changes. The app behaves identically to v0.34.9.

The release checks now measure how hard each function in the code is to follow, and refuse a release that makes it harder.

The measure is cognitive complexity: roughly, how much you have to hold in your head at once to be sure what a piece of code does. Every branch, loop and nested condition adds to it, and code nested inside other code counts for more than the same logic laid out flat. Fourteen functions currently score above the limit of fifteen. That number is recorded as the accepted starting point — a baseline, not a list of faults. None of those functions changed in this release, and the goal is not to drive the count to zero. Some of them are complicated because the thing they do is complicated, and simplifying them for the sake of the number would be a poor trade.

What the check buys is that the number cannot drift unnoticed. A release that introduces a fifteenth is refused. So is a release where the count falls to thirteen without the recorded baseline being updated in the same change — otherwise a function that was quietly relocated rather than genuinely simplified would read as progress. Both directions were deliberately triggered and confirmed to fail before the check was trusted.

A new command reports the score for every function in a file rather than only those over the limit, and can estimate what a block of code would score if it were lifted out into a function of its own. That second mode exists so that a decision to split something up — or to leave it alone — can be made before any code moves.

## [0.34.9] - 2026-08-02

Licensing only — no functional, data, or interface changes. The app behaves identically to v0.34.8.

`LICENSE` remains a byte-for-byte copy of the canonical file in the SPERT® Suite landing-page repository, differing only in the project repository URL on line 4. It goes from 726 lines to 756. What the licence permits is unchanged: anyone may still use, study, modify and share this software freely. What changed is the set of conditions attached to it, which now number six rather than four, and each now follows the wording of the standard licence itself rather than paraphrasing it. That matters more than it sounds — the standard licence lets whoever receives the software delete any added condition that strays outside the short list it allows, so a condition worded too ambitiously protects nothing at all.

Two conditions are new. The first says the author's name may not be used to endorse or promote a product built from this software without permission. Nothing else in the licence covered this: the project's trademarks are protected whether the licence mentions them or not, but a personal name has no such protection, and another condition requires that name to stay in the source code. The second applies to anyone who resells this software with a warranty or support contract of their own — if those promises create a liability that lands on the original author, the reseller has to cover it.

One condition was rewritten. The one covering on-screen credit used to require any modified version with a user interface to display a notice. The standard licence permits requiring that existing notices be preserved, not that new ones be created, and it says elsewhere in as many words that a modified work need not add such notices where the original had none. The condition now requires that where a modified version already shows legal notices, the original author's name is kept among them.

Two smaller changes: a modified version may no longer misrepresent where this software came from, and the trademark condition now says plainly that naming this project in order to describe honestly what a fork was derived from is not itself prohibited, provided it does not suggest this project endorses the result.

## [0.34.8] - 2026-07-31

Tooling only — no functional, data, or interface changes. The app behaves identically to v0.34.7.

The release checks could only ever be told about one changelog file, so any other copy a project kept was invisible to them. Six of the nine SPERT® Suite repositories keep the same history in two or three places at once. They can now be told about all of them, checked either as an exact copy or as an in-app version history whose newest entry must match the release being shipped.

This project keeps two: this file and the version history built into the app. The new check on the second one is deliberately redundant — the test suite already refuses a release where any of the 84 versions is missing from one side or the other. That remains the stronger guard, because it checks every version rather than only the newest. The new check simply fails sooner and says which file to fix. Both are kept.

Each new check was deliberately broken before being trusted: a copy was altered, an entry was removed, and a file was deleted, and the checks were confirmed to fail in each case.

## [0.34.7] - 2026-07-31

Tooling only — no functional, data, or interface changes. The app behaves identically to v0.34.6.

The automated release checks were told to run on "Node 24", written directly into the workflow file. That is not the same as the version this repository pins: it resolves to whichever 24.x release the build service happens to have on hand, and the pin recorded alongside the source was never read. The workflow now reads that file, so the version is stated in exactly one place.

The version actually selected is unchanged, because the pin here names a major line rather than an exact release — deliberately, so each build picks up the newest secure patch in that line. What changes is that a companion repository which holds back from the newest Node release on purpose, to avoid a fault that breaks server-rendered pages, will have that instruction honoured once it gains the same checks rather than silently overridden.

## [0.34.6] - 2026-07-31

Record-keeping only — no functional, data, or interface changes. The app behaves identically to v0.34.5.

**This file and the in-app changelog now hold the same 84 versions, which has never been true before.** v0.34.5 transcribed the sixteen-version run between v0.17.0 and v0.5.0; this release closes the remaining five — v0.18.6, v0.18.7, v0.18.8, v0.20.0 and v0.28.0 — which are scattered rather than contiguous and insert at three separate anchors. 12 sections and 44 bullets, transcribed from `src/app/changelog/changelogData.ts` and verified character-for-character against it, nothing paraphrased.

`KNOWN_MISSING_FROM_MARKDOWN` goes to zero. **It is kept at zero length rather than deleted, along with the two tests that read it**, because emptied they assert something strictly stronger than they did while it held names: "opens no NEW gap" becomes a plain every-version-is-in-both check with no exemptions available, and the ratchet beside it becomes a guard against anyone reintroducing one. Deleting the list would mean deleting both, and the next release that forgot an entry would land unnoticed — which is precisely how 21 versions accumulated here in the first place. Both directions were re-verified by mutation after emptying, rather than assumed: a version added to the app without a `CHANGELOG.md` entry fails, and a name added back to the list fails.

That also closes the silent-heading hole recorded in v0.34.5. A malformed heading was invisible *because* the version could sit on the exemption list; with nothing left to exempt, a mis-formatted entry now fails the no-gap check outright.

Two of the nine suite repositories still carry this defect: SPERT Scheduler is missing 33 versions and GanttApp 17, both recorded and ratcheted the same way. MyScrumBudget is the first to reach zero.

### Changed
- Backfilled v0.18.6, v0.18.7, v0.18.8, v0.20.0 and v0.28.0 into `CHANGELOG.md`, transcribed verbatim from the in-app changelog data.
- Emptied `KNOWN_MISSING_FROM_MARKDOWN` in `src/lib/__tests__/changelog-surfaces.test.ts`, keeping the list and both ratchet tests in place, and typed it `string[]` so the empty literal does not infer `never[]`.

## [0.34.5] - 2026-07-31

Record-keeping only — no functional, data, or interface changes. The app behaves identically to v0.34.4.

**Sixteen releases the app has always rendered were missing from this file.** v0.6.0 through v0.16.3 — a single unbroken run sitting between v0.17.0 and v0.5.0 — have been in the in-app changelog since the day each shipped, and were never written into the repository's own record. All sixteen are now transcribed from `src/app/changelog/changelogData.ts`: 43 sections and 167 bullets, verified character-for-character against the data file rather than retyped. Nothing was paraphrased, summarised or improved on the way across. Where an old entry reads awkwardly it still reads awkwardly — rewriting it would make the two surfaces disagree in content while agreeing in version, and no guard can detect that.

The recorded gap falls from 21 versions to 5. The rest — v0.18.6, v0.18.7, v0.18.8, v0.20.0 and v0.28.0 — are scattered rather than contiguous and land at three separate anchors, so they are left to a following release. This is the first slice of a suite-wide backfill: SPERT Scheduler is missing 33 versions and GanttApp 17, recorded the same way.

One finding from the ratchet is now written into the guard itself. A backfilled entry whose heading does not match `## [X.Y.Z] - YYYY-MM-DD` exactly is invisible to the test's regex, and on its own that failure is **silent** — the entry sits in the file, uncounted, while all seven assertions pass. Verified by appending a deliberately malformed heading and watching the suite stay green. What catches it is removing the version from `KNOWN_MISSING_FROM_MARKDOWN` in the same commit, which converts the miss into a "never written into CHANGELOG.md" failure. The two halves have to move together, and the guard now says so.

### Changed
- Backfilled v0.6.0 – v0.16.3 into `CHANGELOG.md`, transcribed verbatim from the in-app changelog data.
- Lowered `KNOWN_MISSING_FROM_MARKDOWN` in `src/lib/__tests__/changelog-surfaces.test.ts` from 21 entries to 5, as the ratchet requires.
- Corrected that guard's header comment: it claimed 81 in-app and 60 markdown entries (both off by one, having been written before the release that shipped them) and put SPERT Scheduler's gap at 34, which became 33 when v0.57.1 was restored there.

## [0.34.4] - 2026-07-30

Release-process hardening, and a class of type error that had been invisible. No functional, data, or interface changes — the app behaves identically to v0.34.3.

`next build` type-checks the production build graph, but **not test files**. Running `tsc --noEmit` across the whole repository — which nothing had ever done here — surfaced 33 errors sitting in five `__tests__` files. All of them traced to six `vi.fn<Args, Return>()` call sites: Vitest 4 replaced that two-type-argument form with a single function type, and under the old form the mocks silently resolved to `never`. Those tests were not type-checking their own mock usage at all, and every argument passed to a mock was being accepted regardless of type. The six call sites are corrected and a `typecheck` script now runs in the gate, separately from `build`, so the gap cannot reopen. All 1,163 tests pass unchanged — types are erased at runtime, so this corrects the checking, not the behaviour.

This release also adds the SPERT® Suite ship gate: `npm run shipgate` locally, and the same script in CI on every pull request and push to `main`. It is the first continuous integration this repository has ever had; until now a green check meant Vercel had built a preview, not that the tests had run, because nothing ran them.

One note on the `LICENSE` guard below. Of the nine repositories audited on 2026-07-29, this one was the **only** copy already byte-identical to the canonical file. It is guarded anyway: being correct once is not a mechanism, and every other repository in the suite was correct at some point too.

### Added
- **`npm run shipgate` — the release gate.** Verifies that `package.json`, both version fields in `package-lock.json`, `APP_VERSION` and the newest `CHANGELOG.md` entry agree, checks `CLAUDE.md` for a stale version claim, then runs lint, the type check, the tests and a production build. It reports every disagreement in one run rather than stopping at the first.
- **Continuous integration** (`.github/workflows/shipgate.yml`), running the same `npm run shipgate` on every pull request and push to `main`, so the local gate and the automated one cannot drift apart. It installs with `npm ci`, which refuses to run if the lockfile and `package.json` disagree.
- **`npm run typecheck`** — `tsc --noEmit` across the whole repository, including tests.
- **A guard that the two changelog surfaces agree.** `CHANGELOG.md` is missing 21 versions that `changelogData.ts` has always rendered; that backlog is now recorded explicitly and guarded in both directions, so no new gap can open and a backfilled version must be removed from the record. The guard also asserts that no entry or section renders empty — the failure that left two SPERT Forecaster entries blank in-app for weeks.
- **A guard that `LICENSE` matches the canonical suite licence** — one SHA-256 of the licence body, normalised for the repository URL on line 4.
- **A guard that every static asset linked from source exists in `public/`** — the Quick Reference Guide and Charter Budget Guide PDFs, and the favicons.

### Fixed
- **Six `vi.fn<Args, Return>()` mock declarations were silently typed `never`.** Vitest 4 takes a single function type instead of the old two-argument form, so `vi.fn<[], Promise<Project[]>>()` produced a mock that accepted anything. Corrected to `vi.fn<() => Promise<Project[]>>()` and equivalents in `useProjects`, `tabCloseFlush`, `signOutCleanup`, `ThresholdSettings` and `pendingSaveRegistry` tests.

## [0.34.3] - 2026-07-29

Licensing only. No functional, data, or interface changes — the app behaves identically to v0.34.2.

The `LICENSE` file now **reserves the SPERT® brand explicitly**. It has always required that the original author attribution be preserved, but it said nothing at all about the brand, which left room to read the GNU GPL v3's redistribute-and-modify freedom as carrying the *name* along with the code. That was never the intent. Two new clauses in the ADDITIONAL TERMS section close the gap: a **Trademark Reservation** under GPL v3 §7(e), naming "SPERT", "Statistical PERT" and "Estimation Made Easy" as trademarks registered with the USPTO and "GanttApp" and "MyScrumBudget" as unregistered common-law marks, and granting no right to use any of them — whether alone, in combination with other words such as "SPERT Suite", or as a logo — and a **Marking of Modified Versions** clause under GPL v3 §7(c), requiring any fork to adopt a name that cannot be confused with those marks.

Together the two draw the line the license always meant to draw: the code is free to take, change and redistribute, the author attribution has to travel with it, and the brand stays behind. Both clauses fall inside the categories GPL v3 Section 7 permits, which matters — Section 7's closing paragraph lets a recipient strip any additional term that falls *outside* that list, as a "further restriction". The section header and its opening sentence now cite Section 7 rather than Section 7(b), because the terms draw on 7(b) for attribution, 7(c) for renaming modified versions and 7(e) for the trademark reservation.

This file is now a byte-for-byte copy of the canonical license in the SPERT® Suite landing-page repository, which is its single source of truth, differing only in the project repository URL on line 4. Of the nine suite repositories audited, **MyScrumBudget was the only one already an exact copy** — so this release adds the two clauses and changes nothing else. The GNU GPL v3 text itself is untouched, verified byte-for-byte against the previous release.

### Changed

- **`LICENSE`** — added clause `c)` Trademark Reservation and clause `d)` Marking of Modified Versions to the ADDITIONAL TERMS section, and broadened that section's citation from Section 7(b) to Section 7. Clause `a)` Attribution Preservation and clause `b)` UI Notice Preservation are unchanged. Lines 1–685, which are the GNU GPL v3 text, are byte-identical to v0.34.2.

## [0.34.2] - 2026-07-29

Bug fix. The project sharing list showed a raw internal account ID instead of a person's name or email address.

### Fixed

- **Member list rendered a raw Auth UID.** `getProjectMembers` resolved profiles against `myscrumbudget_profiles` only. That document is written by `AuthProvider` on *this* app's sign-in, whereas the cross-app invitation Cloud Function resolves an invitee **by** their `spertsuite_profiles` document and then writes only `members.{uid}` — it never seeds a per-app profile. Anyone who had used another SPERT® app but never opened MyScrumBudget therefore had no per-app profile, and `BulkSharingSection` fell through to `m.uid`.
- The lookup now falls back to `spertsuite_profiles/{uid}` when the per-app document is absent. Both carry the same `displayName`/`email` payload, and `firestore.rules` already permits `get` on the suite mirror for any authenticated user, so no rules change and no data backfill were required — affected members render correctly on next load.
- The fallback re-fetches **only** the uids that actually missed, and fetches them together, so the parallel `Promise.allSettled` fan-out keeps its O(1) wall-time rather than degrading to O(N).
- Guarded by four new cases in `src/lib/firebase/__tests__/sharing.test.ts`; three fail with the fix reverted. Suite-wide defect rather than a MyScrumBudget quirk — first found in SPERT Story Map v0.49.3.

## [0.34.1] - 2026-07-26

Internal repository maintenance only. No functional, data, or interface changes — the app behaves identically to v0.34.0.

### Removed

- **Local `firestore.rules` copy.** Firestore security rules are deployed from the Firebase Console and mirrored in the SPERT® Suite landing-page repository, which is their single source of truth. The copy kept here was never deployed from and could only drift out of date. It was never bundled into the app, so cloud behaviour is unchanged.
- **`firebase.json`.** Its only content was a pointer to the `firestore.rules` file removed above, so it no longer described anything deployable from this repository.

## [0.34.0] - 2026-07-16

Project archiving: hide a project from the Dashboard without deleting it. Adds an optional `Project.archived` flag, a "Show archived" toggle, and per-tile archive/unarchive actions. Also fixes a pre-existing bug where the JSON import sanitizer silently stripped a project's tile color.

### Added

- **Archive / Unarchive projects.** `Project` gains an optional `archived?: boolean` flag: undefined or false means active, true hides the project from the Dashboard grid by default. Archiving is not deletion — reforecasts, allocations, and all project data are untouched and remain fully editable if you open an archived project directly. On a shared project, archiving hides it for every member, not just yours — it acts on the project itself, the same way any other editor-level change does. Unlike deleting a shared project (owner-only, behind a confirmation dialog), archiving can be done by any editor and takes effect immediately.
- **"Show archived (N)" checkbox** on the Dashboard, visible only when the workspace has at least one archived project. Checking it reveals archived projects in the grid, dimmed with a small "Archived" badge.
- **Archive / Unarchive action on each project card.** Archive is a hover-revealed action alongside Export and Clone; Unarchive is always visible on an archived card, so there is a reliable way back even on touch devices.
- **Archived status is preserved through JSON export/import,** including in the Dashboard's import-preview list, which now labels an incoming archived project — and flags when an existing project it conflicts with is itself archived — so neither case looks like data silently vanished.

### Changed

- **Cloning a project never carries over its archived state** — the clone is always active.
- **The Dashboard's empty state now distinguishes "no projects at all"** (Getting Started checklist) from "every project is archived" (a plain message pointing at the toggle) — previously the checklist could incorrectly reappear for a user who archived their only project.

### Fixed

- **The JSON import sanitizer was silently stripping a project's tile color on import.** `color` was never added to the import field allowlist when it shipped in v0.33.0, so any project's tint was dropped on round-trip. Fixed alongside the archiving work since it touches the same allowlist.

### Storage

- **DATA_VERSION bumped to `0.16.0`.** New structural no-op migration entry mirrors the shape of the existing `color` migration (absent `archived` = active; no backfill).
- **Firestore:** `FirestoreProjectDoc.archived` is stored as `boolean | null` (Firestore rejects `undefined`); `docToProject` only hydrates the field when `true`. The projects-collection field allowlist in the shared SPERT Firestore rules was updated to include both `archived` and `color`, deployed ahead of this release. **Correction (2026-08-27):** this entry originally read "Cloud-mode project creation was never broken by the missing `color` entry: a new project writes `color: null`, and a null-valued field is not counted by the rules' `keys().hasOnly()` check (unlike a non-null value)." That is false. Measured since on the Firestore emulator, with positive, negative and `hasAll` controls: an explicitly `null` field **is** a present key, so `keys().hasOnly()` counts it and rejects the write. `createProject` and `saveProject` both always send `color` (coalesced to `null` when unset), so between v0.33.0 (2026-06-03), which shipped `color`, and the rules fix on 2026-07-16, cloud-mode project creation and saving were rejected. Cloud storage adoption is near zero and no report was received, so whether any user was affected is unknown. The archive toggle writes a non-null `archived: true`, so the allowlist entry is added to keep that path safe.
- **The strict import validator now type-checks the optional `archived` field.** The lenient localStorage guard is intentionally unchanged.

### Tests

- 1136 → 1159 across 74 files (+23): archiving coverage across migrations (v0.15.0→0.16.0 no-op + idempotency), validation, sanitizeImport, useProjects (archive/unarchive), ProjectCard (badge/buttons/dimming), dashboardCard (clone-drops-archived + getDashboardEmptyState), firestoreUtils (archived hydration), localStorage (reorderProjects data-loss guard), and importUtils (conflict labeling).

## [0.33.6] - 2026-06-28

Security update: closes a moderate PostCSS cross-site-scripting advisory that surfaced through a vulnerable transitive copy of PostCSS nested under Next.js. No application code, data-model, or runtime behavior changes.

### Security

- **Added a `postcss` `^8.5.10` override** to close GHSA-qx2v-qp2m-jg93 ("PostCSS has XSS via Unescaped `</style>` in its CSS Stringify Output", moderate / CVSS 6.1, affects `postcss <8.5.10`). `next@16.2.9` pins `postcss@8.4.31`; because Tailwind v4 had already pulled a newer `postcss@8.5.x` to the top level, the copy Next pins could not dedupe and survived as a vulnerable nested `node_modules/next/node_modules/postcss@8.4.31`. `npm audit` attributed it to `next` (via the `postcss` dependency path), which presents as a phantom `next 16.2.9 → 16.2.9` advisory — and is why v0.33.5's deferred (CI-only) audit did not surface it locally. The override collapses the tree to a single hoisted `postcss@8.5.16` and removes the nested copy.
- The flaw is in PostCSS's CSS stringifier and is not exercised at runtime by this app (PostCSS runs at build time only), but the line is cleared for a clean audit and suite parity. Taken as a **security-driven soak bypass**, consistent with the rest of the SPERT suite.
- **Verified this release with live `npm audit`** (zero occurrences of GHSA-qx2v-qp2m-jg93), closing the local-audit gap noted in v0.33.5. A green production build and all 1136 tests pass on Node 24.

### Changed

- No application source changes. The single hoisted `postcss` floats 8.5.15 → 8.5.16 (current 8.5.x patch) and Next's nested 8.4.31 is removed; all other dependencies unchanged (the `vite 7.3.2` override is retained). DATA_VERSION stays 0.15.0; 1136 tests across 74 files pass unchanged.

## [0.33.5] - 2026-06-28

Security update: adopts the Next.js 16.2.x line to close the advisory cluster that was deferred in v0.33.3. No application code, data-model, or runtime behavior changes.

### Security

- **next 16.1.7 → 16.2.9**, closing the ~14 Next.js advisories deferred in v0.33.3 (their fix ranges all fall at or below 16.2.6). The cluster includes eight High-severity advisories — Denial of Service via Server Components, Denial of Service via connection exhaustion in Cache Components, server-side request forgery via WebSocket upgrades, and four Middleware / Proxy bypasses (segment-prefetch routes, dynamic route parameter injection, and Pages Router i18n) — plus moderate cross-site scripting (CSP nonces, `beforeInteractive` scripts) and an Image Optimization DoS, and two low-severity cache-poisoning advisories. Several of the Middleware/Proxy and Image advisories are not reachable in this app (no `middleware.ts`, no rewrites/redirects, no i18n, no `next/image` usage), but the line is adopted in full for a clean audit and parity with the rest of the suite.
- **Soak bypass (security-driven), consistent with the rest of the SPERT suite.** next 16.2.9 (published 2026-06-09) has not cleared the 60-day adoption window; the bump is taken as a CVE bypass because the High cluster requires 16.2.6 or newer and the routine-soak path cannot reach a clean state until 16.2.6 clears (~2026-07-06). The other suite apps already adopted 16.2.9 the same way. Live `npm audit` was deferred to CI for this release (local network flakiness); advisory closure is proven by version range.
- Deferred items unchanged: vite 7.3.5 (Windows-only, dev/build-only; follow-up after 2026-07-31) and the accepted esbuild (GHSA-g7r4-m6w7-qqqr) and exceljs → uuid (GHSA-w5hq-g745-h8pq) transitive advisories.

### Changed

- **eslint-config-next 16.1.7 → 16.2.9** (co-bumped in lockstep with `next`). This floats the bundled `eslint-plugin-react-hooks` 7.0.x → 7.1.1; the code lints clean with no remediation needed (`--max-warnings=0`). `eslint` stays on `^9` (eslint-config-next 16.2.9 caps its bundled plugins at eslint 9).
- No other dependencies moved (float guard verified): react / react-dom 19.2.5, typescript 6.0.3, vitest 4.1.5, jsdom 29.1.0, @types/node 24.12.2, firebase 12.12.1, tailwindcss 4.2.4, @vitejs/plugin-react 5.2.0, eslint 9.39.4, and the vite 7.3.2 override all unchanged. DATA_VERSION stays 0.15.0; 1136 tests across 74 files pass unchanged.

## [0.33.4] - 2026-06-27

Tooling update: TypeScript major-version bump (dev/build-time only). No application code, data-model, or runtime change.

### Changed

- **TypeScript ^5 → 6.0.3** (5.9.3 → 6.0.3). Dev/build-time only; the production bundle is unchanged. TypeScript 6.0 tightened side-effect import checking, so a one-line ambient declaration (`src/types/css.d.ts`: `declare module '*.css';`) was added so the build's type-check gate accepts `import './globals.css'`. No deprecated-option migrations were needed (`target: ES2017` is unaffected); all 1136 tests pass.

## [0.33.3] - 2026-06-27

Security and tooling update: closes a soaked Next.js advisory (and, via the soak-eligible dependency refresh, a large batch of transitive advisories) and adopts Node 24 LTS. No application code, data-model, or runtime behavior changes.

### Security

- **next 16.1.6 → 16.1.7**, closing **HTTP request smuggling in rewrites** (GHSA-ggv3-7p47-pfv8, Moderate) plus four further advisories that 16.1.7 also resolves: unbounded `next/image` disk-cache growth, unbounded postponed-resume buffering DoS, and two null-origin CSRF bypasses (Server Actions and dev HMR websocket). ~14 other Next.js advisories (version ranges below 16.2.x) remain in `npm audit` and are deferred until a 16.2.x release clears the 60-day adoption window.
- **Transitive advisories cleared by the dependency refresh.** The firebase, next, and vitest updates pulled in fixed transitives that cleared a large batch of advisories — the entire protobuf.js code-execution / denial-of-service chain (previously the only Critical), seven undici advisories, and @grpc/grpc-js, tmp, js-yaml, picomatch, brace-expansion, flatted, and @babel/core. `npm audit` drops from 18 vulnerable packages to 9.
- **vite stays at 7.3.2 this release.** The two Windows-only, dev/build-only vite advisories (GHSA-v6wh-96g9-6wx3, GHSA-fx2h-pf6j-xcff; fixed in vite 7.3.5) remain deferred to a follow-up after 2026-07-31, when 7.3.5 clears the 60-day adoption window — avoiding a soak bypass for a fix that never reaches the production bundle.
- **esbuild (GHSA-g7r4-m6w7-qqqr, Low):** a dev-server-only, Windows-only path-traversal advisory that now matches the refreshed esbuild 0.27.7 (a transitive build/test dependency, never in the production bundle; this app never runs esbuild's dev server). Accepted; expected to clear when vite advances in the deferred follow-up.
- **exceljs → uuid (GHSA-w5hq-g745-h8pq):** known non-exploitable transitive advisory (the vulnerable uuid v3/v5/v6 + caller-buffer path is unreachable; exceljs uses uuid v4 only). Accepted; no fix attempted.

### Changed

- Dependency refresh (all soak-eligible): firebase 12.10.0 → 12.12.1; react / react-dom 19.2.4 → 19.2.5; tailwindcss & @tailwindcss/postcss 4.1.18 → 4.2.4; vitest 4.1.4 → 4.1.5; jsdom 28.1.0 → 29.1.0; @types/node 22.x → 24.x (24.12.2); @vitejs/plugin-react 5.1.4 → 5.2.0; eslint 9.39.2 → 9.39.4.
- **Node 24 LTS adopted:** `engines.node` 22.x → 24.x; `.nvmrc` 22 → 24.
- Realigned `eslint-disable` directives after `eslint-config-next` 16.1.7 bundled a newer react-hooks plugin that changed which `set-state-in-effect` patterns it flags (comment-only; no runtime or behavioral change).

## [0.33.2] - 2026-06-19

Targeted dependency security update closing vite and vitest advisories flagged by the suite-wide audit. Build and test tooling only — no application code, data-model, or runtime behavior changes.

### Security

- **vitest 4.0.18 → 4.1.4**, closing a Critical advisory in the Vitest UI server (arbitrary file read and execute, GHSA-5xrq-8626-4rwp).
- **vite pinned to 7.3.2** (a transitive dev/build dependency, never shipped to users — pinned via a package.json `overrides` entry, not added as a direct dependency), closing three advisories: arbitrary file read via the dev-server WebSocket (GHSA-p9ff-h696-f583, High), `server.fs.deny` bypass via crafted queries (GHSA-v2wj-q39q-566r, High), and path traversal in optimized-dependency source maps (GHSA-4w7w-66w2-5vf9, Moderate).
- Two Windows-only vite advisories (GHSA-fx2h-pf6j-xcff, GHSA-v6wh-96g9-6wx3) remain **deferred** — their fix ships in vite 7.3.5, which has not yet cleared the 60-day version-adoption window; follow-up is scheduled for around 2026-07-31.

### Fixed

- **Stabilized three date-sensitive migration tests.** Tests for the v0.3.0→v0.4.0 and v0.4.0→v0.5.0 reforecast-date migrations asserted a value that only held while the system clock was before the fixtures' 2026-06-15 project start; once the calendar passed that date the v0.14.0 reforecastDate clamp legitimately rewrote the value and the assertions began failing. They now pin a fixed clock so they pass regardless of when the suite runs. This was a pre-existing latent issue, independent of the dependency bump (reproduced on the prior vite/vitest versions before changing them).

## [0.33.1] - 2026-06-03

Follow-up polish to the v0.33.0 Dashboard tile action icons.

### Fixed

- **Dashboard tile action-icon layout.** The always-visible color swatch and trash icons were separated by a permanent empty gap because the hover-revealed export/clone icons used `opacity-0`, which still reserves layout space, and were ordered *between* the two always-on icons. Reordered to `export · clone · swatch · trash` and switched the hover pair to collapse fully (`display:none` until hover/focus) so they reserve no idle space. The cluster is right-anchored, so the swatch and trash now sit adjacent at the right edge and the export/clone pair slides in to their left on hover without displacing them. Keyboard access preserved via `group-focus-within`.

## [0.33.0] - 2026-06-03

Dashboard tile upgrades plus a stale-data fix. Project tiles gain a color tint, a most-recent-reforecast date stamp, and per-tile export/clone actions. Two staleness bugs around editing reforecast dates are fixed.

### Fixed

- **Dashboard tiles showed stale start/finish months.** The card read the frozen project-level `startDate`/`endDate` (creation-time metadata since v0.29.0) instead of the live reforecast window, so any reforecast date edit left the tile's month range stale — even after a hard refresh. The card now sources the range (both start and finish) from the most-recent reforecast, consistent with the Budget/EAC it already shows.
- **Project detail "Start / Finish" tile was stale after saving an edited date.** The edit form's `await flush()` was effectively a no-op: `useProject.updateProject` called the debounced `persistProject` from *inside* a React state updater, which is deferred — so at the moment `flush()` ran there was nothing queued, and the real write landed ~500ms later via the debounce, after `router.back()` and after the detail page had already re-read. `updateProject` now persists synchronously, so `flush()` reliably writes the latest state before navigation. (Confirmed by browser repro: storage saved correctly, the view showed stale data, a manual refresh fixed it.) The ref-based rewrite also retires the v0.28.1 "impure updater" investigation flag in `useProject`.

### Added

- **Per-tile color tint.** Each Dashboard project tile gets a swatch picker to tint the card with one of a curated palette (Blue, Teal, Slate, Purple, Pink) — deliberately avoiding the red/amber/green/violet health-status hues so a tint can never be misread as a status. Stored as an optional `color` key on the project; data version `0.14.0` → `0.15.0` (additive no-op migration).
- **Most-recent reforecast stamp.** Tiles show an "as of {date}" line under the metrics, sourced from the latest reforecast date across all of a project's reforecasts. It turns amber once that date is more than 30 days old, as a freshness nudge.
- **Per-tile JSON export.** A trash-styled export icon (hover-revealed) downloads just that project — a standard dataset-shaped export filtered to the one project, carrying settings, the full team pool, and the workspace reconciliation tokens so it stays importable by the existing Dashboard import flow.
- **Per-tile clone.** A clone icon (hover-revealed) duplicates a project with a unique `"<name> - Copy (N)"` name (stripping any existing copy suffix so clones don't nest). Internal ids are preserved (project-scoped, no collision; keeps allocation↔assignment linkage), the clone is owned by the cloning user in cloud mode, and the operation is logged to the change log.

## [0.32.1] - 2026-05-30

Documentation release. Adds the Charter Budget Reference Guide and refreshes the Quick Reference Guide.

### Added

- **Charter Budget Reference Guide (PDF)** linked from the About page. A companion to the Quick Reference Guide that documents the full statistical model behind the Charter Budget feature: the coefficient-of-variation (CV) calibration by project type, the additive favorable/unfavorable risk-factor adjustments, the three probability distributions (Normal / Lognormal / Beta-PERT), the optional optimism-bias uplift, the P80-schedule integration guidance, and the supporting research basis.

### Changed

- **Quick Reference Guide (PDF) refreshed.** Now covers the Charter Budget panel, pool-member archiving, the conflict-aware per-project import flow, and other features added since the previous edition.

## [0.32.0] - 2026-05-30

Charter Budget. A new explainable parametric contingency tool that turns the deterministic ETC point estimate into an uncertainty-adjusted charter budget at a chosen confidence percentile and distribution — bringing in-house what was previously done externally in Excel. Every contingency dollar traces to a five-question risk profile. Explicitly a planning heuristic, not a guarantee.

### Added

- **Charter Budget panel** (project detail page, below the allocation grid). The PM completes a five-question risk profile — project type, requirements clarity, team experience, org-change impact, integration complexity — and the model derives a coefficient of variation (CV), then computes a charter budget at a chosen percentile (P60–P95) and distribution (Normal / Lognormal / Beta-PERT), with the live ETC pre-populating as the cost basis. A live CV breakdown table (green favorable / amber unfavorable), results cards (applied CV, σ, P50 median, charter budget), a distribution-specific mini chart, and a two-line "Apply as baseline budget" results breakdown all update reactively. Powered by a greenfield math engine (`src/lib/calc/charterBudget.ts`, `normal.ts`): Acklam inverse-normal, truncated-Normal / mean-anchored-lognormal / symmetric Beta-PERT(3,3) quantiles, with golden-file unit tests pinning every multiplier.
- **Coefficient-of-variation model.** Base CV by project type (COTS 15% → AI/ML 40%) plus additive favorable/unfavorable factor deltas (deliberate ρ=1 conservative assumption), clamped to [8%, 50%]. The 50% ceiling is surfaced as a governance signal that scope may be too unstable to charter.
- **Optimism-bias uplift (opt-in).** A direct-percentage adjustment that raises the cost basis *before* contingency, shown as a distinct labeled line so the sponsor sees expected-overrun correction and risk contingency separately. Defaults to 0 (pure spread-only model).
- **Manual CV override.** A typed 8–50% override that bypasses the governance ceiling (a deliberate user assertion is not a "scope unstable" signal); the floor still binds.
- **Schedule-source nudge.** A checkbox flagging that the ETC came from a P80+ schedule forecast (e.g., SPERT® Forecaster); when set, the panel recommends targeting P60 to avoid stacking P80 cost on a P80 schedule, and warns if uplift is also active (opposite assumptions).
- **Charter badge on the Baseline Budget tile** — a compact inline `P{n} · {Distribution}` indicator (with `+N% bias` and `stale` variants) and a Set/Edit affordance.
- **Staleness detection.** The charter stores the ETC it was calculated against; when live ETC later drifts (as actuals accrue), the badge and panel surface a "stale" indicator (cents-rounded compare, computed once at the page layer so the two never disagree). The charter is a point-in-time artifact — drift is surfaced, not auto-recomputed.

### Data model

- **`charterBudget?` sub-object on each `Reforecast`** (co-located with `baselineBudget`, not on `Project`). This placement makes undo co-write, Firestore document-level atomicity, and cloud round-trip automatic. No schema migration required — absent reads as "not set." Cleared by destructure-rest omission (never `undefined`, which would throw on Firestore). Dropped automatically on reforecast clone (a copy starts uncharted; locking test added).
- **Import round-trip.** `charterBudget` added to the import sanitize allowlist with a two-stage deep pick (the nested `riskProfile` is picked separately since `pickKeys` is shallow), plus a strict full-shape `validateCharterBudget` (enum membership, percentile ∈ allowed set, uplift and CV-override range checks, finite derived numerics). Verified to survive export→import on both localStorage and Firestore backends.

### Fixed

- **Charter "Apply as baseline budget" now rounds to the nearest whole dollar.** Previously the raw quantile (e.g. `108095.3970112618`) was written verbatim into the baseline budget. The charter amount is rounded at the single panel assembly point; the un-rounded ETC-at-calculation is preserved for the cents-wise staleness compare, and the engine's raw multiples are unchanged (golden tests intact).

### Tooling

- **Vitest no longer globs `.claude/worktrees/*`.** Stale per-session git worktrees were being discovered and run N× in parallel, and the CPU contention flaked timing-sensitive debounce/`waitFor` hook tests. The `test.exclude` config now skips them.

### Tests

1095/1095 passing across 71 test files. New coverage: charter-budget math engine (golden multipliers, Acklam precision to 8 digits, distribution invariants, CV clamp/governance flags, override-bypasses-ceiling); `applyCharterBudget` / `updateBaselineBudget` no-op-guard + charter-clear + apply-then-blur; import sanitize + strict validation accept/reject matrix; clone locking test. Independently re-verified by a five-dimension adversarial pass (math, governance, import round-trip, write paths, staleness) with zero blockers.

## [0.31.0] - 2026-05-26

Cloud storage remediation. Eight targeted fixes across sign-out cascade, controlled-input echo guards, debounced-save lifecycle, listener error handling, Firestore write contracts, and the import Apply flow.

### Fixed

- **E2a — Local-mode sign-out no longer wipes local data.** Signing out in local storage mode used to clear `msb:projects`, `msb:settings`, `msb:teamPool`, `msb:changeLog`, and `msb:originRef` — destroying the user's only copy. These keys are now cleared only when signing out of cloud mode. Users who briefly sign into Firebase and sign out without switching to cloud retain all their work.
- **A3 — Echo guards on controlled inputs.** Reforecast notes textarea, dashboard threshold inputs, and reforecast date inputs now use local buffers that reject incoming cloud-sync updates while the user is actively typing. Per-keystroke commits to the store are preserved so undo/redo is unaffected. ReforecastToolbar additionally clamps date values through a single source (the same function that writes the store) so the displayed input never diverges from the stored value; an empty-input clear is safely ignored without leaving a blank display over a populated store.
- **D2 — Tab-close flush.** Pending debounced saves are flushed on `pagehide` and `beforeunload`. Edits made within 500 ms of closing the tab are no longer silently discarded. In cloud mode with no authenticated user, pending writes are cancelled instead of flushed to avoid a guaranteed `PERMISSION_DENIED`.
- **I3 — Per-id cancel before deleteProject.** Pending debounced saves for a project are cancelled before `repo.deleteProject` runs, closing the race where a pending timer fires after `deleteDoc` and re-creates the document via `setDoc(merge: true)`. Residual window: ~200 ms after a debounce fire (in-flight network is not aborted; accepted).

### Improved

- **I2 — Listener permission-denied evicts inaccessible data.** Cloud `onSnapshot` listeners now emit a bus event on permission-denied so the consuming hook re-fetches and either silently evicts (`useProjects` sets `projects = []`) or no-ops. Silent across the chain — the user typically caused this (sign-out cascade, role change) and the prior behavior left stale data visible until manual reload.
- **C1 — Explicit `mergeFields` on every Firestore write.** `saveProject`, `saveSettings`, and `saveTeamPool` replace `merge: true` with explicit `mergeFields` lists, making the write contract auditable. Ownership / identity fields (`owner`, `members`, `order`, `createdAt`, `_originRef`, `_changeLog`, `schemaVersion`) are explicitly excluded from `saveProject` so the v0.30.0 import "replace" path continues to preserve them.
- **K2 — Settings `schemaVersion: 2`.** Settings documents now carry a `schemaVersion: 2` field, with a comment marking the migration integration point in `getSettings`. Legacy docs without `schemaVersion` should be treated as version 1.
- **J1 — Import Apply gated on cloud-data load.** The import Apply button is disabled in cloud mode while `useProjects.loading` is true, preventing the hydration-race duplicate-project case where Layer 1 and Layer 2 both read an empty workspace. Title tooltip directs the user to close the dialog and re-open the file once the dashboard shows existing projects. Local mode and post-hydration cloud are unaffected.

### Behavioral notes

- **Mid-edit undo (Ctrl+Z while typing notes):** the store reverts correctly but the textarea continues to display the typed text while the user remains focused. On next blur, the textarea snaps to the undone value. Undo / redo after blur is fully correct.
- **`msb:originRef` and `msb:changeLog`** are now preserved on local-mode sign-out. These per-browser fingerprint keys belong to the browser, not the Firebase account, and should persist across sign-in / sign-out cycles.
- **Threshold inputs (Settings → Dashboard Thresholds):** if the user focuses a threshold field, types, collapses the section without blurring, then focuses a different threshold field and navigates away, the first field's typed value is lost — only the second field commits. To save, blur (Tab or click out) before collapsing.

### Tests

1055 passing across 68 test files (~44 net new). New coverage: sign-out mode-gating + cloud / local sessionStorage matrix; ReforecastNotes echo-guard + handler ordering + blur snap; ThresholdSettings local buffer + unmount-commit (new file); ReforecastToolbar date echo-guard; pendingSaveRegistry `flushAll` + `registerKeyed` / `cancelByKey` (full replacement); `tabCloseFlush` handlers (new file); useDebouncedSave registry integration; useProjects deleteProject ordering + reload error matrix (permission-denied vs network); useSettings + useTeamPool reload error matrix; ImportPreviewSection `cloudDataReady` Apply gating.

## [0.30.0] - 2026-05-19

Level 4 import capability. The legacy "Import JSON" flow in Settings (a blunt all-or-nothing replace) is retired. A new Dashboard import surfaces a per-project preview with conflict detection, per-row decisions (add / skip / replace), and independent decisions for Settings and Team Pool. The import never silently overwrites: every conflict starts as `skip`, and `replace` is always an explicit user choice.

### Added

- **Per-project import preview.** New Dashboard "Import JSON" button parses, validates, sanitizes, and previews the file before any write. Each incoming project gets an Add / Skip / Replace control. ID conflicts and name conflicts (case-insensitive, NFC-normalized) are labeled with the colliding project's name. Settings get a Keep / Replace pair; Team Pool gets Keep / Merge / Replace (defaulting to Merge so pre-existing members are never overwritten unless the user opts in).
- **`msbExportKind: 'dataset'` discriminant on every export.** Future-proofs the format guard: any non-`'dataset'` value is rejected at the boundary (pitfall #61). Legacy exports without the field continue to import.
- **Duplicate-ID protection.** If the import file contains the same project ID twice, only the first occurrence is kept; the preview shows a "N of M from file" header and a notice naming the count dropped.
- **Cloud hydration hint.** When cloud mode is active but `existingProjects` is empty, the preview surfaces a warning to wait for the dashboard to load existing projects before applying — narrowing the post-sign-in race window where Layer 1 and Layer 2 reads both see an empty workspace.
- **Two-layer stale-data guard on apply.** Layer 1 reads existing projects at parse time; Layer 2 re-reads at apply time. If a target project was deleted or renamed between layers, `replace` falls back to `add` instead of clobbering an unrelated project that now holds the same name.

### Changed

- **`DataPortability` is now export-only.** Settings keeps Export JSON; the import flow moved to the Dashboard. The orphan `onImportComplete` prop and its `window.location.reload()` consumer in the Settings page are removed — the new flow notifies the Dashboard via `cloudSyncBus.emit('projects' | 'settings' | 'teamPool')` and lets the existing subscriptions re-fetch.
- **Write order during apply is teamPool → settings → projects.** `firestoreRepo.createProject` and `saveProject` snapshot the team pool into the Firestore project document at write time. Writing team-pool changes first guarantees every imported project's `_teamSnapshot` reflects the final pool state, not a stale pre-import pool.
- **`saveProject` JSDoc** clarifies which fields are written every save vs. preserved by `merge: true`, with an explicit note that the v0.30.0 import path relies on this preservation.

### Security / hardening

- **Input boundary unchanged.** New import uses the same `parseImportJson` (prototype-pollution-safe), `validateAppState`, and `sanitizeAppState` chain that landed in v0.28.2. The discriminant check runs on the raw parsed object before sanitize/migrate.
- **Cloud 'add' regenerates `Project.id`.** Prevents Firestore document-ID collision with another workspace's unreadable document. Internal IDs (Reforecast, Assignment, Allocation.memberId) are intentionally preserved — they are document-scoped, not cross-document references.

### Deferred (documented limitations)

- **Cloud-flip migration paths (`firestoreRepo.importAll`)** still rewrite `createdAt`, `order`, and `_originRef` on each project. The new Level 4 import does not touch this code path, but a local→cloud flip on an existing workspace will reset those fields on every project. Tech-debt backlog.
- **Cloud hydration race on post-sign-in import.** Importing immediately after enabling cloud sync (before Firestore listeners hydrate) may cause both stale-data layers to read empty, producing duplicate "add" rows. Wait for the dashboard to show existing projects before importing.

### Tests

- 1011/1011 passing. Added `importUtils.test.ts` (30), `useImportState.test.ts` (15), `ImportPreviewSection.test.tsx` (16) — 61 net new tests covering normalization, conflict detection, dedup, the C2 write-order guard, the C3 name-conflict-target-changed guard, the C4 named-success-flag changelog gate, the Layer 2 delete-between-layers guard, the all-skip banner, the cloud hydration hint, role transitions, and component rendering.

## [0.29.2] - 2026-05-15

Bugfix release. Pre-existing UX bug surfaced again by v0.29.1's Edit-page flow: after confirming a reforecast-window change, the project detail page loaded with stale month columns until the user manually refreshed the browser. The fix awaits the debounced save before navigating, so the destination page reads the committed state.

### Fixed

- **Edit Project → confirm date change → stale allocation grid columns.** `useDebouncedSave.flush()` previously fired the save as a fire-and-forget Promise; the Edit page's `await onSubmit(...)` would resolve before the repo write completed, and `router.back()` would then mount the detail page against stale data. `flush()` now returns the underlying save Promise, and the Edit page's `applyAll()` awaits it before resolving the dialog Promise. The detail page's mount-time `repo.getProject(id)` reload now reliably sees the committed state.

### Tests

- 950/950 passing. Updated three test files (`useDebouncedSave.test.ts`, `useTeamPool.test.ts`, `useSettings.test.ts`) to discard the Promise via `void` so `act()` stays in synchronous mode for assertions that don't need to await the save.

## [0.29.1] - 2026-05-15

UX refinement on v0.29.0's per-reforecast windows. The two competing date surfaces introduced in v0.29.0 (project header tile vs. new toolbar inputs) collapse into one: the header tile and the Edit Project page now both edit the **active reforecast's** window. The toolbar's Start/End date inputs are removed.

### Changed

- **Header tile** (`ProjectSummary` Start / Finish dates) now displays the active reforecast's `startDate` / `endDate`. Switching reforecasts updates the displayed dates immediately.
- **Edit Project page** dates apply to the active reforecast (not the project). The same v0.29.0 confirmation dialog with `{from, to}` adjustments appears on submit if the change would trim allocations, remove historical-cost entries, clamp the Reforecast Date, or clamp the Actuals Through date. Helper text on the form makes the target reforecast explicit.
- **PrintableReport** date header (and "Project Summary" Start/End rows) now read from the active reforecast.
- **Productivity-window date input bounds** now use the active reforecast's window. The fully-out-of-range warning indicator (D9 from v0.29.0) is unchanged.

### Removed

- **Toolbar Start/End date inputs** (added in v0.29.0) and their confirmation dialog. The toolbar shrinks back to its v0.28.x size: Reforecast select · Pencil · Date · Actuals Through · + New · Delete.
- **Toolbar's "Reforecast Window" line** in PrintableReport. Since the header now always shows the active reforecast's window, the conditional duplicate is no longer needed.
- **`Project.startDate` / `Project.endDate` no longer drive any runtime UI.** They remain in the data type and Firestore documents for backward compatibility and are still set at project creation, but are no longer read by display code, the calc engine, or any chart. Effectively creation-time metadata.

### Data model

- **`createNewReforecast` signature change** — the `projectStartDate` / `projectEndDate` parameters are replaced by a single `defaults: { startDate; endDate }` object. The caller (`useReforecast.createReforecast`) resolves defaults to either the source reforecast's window (when copying) or the **baseline reforecast's window** (when creating blank). A blank new reforecast after project creation is rare in practice; this matches the user's mental model that "new scenarios inherit from the original plan."
- **No migration needed** — v0.14.0 schema is unchanged.

### Tests

- 950/950 passing. Removed the toolbar Start/End commit-handler props from `ReforecastToolbar.test.tsx`. `createNewReforecast` test calls updated to the new defaults-object signature.

## [0.29.0] - 2026-05-14

Per-reforecast independent timelines. Each what-if scenario now carries its own start and end dates, fully decoupled from the project and from sibling reforecasts. The allocation grid, calc engine, and charts are all driven by the active reforecast's window — editing the project no longer cascades.

### ⚠️ Breaking semantic change — `Reforecast.startDate`

Previously stored as YYYY-MM and never consumed at runtime. Now stored as YYYY-MM-DD and actively drives the allocation grid, calc engine, and chart rendering. Data files saved in v0.29.0 cannot be opened by v0.28.x or earlier — do not export from v0.29.0 if the destination is running an earlier version.

### Added

- **Per-reforecast Start and End date inputs in the reforecast toolbar.** Each what-if scenario carries its own window, independent of the project and of sibling reforecasts. The allocation grid columns, the calc engine's month range, and chart rendering all read from the active reforecast.
- **Confirmation dialog with exact "from → to" values.** When a date change would trim allocations, remove historical cost entries, clamp the Reforecast Date, or clamp the Actuals Through date, the dialog surfaces precise counts and date adjustments before applying. Productivity windows that fall outside the new range are listed in the dialog and visually flagged after commit — never auto-deleted.
- **`Reforecast.endDate` field (required, YYYY-MM-DD).** Migration backfills from `project.endDate` (or the latest allocation month / `rf.startDate` if project end is unset). New reforecasts inherit either the project's window (blank) or the source reforecast's window (copy).
- **"Reforecast Window" line in PrintableReport,** rendered only when the active reforecast's window differs from the project's window.

### Changed

- **Editing the project no longer cascades to existing reforecasts.** Changing project start/end dates only updates project-level fields and seeds future new reforecasts. The baseline and every other existing reforecast permanently carry their own windows from the moment of creation. Helper text on the ProjectForm date inputs makes this explicit.
- **Mid-month reforecast start dates produce partial first-month working hours.** A 1.0 FTE allocation for March on a reforecast starting March 15 produces roughly half a full-March cost (same behavior the app already applied for project start dates).
- **`reforecastDate` ("when this forecast was prepared") is independently editable.** Maximum value is today's date; a `reforecastDate` past the reforecast's end date is permitted (you can document a forecast in December for a project that ended in June). Future-dated values in existing data are preserved on read; any user edit via the toolbar snaps to today's maximum.
- **`actualsThroughDate` constrained to `[rf.startDate, rf.endDate]` when set.** Cleared via the `×` button as before. Clamped in either direction during migration if it fell outside the new window.
- **Copying reforecasts inherits source `startDate`/`endDate`, `actualCost`, `historicalCosts`, and `actualsThroughDate`.** Carrying the actual cost record forward gives the correct EAC and variance baseline for the new scenario.

### Removed

- `computeTimelineChangeSummary` and `applyTimelineChangeToReforecasts` (the multi-reforecast cascade helpers) — replaced by `computeSingleReforecastTimelineChangeSummary` and `applyTimelineChangeToSingleReforecast`. The `PendingSave` dialog on the project edit page is gone.

### Migration (automatic on first load)

- Converts `Reforecast.startDate` from YYYY-MM to YYYY-MM-DD using the day component from `project.startDate` (defaults to `-01` if absent or invalid).
- Backfills `Reforecast.endDate` from `project.endDate` (fallback chain: latest allocation month → `rf.startDate`).
- Clamps any out-of-range `reforecastDate` / `actualsThroughDate` to the new window. Migration-time clamps are silent — if you had a value near the edge of your reforecast window before upgrading, check the toolbar after the first load to confirm it landed where expected.
- If pre-migration data is entirely corrupt and all date fields are invalid, the reforecast window defaults to `1970-01-01` as a fail-safe — you will see `1970-01-01` in the toolbar's Start and End date fields and the chart will begin at January 1970. Open the toolbar and enter the correct dates.
- Internal `AppState.version` advances to `'0.14.0'`. The user-facing app version `0.29.0` and the internal schema version are intentionally independent.

### Notes

- Productivity windows that fall fully outside the active reforecast's range receive a warning indicator (`!`) in the productivity-window table with a tooltip. They are not auto-deleted; the input bounds remain at project-level so users can edit windows back into the rf window without delete-and-recreate.
- Known edge case: if the page remains open across midnight, date constraints and confirmation dialog "from → to" values reflect the day captured at render. The committed value always matches what the dialog showed (the dialog freezes `today` at open time). A page refresh resolves any visual stale-date display.

## [0.28.2] - 2026-05-09

Security audit release. Twelve findings closed across the canonical Firestore rules and the app code, matching the suite-wide pattern already applied to GanttApp v0.22.2, Story Map v0.29.2, Scheduler v0.42.6, and CFD v0.12.2. Companion rules change ships in `spert-landing` PR #46 (canonical `firestore.rules`).

### Security — High

- **H1: `myscrumbudget_profiles` bulk-enumeration block (rules + code).** Replaced `allow read: if isAuth()` with auth-only `get` plus `list: if isAuth() && request.query.limit <= 1` on `myscrumbudget_profiles`. MSB was the LAST app in the suite still on the legacy unbounded read; the rule change closes the bulk email/displayName/photoURL harvest vector. Companion app-side change deletes `SharingSection.tsx` and the legacy `findUidByEmail` / `addProjectMember` / `removeProjectMember` in `sharing.ts` (the only callers of the unbounded `getDocs(collection(myscrumbudget_profiles))` query), plus the `<SharingSection>` ternary branch in `src/app/projects/[id]/page.tsx`. The active member-add path runs through `callSendInvitationEmail` (Cloud Function, server-side authority); `getProjectMembers` survives unchanged for the BulkSharingSection member list.
- **H2: XLSX export formula-injection sanitization.** Added an `xlsxSanitize` helper in `src/features/reforecast/lib/excelExport.ts` that prepends `'` to any string whose first character is `=`, `+`, `-`, `@`, `\t`, or `\r` — Excel/LibreOffice/Sheets evaluate such cells as formulas on file open. With v0.28.0 bulk invitations live, a collaborator could rename themselves to `=HYPERLINK(...)` or `=cmd|'/c calc'!A1` and any other collaborator who downloads the Resource Plan would auto-evaluate the payload. Sanitization applied to member name, role, the title cell, and the row-2 metadata line. Allocation cells are numeric and unchanged.
- **H3: JSON import field-strip pass.** Added `src/lib/utils/sanitizeImport.ts` exporting `sanitizeAppState`, which reconstructs the entire imported tree using per-entity allowlists drawn directly from the domain types. Applied in `DataPortability.handleImport` AFTER `validateAppState`, so the data flowing into `repo.importAll` (and on cloud-flip into Firestore) is guaranteed to contain only known keys. Closes the smuggle vector where a malicious export file could inject `members: { '<victim_uid>': 'owner' }`, `_admin: true`, or other unknown fields onto a project, reforecast, allocation, or settings entity. Defense-in-depth on top of the v0.28.2 (M5) Firestore field allowlist; this layer also covers fields nested inside arrays where no rule guard exists.

### Security — Medium

- **M1: prototype-pollution defense at the JSON parse boundary.** Added `src/lib/utils/safeJsonParse.ts` exporting `parseImportJson`, which uses a `JSON.parse` reviver to drop `__proto__`, `constructor`, and `prototype` keys at every depth. `DataPortability.handleImport` now calls `parseImportJson` instead of `JSON.parse`. Closes the prototype-pollution sink where `{"__proto__": {"isAdmin": true}}` JSON, when later spread into a literal (as multiple migrations in `migrations.ts` do), would invoke the `__proto__` setter and pollute `Object.prototype` for the runtime.
- **M2: BulkSharingSection runtime role guard.** `handleSend` now collapses the role state variable to `'editor'` for any value other than `'viewer'` before forwarding to `callSendInvitationEmail`. The `setRole(e.target.value as 'editor' | 'viewer')` cast is erased at runtime; a bundle-modified or DevTools-tampered client could send `role: 'owner'` and rely entirely on the Cloud Function's own role validation. Defense-in-depth.
- **M3: callable wrapper runtime input validation.** `callSendInvitationEmail`, `callRevokeInvite`, and `callResendInvite` in `src/lib/firebase/invitations.ts` now reject malformed inputs at the wrapper layer before invoking `httpsCallable`: non-empty bounded strings for `modelId` (≤200) and `tokenId` (≤200), `role ∈ {editor, viewer}`, `emails` must be a non-empty array of ≤50 entries. Same defense-in-depth rationale as M2.
- **M4: rules — `myscrumbudget_projects` create rule binds top-level `owner`.** Added `request.resource.data.owner == request.auth.uid` to the create predicate. Closes the split-state vector where `members[self] == 'owner'` but the top-level `owner` points to another UID, which would break `removeCollaborator` Guard 2 in `src/lib/firebase/invitations.ts:79`. Matches the M5 fix already shipped in Story Map v0.29.2 / GanttApp v0.22.2 / Scheduler v0.42.6 / CFD v0.12.2 / Forecaster / AHP.
- **M5: rules — `myscrumbudget_projects` field allowlist.** Added a `myScrumBudgetProjectFields()` helper enumerating the 14 legitimate keys (mirrored from `firestoreRepo.ts` `createProject` / `saveProject` / `importAll`) plus `keys().hasOnly()` on create and `affectedKeys().hasOnly()` on update. Rejects any unknown field at the rule layer; allowlist must stay in sync with the converter.
- **M6: `useCloudSync` listener error logs narrowed to error code only.** Both `onSnapshot` error callbacks for the projects query and the per-user settings doc previously logged the full `FirestoreError` object, whose serialization frequently includes the document path (e.g., `permission-denied at /myscrumbudget_projects/abc123`). A malicious browser extension scraping console output could harvest project IDs. Now logs only `(err as { code?: string })?.code ?? 'unknown'`.
- **M7: XLSX export title/metadata cells sanitized.** Applied `xlsxSanitize` to the title cell and row-2 metadata line even though both currently sit inside a static prefix that shields formula evaluation today. Hardens against a future refactor that drops or reorders the prefix.

### Security — Low

- **L1: legacy SharingSection + sharing.ts paths deleted.** See H1 above for the deletion details.
- **L2: SESSION_KEY cleanup on cloud-flip rejection.** `useInvitationLanding`'s Effect 2 IIFE catch block now drops `msb:invite-session` from sessionStorage immediately rather than relying on the 30s timer fallback.
- **L3: SESSION_KEY cleanup on sign-out mid-claim.** New Effect 2b in `useInvitationLanding`: when `user` becomes null while `state === 'claiming'`, clear the stale token and reset state to `'idle'`. Without this, a sign-out + sign-in within the 30s timer window could re-enter the flow with the previous user's token.
- **L4: `[sharing]` log hygiene.** `getProjectMembers` no longer interpolates the failing UID into its `console.warn` message and now logs only the error code.
- **L5: `[profileWrites]` log hygiene.** `writeSpertsuiteProfile` and `writeMyscrumbudgetProfile` now log only the error code on failure, not the full FirebaseError.
- **L6: sessionStorage cleared on sign-out.** Added a `SESSION_CLEAR_ON_SIGN_OUT` array beside `CLEAR_ON_SIGN_OUT` in `signOutCleanup.ts` and a matching loop in `performSignOutCleanup`. Closes the leak where `msb:invite-session` (a per-tab invite token) survived a same-tab sign-out and would surface to the next signed-in user.
- **L7: bare `signOut()` export removed from `src/lib/firebase/auth.ts`.** The wrapper had no callers and was a footgun — autocomplete-driven imports could bypass `performSignOutCleanup` and revoke credentials without clearing localStorage / sessionStorage / storage mode / repo. All sign-outs now route through `performSignOutCleanup` (or `useAuth().signOut`, which calls it).
- **L8: passive token expiry routes through `performSignOutCleanup`.** `AuthProvider.subscribeToAuth` now tracks a `previousUserRef` and, on transition from non-null → null without an explicit `signOut()`, fires `performSignOutCleanup`. An idempotency flag inside `performSignOutCleanup` makes the explicit-then-passive double-call safe (the second invocation short-circuits). Closes the gap where a passive expiry would leave a debounced save firing against a revoked credential plus localStorage/storage-mode pointing at the previous user's session.
- **L9: defensive comments in `useDebouncedSave`.** Both `save()` and `flush()` `console.error` sites now carry a comment explaining that `value` (the closed-over T) MUST NOT be added to the log because it can contain member emails / UIDs. Future-maintainer trap mitigation.
- **L10: resend-cap UX-only-disable comment in `BulkSharingSection`.** Documents that the `disabled={atCap}` button is UX only — the 5×/invitation cap is enforced authoritatively by the `resendInvite` Cloud Function plus `allow write: if false` on `spertsuite_invitations`.
- **L11: Excel import length caps.** `excelImport.ts` row-parse loop now rejects rows where the name exceeds 200 chars or the role exceeds 100 chars with a new `E10` error code. Replaces a cryptic post-save Firestore-1MB-doc-limit error with a clean parse-time rejection.

### Tests

- 939 passing across 62 test files (was 911 / 59). New test files: `safeJsonParse.test.ts` (6 tests), `sanitizeImport.test.ts` (7 tests), `excelExport.sanitize.test.ts` (7 tests). Extended `invitations.test.ts` with 8 new tests covering the M3 runtime input validation paths (empty modelId, oversized modelId, role: owner, role: arbitrary string, empty emails array, oversized emails array, empty tokenId, oversized tokenId).

### Out of scope / deferred

- L12 (`useProject` undo/redo nested-setState pattern): no security impact. Existing investigation-flag comment from v0.28.1 remains. Revisit before any React major upgrade or strict-mode tightening.
- All dependency upgrades: every non-current dep was inside the 60-day hold window per the v0.28.1 audit. Unchanged in v0.28.2.

---

## [0.28.1] - 2026-05-09

### Refactored
- **Extracted Excel-import diff logic from `ResourcePlanExcelPanel.tsx` into `src/features/reforecast/lib/importDiff.ts`.** The two pure helpers `computeImportDiff` and `countAllocationDiffs` (and the `ImportDiff` interface) are pure data transforms with typed inputs/outputs and no React or UI state — they were doing the heaviest lifting in the file (member matching by lowercased name, fallback-to-Unknown logic, symmetric-diff allocation counting) but couldn't be unit-tested through the component surface. Moving them to a sibling library file shrinks the panel from 486 → 328 LOC and unlocks direct testing. `ResourcePlanExcelPanel.tsx` now imports `computeImportDiff` and the `ImportDiff` type from `../lib/importDiff`. `warningToToastMessage`, `slug`, and `ImportConfirmDialog` stay in the parent file — no reuse surface and tightly coupled to the panel's render path.

### Fixed
- **`useDebouncedSave.flush()` now wraps the synchronous saveFn call in `Promise.resolve(...).catch(...)`** to match the existing pattern in the debounced `save()` callback. `saveFn` is typed `(value: T) => void`, but real callers (notably `persistProject` in `useProject`) return a Promise. When the user triggered an undo/redo (which calls `flush()` to bypass the 500ms debounce) and the underlying Firestore save rejected — permission change, network drop, etc. — the rejection became an unhandled-promise warning rather than a logged error. `flush()` now logs the same `[useDebouncedSave] flush failed:` prefix that `save()` already used.

### Tidy
- **Loosened `stripUndefined`'s generic constraint from `<T extends Record<string, unknown>>` to `<T extends object>`** in `src/lib/storage/firestoreUtils.ts`. Interface types like `FirestoreProjectDoc` are not structurally assignable to `Record<string, unknown>`, which previously forced two callers in `firestoreRepo.ts` (`createProject`, project import) to use `as unknown as Record<string, unknown>` double casts. The function body iterates `Object.entries(obj)` so the runtime is unchanged; only the call-site type signatures get cleaner. Both double casts removed.
- **Investigation-flag comments added at two sites** that work today but warrant a second look before adjacent changes: (1) `useProject.ts` undo/redo nest `setRedoStack`/`setProject`/`setUndoStack` updaters in a way that technically violates React's "updaters are pure" contract — revisit before any React major upgrade or strict-mode tightening; (2) `firestoreRepo.ts` `saveProject`/`createProject` invoke `repo.getTeamPool()` through the delegating module — revisit before introducing any concurrent or cross-tab path that could swap the active repo while a save is awaiting the pool snapshot. No behavior change in either case.

### Tests
- 911 passing across 59 test files (was 899 across 58). New: `src/features/reforecast/lib/__tests__/importDiff.test.ts` covering `computeImportDiff` (case-insensitive pool match + assignment-id reuse, fallback-to-Unknown when role is not in laborRates, role kept when it matches a labor rate, orphaned existing assignments → `removedCount`, only emits new allocations for value > 0, detects allocation changes vs. active reforecast) and `countAllocationDiffs` (identity case, increase, removal, newly-added month, assignment-id rotation with stable poolMemberId/value as a non-change). Extended `useDebouncedSave.test.ts` with a `flush()` rejected-promise path that asserts `console.error` fires with the `[useDebouncedSave] flush failed:` prefix.

---

## [0.28.0] - 2026-05-08

### Added
- Feature flag enabled — bulk invitations live in production as of 2026-05-08.
- Bulk project invitations. Project owners can invite collaborators by email from the project Sharing section: paste a list of emails (separated by commas, spaces, or newlines), pick a role (Editor or Viewer), and send. Existing SPERT Suite users are auto-added as members; new users receive a one-click join link via email.
- Pending invitations list: each pending row shows the invitee email, role, and resend counter (N/5). Owners can Resend (capped at 5 per invitation) or Revoke (with a ConfirmDialog). Resend success shows an inline "Invitation re-sent." confirmation that auto-clears after ~3 seconds.
- Result chips render after each send: green Added (auto-added existing user), blue Invited (new user, email sent), red Failed (CF rejected — rate limit, malformed, etc.), amber Invalid (client-side EMAIL_RE rejection — these never hit the CF, so the textarea retains its content for correction).
- New /?invite=<token> URL handler: when a user lands on MyScrumBudget via an invite email link, an InvitationBanner appears as a centered card above the page content. Pre-auth state shows Sign in with Google / Microsoft buttons (powered by the new shared useSignInWithTosGate hook). After sign-in, the banner transitions through Verifying → "You now have access to: <project name>" or a 30-second-grace timeout to a "didn't match your account" failure message.
- Backed by four Firebase Functions in the shared spert-suite project (us-central1): sendInvitationEmail, claimPendingInvitations, revokeInvite, resendInvite. The daily expireInvitations scheduled function (03:00 UTC) sweeps stale pending invitations to expired across all SPERT apps automatically.

### Changed (flag-independent — ships in all v0.28.0 builds)
- User profiles dual-written to spertsuite_profiles on every auth resolution. The new cross-app collection enables email→uid lookup for the invitation system. Writes are fire-and-forget; failures are warned to the console but do not block sign-in. Privacy-relevant: every signed-in MSB user now has a doc in this shared collection (displayName normalized via getFirstName, email lowercased, photoURL).
- myscrumbudget_profiles write moved from auth.ts ensureProfile() into AuthProvider.onAuthStateChanged. Previously the profile write only happened at explicit signInWithPopup resolve; it now runs on every auth resolution including page reloads. Returning users' lastLogin timestamp updates on every page load. Body preserved verbatim from ensureProfile (no normalizeDisplayName, "" email fallback, conditional createdAt) — this is a move, not a refactor.
- AuthProvider callback ordering fixed: setLoading(false) now fires BEFORE setUser(user) inside subscribeToAuth's callback. React 18 batches the two synchronous state updates, but the order matters for downstream effects with deps [user] or [loading] — they now see a clean (loading=false, user=X) transition in a single render instead of an intermediate (loading=true, user=X) state.
- TOS-gated sign-in logic deduplicated. The pendingProvider/showTosModal/handleSignIn/handleTosAccepted pattern previously inlined separately in CloudStorageModal.tsx and CloudStorageSection.tsx is now in a shared useSignInWithTosGate hook. Behavior identical: auth/popup-closed-by-user and auth/cancelled-popup-request silent-return; auth/popup-blocked surfaces an inline "Pop-up was blocked..." message; all other errors flow through sanitizeFirebaseError. Both consumers refactored to use the hook.
- Cloud-flip helpers extracted to src/lib/storage/cloudFlipHelpers.ts. setHasUploaded and getHasUploaded were duplicated as private functions in both cloud storage components; they are now shared exports so the new useInvitationLanding hook can flip storage mode on invite arrival without re-implementing the same localStorage protocol.
- New shared invitation modules: src/lib/firebase/profileWrites.ts (writeSpertsuiteProfile and writeMyscrumbudgetProfile, each with intentional asymmetry comments), src/lib/firebase/claimPendingInvitations.ts (claimPendingInvitationsAndNotify with emailVerified/db/functions guards and Lesson 27 payload gate before dispatching spert:models-changed), src/lib/firebase/invitations.ts (listPendingInvites filtering on (inviterUid, modelId) per Lesson 52, removeCollaborator with three-guard runTransaction per Lesson 50, async callable wrappers with requireFunctions() null-check, mapInvitationError with context discriminator per Lesson 13).
- src/hooks/useInvitationLanding.ts: state machine driving the InvitationBanner (idle → pre_auth → claiming → claimed | failed). Module-level captureInviteTokenFromUrl() captures ?invite= synchronously at import time before MigrationGuard's null-render can block the banner from mounting. SESSION_KEY consumed on claimed transition, on auto-fail timer, and on dismiss — page reload after any of these does NOT re-show the banner. Effect 5 filters claimed[] to MSB-only (cross-app claims still happen server-side; only the MSB banner display is per-app).

### Performance
- Parallelized getProjectMembers profile lookups. The legacy serial for-of loop with await getDoc inside scaled wall-time as O(N) round-trips. Now uses Promise.allSettled across all member uids — wall-time drops to O(1) round-trips. A rejected per-uid lookup is logged to console.warn and the member is still surfaced with empty displayName/email (matches prior per-uid try/catch fallback). The existing SharingSection benefits from this immediately; BulkSharingSection inherits it.

### Security
- CSP connect-src expanded to include https://*.run.app. Firebase Functions v2 callables may resolve to either *.cloudfunctions.net or *.run.app at runtime; without *.run.app, Cloud Run-backed callables would be blocked in production only (localhost cannot detect this). Slated for narrowing to a more specific pattern (likely *.uc.a.run.app for us-central1 v2) in a follow-up commit before the feature flag flips.
- New runTransaction-based removeCollaborator in src/lib/firebase/invitations.ts replaces the legacy updateDoc-based removeProjectMember (which only had Guard 3, owner-target). The new function adds Guard 1 (self-removal pre-check, before transaction) and Guard 2 (caller-must-be-owner, defense-in-depth inside the transaction read). UI is owner-gated, so Guard 2 should never fire in normal use; it logs a console.warn if it does ("non-owner attempted remove — UI gating bypass?"). First use of runTransaction in the MSB codebase.

### Tests
- 899 passing across 58 test files (was 863 across 53). New: parseBulkEmails (10 cases — delimiter variants, dedup, empty input, mixed valid/invalid), invitations.ts (10 cases — three guards × two failure paths × happy path × null-functions guard × Lesson 13 mapInvitationError context discriminator), claimPendingInvitations (4 cases — emailVerified guard, payload gate, success dispatch, console.error on CF failure), profileWrites (7 cases — null email skip, lowercased email, normalized displayName, no uid field, serverTimestamp after spread, conditional createdAt, "" fallback for legacy compatibility), captureInviteTokenFromUrl (5 cases — happy path, enabled=false no-op, no-?invite= no-op, idempotency, fragment preservation). vi.hoisted profileWrites mock template documented but skipped — Step 0c audit found zero AuthProvider tests render <AuthProvider>.

## [0.27.1] - 2026-05-06

### Fixed
- **Tightened print/PDF report column alignment and label/value spacing.** The three executive-summary tables on page 1 (Project Summary, Active Reforecast, Forecast Metrics) previously rendered as independent `<table>` elements with no fixed column widths, so each table auto-sized its 4 columns from its own content. Two visible problems: (1) cross-section zig-zag — column edges landed at different X positions across sections because Project Summary stretched its label column to fit "Estimate to Complete (ETC)" while Forecast Metrics only needed enough room for "Budget Ratio"; (2) within each row, labels and their values sat at opposite edges of a half-width band with a large dead gap between them
- **Five-track shared layout** — all three tables now use a shared `<colgroup>` of `27% / 14% / 18% / 27% / 14%` (label-L | value-L | GAP | label-R | value-R) with `table-layout: fixed` via the `table-fixed` Tailwind class. Each value sits directly next to its own label, the two label/value pairs are separated by a visible 18% whitespace channel in the middle, and column edges line up at identical X positions across all three sections regardless of label length
- **Each row renders five `<td>`s** with an empty `aria-hidden` spacer cell at index 2 to occupy the gap track. Page-side margins are unchanged (still set by `@page` in `globals.css`)
- **Value cells (column 2 and column 5) are right-aligned.** Currency stacks cleanly — `$250,000` over `$20,000` align by their last digit, which is the standard convention for financial reports. The colored EAC value cell on the Project Summary row keeps its RAG color and bold weight, just right-aligned now
- **Print-only label tweaks** so the longest labels comfortably fit the narrower 27% label column without crowding their numeric values: `"Estimate to Complete (ETC)"` → `"Est. to Complete (ETC)"`, `"Estimate at Completion (EAC)"` → `"Est. at Completion (EAC)"`, and `"NPV"` → `"Net Present Value"` (the acronym is not otherwise explained in the printed report). The on-screen `ProjectSummary` and `ForecastMetricsPanel` keep their full "Estimate" / "NPV" labels — these tweaks are scoped to `PrintableReport.tsx` only

### Tests
- 863 passing across 53 test files (no test changes — purely a print-only CSS/layout adjustment with no behavioral surface)

---

## [0.27.0] - 2026-05-06

### Added
- **Violet "Under Budget" health status.** A fourth dashboard status indicator activates when a project's EAC tracks more than a user-configurable percentage below its baseline budget (default: 20%). The business trigger: teams running materially under budget often need to issue a formal change request to sponsors and stakeholders. Configure in Settings → Dashboard Thresholds → "Violet under (%)"
- **Boundary semantics for violet are exclusive** (`variancePercent === -20` stays green; `variancePercent < -20` is violet), symmetric with the existing amber/red boundaries. The amber/red over-budget logic is unchanged — only the previously-always-green under-budget half is split into green (within violet threshold) and violet (beyond it)
- **Violet display surface area:** dashboard project cards, project detail summary, and the printable PDF report all render the violet dot indicator (●) and "Under Budget" label using `text-violet-600` / `dark:text-violet-400` (`text-violet-700` in print, light-only)
- **Settings → Dashboard Thresholds gained a "Violet under (%)" input row** beneath the existing red row, plus an inline warning when `violetPercent === 0` ("any under-budget project will trigger Violet"). The legend paragraph beneath the inputs documents all four bands

### Fixed
- **Cloud-mode Firestore read fallback.** Pre-v0.27.0 Firestore settings docs lack `violetPercent`. The previous read pattern `data.trafficLightThresholds ?? DEFAULT_SETTINGS.trafficLightThresholds` would short-circuit on the truthy LHS and never inject the new field. `firestoreRepo.ts:56` now uses a merge-with-defaults pattern: `{ ...DEFAULT_SETTINGS.trafficLightThresholds, ...(data.trafficLightThresholds ?? {}) }`. User-customized `amberPercent`/`redPercent` values still survive the merge; missing `violetPercent` gets the 20 default. localStorage-mode users get the same outcome via the v0.13.0 migration
- **Form-control hygiene sweep on `ThresholdSettings.tsx`:** the existing amber and red inputs gained `autoComplete="off"` (matching the standing form-hygiene rule). The new violet input also gets it

### Migration
- **Data migration v0.13.0** backfills `violetPercent: 20` into all existing `trafficLightThresholds` objects. The migration is conservative: it spreads existing thresholds first so user-customized `amberPercent`/`redPercent` values are preserved, and only injects `violetPercent` when absent (a user who somehow already has a customized value keeps it)
- The historical v0.7.0 migration (which originally introduced `trafficLightThresholds`) is unchanged — the v0.13.0 migration runs after it in all upgrade paths

### Tests
- 863 passing across 53 test files (+13 net additions). New coverage: `getTrafficLightStatus` boundary tests (`vp = -20` green, `vp = -20.1` violet), zero-threshold edge case (any under-budget triggers violet), high-threshold edge case (`-99` stays green when threshold is `100`), NaN regression test (degenerate metrics return green not violet), `getTrafficLightDisplay('violet')` shape, `validateAppState` rejection of missing/negative `violetPercent`, three new v0.13.0 migration tests (backfill, idempotency on user-customized value, preservation of amber/red)
- Bulk-bumped 28 `migrations.test.ts` assertions from `0.12.0` → `0.13.0` (final-state assertions only; intermediate-state assertions like "v0.11.0 → v0.12.0 as a no-op" were updated explicitly to acknowledge that v0.13.0 now adds `violetPercent` to settings)

---

## [0.26.4] - 2026-05-03

### Fixed
- **Form-field hygiene residual sweep.** The v0.26.3 pass added `autoComplete` to four inputs but left a substantial backlog of Chrome DevTools form/accessibility warnings: 13 unassociated `<label>` elements (label sibling, no `htmlFor`, no implicit wrap), and ~32 `<input>`/`<textarea>`/`<select>` elements missing both `id` and `name`. This release closes those gaps. Goal: opening Chrome DevTools Issues panel on any page produces zero form-field-related entries
- **Forms with unassociated labels** (`ProjectForm`, `SharingSection`, `AddPoolMemberForm`, `ThresholdSettings`, `ProductivityWindowPanel` add-form) now use the established `useId()` + `htmlFor` pattern (matching `BaseDialog`, `CloudStorageModal`, `ReforecastNotes`, `ExportAttribution`, `SettingsForm`, `NewReforecastDialog`, `ReforecastToolbar`). One `useId()` per component, suffixed per field (e.g. `${baseId}-name`, `${baseId}-budget`). Fields also got semantic `name=` attributes (`projectName`, `projectStartDate`, `baselineBudget`, `shareInviteEmail`, `memberName`, `amberThresholdPercent`, `addProductivityWindowStart`, etc.)
- **Tabular edit/add inputs** (`HolidayTable` 6 inputs + 1 bulk-year checkbox, `RateTable` 4 inputs, `PoolMemberTable` edit name, `ProductivityWindowPanel` 6 edit-row inputs) got `name=` attributes. No `<label>` was added because the column headers serve as the visual labels per standard tabular UX
- **Standalone inputs with existing aria-labels** (`HistoricalCostsTable` cost cell, `ReforecastNotes` textarea, `ResourcePlanExcelPanel` file input) and bare-context inputs (`ProjectSummary` inline edit, `AllocationGridAddRow` member-picker select, `AllocationGridRow` grid cell, `DataPortability` import-JSON file, `LocalStorageWarningToggle` checkbox, `TosConsentModal` checkbox) all got semantic `name=` attributes
- **`ReforecastToolbar` orphan `htmlFor` fixed.** When `editingName` is true, the `<select id="rf-select">` unmounts and `<input id="rf-name-edit">` mounts in its place, but the surrounding `<label htmlFor="rf-select">` was left pointing at the now-unmounted control. The label's `htmlFor` is now driven dynamically: `htmlFor={editingName ? 'rf-name-edit' : 'rf-select'}`, so the label always associates with whichever control is rendered

### Architecture
- **`RoleSelect` shared wrapper extended.** Added optional `id?: string` prop (default undefined). The wrapper now always sets `name="role"` internally, so both call sites (`AddPoolMemberForm`, `PoolMemberTable` edit row) satisfy Chrome's id-or-name rule via the wrapper rather than per-call-site. Backward-compatible: existing callers without `id` continue to render unchanged

### Adjacent accessibility fixes (in passing)
- Added `aria-label` to four form controls while editing them for `name=`/`id=`: `ProjectSummary` inline-edit input (label-as-aria for the input itself, since the wrapping role="button" container's aria-label only covers the static state), `AllocationGridAddRow` member-picker select ("Add team member to reforecast"), `AllocationGridRow` grid cell ("Allocation for {name} in {month}"), `ResourcePlanExcelPanel` and `DataPortability` file inputs

### Reuse callouts
- `name="memberName"` is reused across `AddPoolMemberForm` (inside its `<form>`) and `PoolMemberTable` edit row (no `<form>` ancestor) — they never coexist in the same form, no form-data collision
- `name="role"` is set internally by `RoleSelect`, so the same name appears at both call sites with the same containment guarantee

### Tests
- 850 passing across 53 test files (no test additions or removals; same suite, all green)

---

## [0.26.3] - 2026-05-03

### Fixed
- **Surface Firestore write errors to the user.** Routine settings, project, and team-pool saves go through `useDebouncedSave`, which previously caught every save failure with a silent `console.error` — a user editing a project offline (or with revoked Firestore permissions) saw no signal that their work was not persisted. Each consumer hook (`useSettings`, `useTeamPool`, `useProject`) now wraps its `repo.save*` call with a try/catch that emits a red error toast ("Failed to save settings/team pool/project. Please check your connection.") before rethrowing so `useDebouncedSave`'s existing console log still fires (single source of console truth, plus a user-visible signal)
- **Surface Firestore real-time listener errors to the user.** Both `onSnapshot` listeners in `useCloudSync` (the projects query and the per-user settings doc) now register error callbacks. On listener termination — permission rule change, network drop, invalid query — the handler logs to console and shows a red toast ("Cloud sync connection issue. Recent changes may not appear until reconnect."). A per-effect-cycle flag suppresses duplicate toasts when both listeners fail in the same tick. An inline comment notes that no automatic resubscribe runs — full reconnect is deferred and the user must reload or re-sign-in
- **Add `autoComplete` to four form inputs.** `<input type="email">` in the project Sharing section (collaborator invite) now has `autoComplete="off"`, eliminating the unconditional browser DOM warning. The Export Attribution Name field gets `autoComplete="name"` (user's own name; browser autofill is correct UX). The Team Pool add-member name field and the inline edit-name field both get `autoComplete="off"` (third-party name; browser autofill of the user's saved name would be wrong)

### Architecture
- **`addToastGlobal` escape hatch added to `Toast.tsx`.** A module-level pointer that the active `ToastProvider` registers on mount and clears on unmount; while no provider is mounted (e.g. test harness rendering a hook directly), calls are no-ops with a console breadcrumb. Lets non-context consumers — bare-rendered hooks in tests, listener callbacks outside provider scope — surface toasts without altering hook signatures or test setup. The existing `useToast()` context API is unchanged

### Tests
- 850 passing across 53 test files (no test additions or removals; same suite, all green)

---

## [0.26.1] - 2026-04-30

### Added
- **Branded favicon and header icon.** New `spert-favicon-myscrumbudget.png` (192×192 PNG, green `#16a34a` panels with rounded corners) replaces the default Next.js favicon as the browser tab icon and now appears to the left of the app name in the sidebar header. A charcoal dark-mode variant (`spert-favicon-myscrumbudget-dark.png`) auto-swaps when the active theme is dark, driven by the existing `useDarkMode()` hook

---

## [0.26.0] - 2026-04-30

### Added
- **Undo / Redo on the project detail page.** Every mutation that flows through `updateProject` (allocation edits, assignment add/remove, productivity windows, actuals, baseline, reforecast metadata, notes, etc.) now pushes a snapshot onto a session-scoped undo stack. `Ctrl+Z` undoes, `Ctrl+Shift+Z` redoes — also `Cmd+Z` / `Cmd+Shift+Z` on Mac. Stack depth is capped at 50 (`UNDO_STACK_LIMIT`); history clears on navigation away from the page (in-memory only, never persisted)
- **Undo and Redo toolbar buttons** in the project page header, positioned between Print and the trash icon. Buttons are disabled (not hidden) when their respective stacks are empty so the toolbar layout stays stable; both are excluded from the print report
- **Commit-based grouping for the notes textarea.** Focusing the notes field calls `beginUndoGroup()` which pushes one pre-edit snapshot and sets a guard ref; while the guard is active, subsequent `updateProject` calls during typing skip pushing. Blur calls `endUndoGroup()` which clears the guard. Net effect: an entire notes editing session — however many keystrokes — costs exactly one undo entry
- **Mid-edit undo/redo correctness.** Both `undo()` and `redo()` clear the group flag at the very top, so a `Ctrl+Z` while the textarea is still focused leaves the user able to keep editing with a fresh undo entry seeded on the very next keystroke. The seeding is driven defensively from `onChange` (not just `onFocus`), since `onFocus` doesn't refire when the same focus session resumes typing after a mid-edit undo. Without these two coupled pieces, post-undo typing would be unrecoverable
- **Ctrl+Z and Ctrl+Shift+Z entries** added to the Global group in the keyboard shortcuts dialog (Ctrl+?)

### Changed
- **`useProject` hook surface extended** with `undo`, `redo`, `canUndo`, `canRedo`, `beginUndoGroup`, `endUndoGroup`. Existing callers (`updateProject`, `flush`) unchanged — purely additive. Snapshots store `Project` references directly rather than deep clones; the existing spread-based mutators guarantee the live tree never mutates a snapshot in place. `cloudSyncBus` reloads bypass `updateProject` entirely, so inbound cloud-sync updates correctly do NOT enter the local undo history
- **`useKeyboardShortcut` shift option is now tristate.** `shift: true` requires Shift to be pressed, `shift: false` requires Shift to be ABSENT, and `shift: undefined` matches either (the previous default, preserved for backward compatibility with the `Ctrl+?` registration in the sidebar). Without the `false` case, registering `Ctrl+Z` for undo would also fire on `Ctrl+Shift+Z` and cancel the redo handler
- **`undo()` and `redo()` bypass the 500ms debounce.** They call `persistProject(snapshot)` followed immediately by `flush()`, so the restored snapshot is durable on the wire (localStorage or Firestore) before the function returns — no stale debounce can clobber it later

### Architecture
- **Single intercept point.** All undo/redo bookkeeping lives in `updateProject` and the four group/operation callbacks on `useProject`. No mutation site outside the hook is undo-aware. Snapshots are pushed pre-update (so `undo` restores to "the state before this mutation"), and the redo stack is invalidated on every fresh user mutation
- **Stack containers chosen for re-render semantics.** `undoStack` and `redoStack` are `useState<Project[]>` so the derived `canUndo` / `canRedo` flags trigger toolbar button enable/disable on push and pop. `undoGroupActiveRef` is a `useRef<boolean>` so toggling it on every keystroke's surrounding focus/blur cycle does NOT cause re-renders
- **New shared icons.** `UndoIcon` and `RedoIcon` added under `src/components/icons/` matching the existing Heroicons-style pattern used by `TrashIcon`, `PencilIcon`, etc.

### Tests
- 830 → 850 passing across 53 test files (+20 net additions, no removals). `useProject.test.ts` (new file, 13 tests) covers: initial load, undo/redo round-trip, redo clearing on new mutation, no-op undo/redo on empty stacks, single-entry grouping for `beginUndoGroup`/`endUndoGroup`, idempotency of `beginUndoGroup`, mid-group undo correctly clears the flag for continued editing, `UNDO_STACK_LIMIT` cap (60 mutations → 50 retained), synchronous persistence of restored snapshots via `flush()`, and the cloudSyncBus reload-does-not-push invariant. `ReforecastNotes.test.tsx` (new file, 6 tests) covers expand/collapse, value forwarding, `onBeginEdit`/`onEndEdit` on focus/blur, defensive `onBeginEdit` on every keystroke, and graceful operation without optional callbacks. `ShortcutsDialog.test.tsx` extended with one assertion covering the new Undo/Redo entries

---

## [0.25.0] - 2026-04-29

### Added
- **Archive / Unarchive pool members.** `PoolMember` gains an optional `archived?: boolean` flag. Archived members disappear from the `+ Add member` picker dropdown everywhere — both new project rows and existing reforecasts — but continue to render normally in any saved reforecast that already references them. Historical integrity is preserved at the `resolveAssignments` boundary (the resolver drops the `archived` flag when producing `TeamMember[]`), so charts, EVM metrics, and `AllocationGridRow` treat archived members identically to active members. The archive flag lives only on `PoolMember`; it never enters `ProjectAssignment`, `TeamMember`, or the Firestore `_teamSnapshot`
- **Show archived (N) toggle** on the Team Pool page. When the pool contains any archived members, a small toggle appears above the table; clicking it reveals a second band of archived rows below the active rows, separated by a dashed divider. Archived rows are visually muted (`opacity-60`) but not strikethrough — strikethrough reads as "deleted" and would mis-signal. Each archived row gets an "Unarchive" action where active rows show "Archive"
- **Inline Archive button on delete-blocked errors.** When the user attempts to delete a pool member who is referenced in any reforecast, the per-row error message now offers an "Archive instead" button right next to the offending row (instead of the previous global red banner above the table). One click archives the member and clears the error. Archived-but-still-in-use members get a different error message and no Archive button (they are already archived)
- **`AddPoolMemberForm` archived-name collision dialog.** Typing the name of an archived member surfaces a new "Archived Member Found" dialog with three actions: Unarchive (reactivates the existing pool entry), Add as new (creates a new active member with the same name), or Cancel (preserves the typed input for editing). The pre-existing duplicate-name dialog for active members is unchanged
- **Excel resource plan import auto-unarchive (W5).** When an imported row's name matches an archived pool member (case-insensitive), the importer now reactivates that member rather than creating a duplicate. Surfaces as a new soft warning W5 ("Archived member \"X\" was reactivated because they appeared in the imported resource plan.") via toast. The W5 warning rides the existing `ImportWarning` discriminated union and is dispatched through the same `warningToToastMessage` pipeline as W1–W3. W2 (role mismatch) still fires independently if the Excel role differs from the pool role

### Changed
- **`useTeamPool.deletePoolMember` return type extended** from `{ ok: boolean; reason?: string }` to `{ ok: boolean; reason?: string; canArchive?: boolean }`. The new `canArchive` signal lets the UI render the inline Archive button without re-deriving membership state. `canArchive` is `true` only when the in-use guard fires AND the member is not already archived. Reason copy now explicitly mentions archiving as the alternative path
- **`PoolMemberTable` refactored to a two-band layout** (active rows above, archived rows below the dashed divider) with per-row delete-error display. The previous global error banner is replaced with a Fragment-wrapped error `<tr>` rendered immediately after the offending member's main `<tr>`. The same Fragment pattern is applied to BOTH the active band and the archived band so a delete attempt on an archived member surfaces its error inline next to the right row

### Storage
- **`DATA_VERSION` bumped 0.11.0 → 0.12.0.** New no-op migration entry follows the v0.9.0 shape exactly (`assertArray` on `teamPool`, version stamp). The `archived` field is optional and defaults to "active" when absent — no backfill is required or desirable. Existing v0.11.0 data round-trips through the migration unchanged except for the version field
- **Strict import validator (`validatePoolMember`)** now type-checks the optional `archived` field: must be boolean if present. Lenient localStorage guard (`isValidPoolMemberArray`) is intentionally unchanged — basic-shape lenient checks permit unknown fields for back-compat
- **No Firestore rules change required.** PoolMembers are nested inside the owner-scoped `myscrumbudget_settings/{userId}` doc with no field-level allowlist; `archived` rides along with the existing `teamPool` array

### Architecture
- **The picker filter (`.filter(pm => !pm.archived)`) lives ONLY in `AllocationGridAddRow`** — never upstream. Lifting the filter to `useTeam`, the project page, or `resolveAssignments` would silently break historical reforecasts: any saved assignment referencing an archived `poolMemberId` would render as `(Unknown)` because the resolver could no longer find the member in the filtered pool. An inline comment at the filter site warns future refactors not to lift it. Tests in `AllocationGrid.test.tsx` lock this invariant: an archived member who is also in `teamMembers` (resolved from a saved assignment) renders normally even while being excluded from the picker

### Tests
- 811 → 830 passing across 51 test files (+19 net additions). `useTeamPool` tests cover archive/unarchive state mutation and all four `deletePoolMember` outcomes (unassigned active, unassigned archived, assigned active with `canArchive: true`, assigned archived with `canArchive: false`). `team.test.ts` adds the historical-integrity proof: an archived member referenced in two reforecasts resolves with full name/role in both. `teamResolution.test.ts` asserts the archived flag is dropped at the resolver boundary (deep equality, no extraneous keys). `AllocationGrid.test.tsx` covers picker exclusion, all-archived empty-state, and the archived-row-renders-normally case. `validation.test.ts` covers `archived: true`, `archived: false`, missing field, and non-boolean rejection. `migrations.test.ts` covers the v0.11.0 → v0.12.0 no-op migration and v0.12.0 idempotency. `excelImport.test.ts` adds W5 emission and the W1-vs-W5 mutual-exclusion proof (matched archived member must NOT also emit W1, otherwise the importer would create a duplicate)

## [0.24.0] - 2026-04-29

### Refactored
- **`assignments: ProjectAssignment[]` moved from `Project` to `Reforecast`.** Each reforecast becomes a true point-in-time snapshot of the team — removing a member from the active reforecast no longer rewrites historical reforecasts; the same pool member can be on the team in one reforecast and absent in another. Allocation linkage is preserved because assignment IDs remain stable when reforecasts are cloned (`createNewReforecast` deep-clones source assignments preserving IDs — required so cloned `allocations`, which key on `assignment.id`, continue to resolve)
- **Migration v0.10.0 → v0.11.0** copies the existing project-level assignments verbatim (same IDs) into every existing reforecast that doesn't already have its own assignments array. Idempotent on re-run, allocation linkage preserved, no manual fix-up required
- **Firestore `docToProject()` gains a backward-compat read path:** legacy docs (`schemaVersion: 1`, top-level `assignments`) hydrate into reforecast-scoped assignments on load (deep-cloned per reforecast). New writes use `schemaVersion: 2` and never write the top-level field. Per-reforecast assignments win when both legacy and modern fields are present (idempotency)
- **`useTeam` hook fully rewritten to mutate only the active reforecast** via a private `withActiveReforecast(prev, fn)` helper. `addAssignment`, `removeAssignment` (including its allocation cascade), `reorderAssignments`, and `sortAssignments` are all scoped to the active reforecast; sibling reforecasts retain their own rosters
- **`useTeamPool.deletePoolMember` in-use guard** now scans across all reforecasts of all projects to detect referenced pool members
- **`validateAssignment` moved from `validateProject` to `validateReforecast`** — error paths shift from `projects[i].assignments[k]` to `projects[i].reforecasts[j].assignments[k]`

### Added
- **Resource Plan Excel export/import.** New collapsible section on the project detail page (below the allocation grid) lets resource managers round-trip the active reforecast's allocation grid as `.xlsx` for offline editing. Powered by `exceljs@^4.4.0`. Export writes a `Resource Plan` worksheet with row 1 title (merged), row 2 metadata (project, reforecast, reforecast date, ISO timestamp), row 4 header (`Name`, `Role`, then one column per project month as `YYYY-MM` strings), and data rows with allocation cells in Excel's built-in `0%` percentage format. Empty allocations export as `0` (rendered "0%"), never blank — resource managers need to see the cell. Freeze panes lock row 4 and the Name/Role columns
- **Hidden `_msb_meta` worksheet** (`state: 'veryHidden'`) carries a JSON identity tuple in cell A1: `{schema, appVersion, projectId, projectName, reforecastId, reforecastName, generatedAt}`. The defined-names API was rejected because it can only carry cell range references, not free-form text
- **Hard import errors (block import, shown in `AlertDialog`, aggregated):** E1 (not `.xlsx`), E2 (missing Resource Plan sheet), E3 (missing/malformed `_msb_meta` — confirms the file originated from a MyScrumBudget export), E4 (`projectId` mismatch — prevents importing a different project's plan), E5 (header row 4 doesn't match expected months), E6 (row missing Name or Role), E7 (non-numeric allocation cell), E8 (allocation outside 0–100), E9 (duplicate Name, case-insensitive)
- **Soft import warnings** surface as `'info'` toasts after a successful import, except W4 which surfaces in the import-confirm dialog with both reforecast names highlighted in amber: W1 (new pool member added — with role match if `Role` matches a `settings.laborRates[].role` exactly, otherwise role `Unknown` and the row renders red in `AllocationGridRow`), W2 (existing pool member's role differs in Excel — pool role kept, Excel role ignored), W3 (member in active reforecast but absent from Excel — removed from active reforecast only; sibling reforecasts retain them), W4 (Excel exported from a different reforecast than currently-active)
- **Allocation interpretation is dual:** 0 ≤ v ≤ 1 is treated as a decimal (Excel percentage-formatted cell returns 0.75 for 75%); 1 < v ≤ 100 is percentage and divided by 100 (so a hand-typed 75 becomes 0.75); anything outside is hard E8
- **Pale yellow (`#FFFF99`) input-cell shading** on every allocation cell in the exported Resource Plan sheet — financial-modeling convention signaling the edit zone to resource managers. Name and Role columns intentionally unshaded
- **`AllocationGridRow` renders the role text in red** (`text-red-600` / `dark:text-red-400`) when `member.role === UNKNOWN_ROLE` — visual cue that the member came from an Excel import and needs a real labor-rate role assigned before cost calculations make sense
- New constants in `src/lib/constants.ts`: `RESOURCE_PLAN_SHEET_NAME`, `RESOURCE_PLAN_META_SHEET_NAME`, `UNKNOWN_ROLE`

### Fixed
- **`AllocationGrid` Remove Team Member confirmation dialog copy.** Was "All allocations for this member across every reforecast will be lost" — incorrect after the v0.24.0 refactor since cascade is now scoped to the active reforecast only. Updated to "Their allocations in this reforecast will be lost. Other reforecasts are not affected"

### Tests
- 775 → 811 passing across 51 test files (+36 net additions). v0.11.0 migration cases including idempotency and missing-key tolerance; `firestoreUtils` legacy `schemaVersion: 1` round-trip and modern doc; per-reforecast roster independence in `team.test.ts`; `excelExport` rows/headers/formats/freeze panes/hidden meta sheet/merged title/FFFF99 input-cell fill; `excelImport` happy path round-trip plus E1–E9, W1–W4, allocation interpretation matrix, trailing-blank tolerance, error aggregation

## [0.23.0] - 2026-04-28

### Added
- **Per-chart Copy Image icon in the panel header.** Each cost chart on the project detail page (Monthly Cost bar chart and Cumulative Cost line chart) gains an independent Heroicons document-duplicate icon button in the upper-right of its panel header, alongside the chart title. Clicking the button rasterizes the entire panel (rounded border + title + legend + SVG) to a 2×-scale PNG via `html2canvas` and writes it to the system clipboard via `navigator.clipboard.write` + `ClipboardItem`, then fires a success toast. The two buttons are entirely independent — separate `useRef` on each panel, separate handler, no shared state. The button itself is excluded from the capture by the html2canvas `ignoreElements: el => el.classList.contains('copy-image-button')` predicate. Disabled in Firefox (which silently fails on `image/png` clipboard writes without an `about:config` opt-in) with an explanatory `aria-label`
- **Print button on project detail pages.** Page header gains a printer-icon + "Print" muted utility button (Heroicons printer outline, h-4 w-4) between Edit and Delete that calls `window.print()`. The browser's native print dialog opens with a "Save as PDF" destination available on macOS, Windows, and Chrome OS. No new route, no `jsPDF` dependency, no new test infrastructure — strictly browser-native printing
- **`PrintableReport` component** (`src/components/PrintableReport.tsx`) — hidden on screen via Tailwind `hidden print:block`, visible only in print. **Compact 2-page layout:** page 1 holds the executive summary (header + status banner + project summary + active reforecast + forecast metrics, all as dense 4-column label/value tables — no bordered tiles); page 2 begins via `break-before-page` and contains the Monthly Cost chart, Cumulative Cost vs Budget chart (both with `forceLightMode={true}`), Cost by Period table, and the footer. Header follows SPERT Scheduler's pattern: light-grayscale all-caps brand line "MYSCRUMBUDGET™ V0.23.0", project name, window dates, "Reforecast: {name}" scenario line, "Generated {timestamp}" line, and a horizontal rule divider
- **Colored RAG (Red-Amber-Green) status indicator on the printed report.** Renders as "● Status: On Track / At Risk / Over Budget" in `text-green-700` / `text-amber-600` / `text-red-700` respectively (light-only color classes). Prints in actual color thanks to the `print-color-adjust: exact` rule on `.print-report` descendants. The EAC value in the Project Summary is also rendered in the matching RAG color so the headline number pops at a glance
- **`forceLightMode` prop on `MonthlyCostBarChart` and `CumulativeCostLineChart`.** Optional boolean (defaults to `false`) that overrides the `useDarkMode()` result so SVG inline `fill`/`stroke` attributes always render in light-mode colors regardless of the `.dark` class on `<html>`. The hook is always called (hooks-rules compliant); only the consumed value is overridden. `PrintableReport` passes `forceLightMode={true}` so charts print with their light palette even when the user is browsing the app in dark mode
- **`@media print` block in `globals.css`.** Uses `display: none` on chrome elements (`nav`, `footer`, `button`, `[aria-live="polite"]`, `a[href="#main-content"]`), the `:has(> .print-report)` selector to hide siblings of the report inside its parent (class-agnostic — works regardless of the page wrapper className), `main > *:not(:has(.print-report))` to hide non-ancestor direct children of `<main>`, layout reset on `body` / `body > div` / `main` to strip flex constraints so reports flow across pages, `-webkit-print-color-adjust: exact` + `print-color-adjust: exact` to prevent ink-saving wash-out, `.print-section-keep` page-break rule, and `@page size: letter; margin: 0.5in`. The `:has()` selectors deliberately do NOT use the (buggy) `main:has(.print-report) *:not(.print-report):not(:has(.print-report))` pattern that would have hidden the report's own descendants
- **Dynamic `document.title` on the project detail page.** A `useEffect` builds the title as `${APP_NAME} for ${project.name} - ${formatDateLong(today)}` using local-time date construction (not `toISOString`) so the date doesn't drift to UTC's "tomorrow" on evenings west of GMT. The browser's native print page header (when "Headers and footers" is enabled) reflects this title — matches SPERT Scheduler's "SPERT Scheduler for Procurement Project - April 28, 2026" pattern. Restores the previous title on unmount or project change

### Changed
- **Tooltip readability on both cost charts** (`ChartTooltip.tsx`). Font `text-xs` → **`text-base`** (12 → 16 px), padding `px-2 py-1` → **`px-3 py-2`**, width 140 → **220** px. The tooltip now auto-sizes its height based on a new optional `lineCount` prop (default 2) so the line chart's 2-line tooltip ends up ~72 px tall and the bar chart's blended-month 4-line variant ends up ~120 px tall — the line chart tooltip no longer floats far above the cursor because of unused vertical space. Vertical positioning is computed as `Math.max(0, y - height - 8)` so the tooltip's bottom edge always sits ~8 px above the hovered point regardless of content size. Tooltips are not printed and not captured by Copy Image — only visible during hover
- **New dependency:** `html2canvas@1.4.1` (exact pin, no caret, for build reproducibility). Adds ~50 KB gzipped. Used only for the per-chart Copy Image feature; bundled statically because the cost is acceptable for the chart-bearing project detail route. The export helper (`src/components/charts/export-chart.ts`) wraps `html2canvas` with two important workarounds: (1) a `neutralizeOklch` `onclone` callback that walks the cloned DOM and rewrites Tailwind v4 modern color functions (`oklch`, `oklab`, `lab`, `lch`, `color-mix`, `color()`) into `rgb()`/`rgba()` because `html2canvas@1.4.1` cannot parse them; (2) the lazy `Promise<Blob>` `ClipboardItem` form, which preserves the original user-gesture context across the html2canvas rasterization step (otherwise Chrome rejects the clipboard write as "not in a user gesture")
- **`CopyImageButton`** (`src/components/CopyImageButton.tsx`) — reusable icon-only button with toast wiring. SSR-safe Firefox detection via `typeof navigator !== 'undefined'` guard at module level. Required class hook `copy-image-button` on the rendered `<button>` so html2canvas's `ignoreElements` predicate can filter it from the capture

### Tests
- Baseline unchanged: **762 passing** across 49 test files. Implementation is purely additive to the rendering tree — no existing assertions touch the affected props, DOM structure, or computed values. The Copy Image clipboard pipeline and `PrintableReport` rendering are validated manually in dev (matches SPERT Scheduler precedent for the same feature set)

## [0.22.5] - 2026-04-28

### Added
- **EVM hover tooltips on the project summary card.** The three EVM-coded tiles in the project summary row — Actual Cost, ETC, EAC — now expose the full earned value management term as a native HTML `title` tooltip on hover: "Actual Cost (AC)", "Estimate to Complete (ETC)", "Estimate at Completion (EAC)". The visible label text is unchanged so the 5-column tile row stays on a single line at every viewport width — an inline-label expansion was evaluated and rejected because the longer strings (26–28 chars) would have wrapped to two lines on a full-screen display while the shorter sibling labels (e.g. "Baseline Budget" at 15 chars) would not, producing visually uneven tile heights. Native `title` is a zero-layout-impact alternative that surfaces the full term to sighted users hovering for clarification while leaving screen-reader behavior governed by the existing visible labels and the editable tile's `aria-label`. The Baseline Budget and Start/Finish tiles are not EVM-coded and were intentionally left without tooltips
- **Optional `tooltip` prop on the local `InlineEditableField` component** (`src/features/projects/components/ProjectSummary.tsx`) — threads through to a `title=` attribute on the outer container `<div>`. Coexists with the existing `aria-label="Edit ${label}"` (no conflict). Used by the Actual Cost tile to surface "Actual Cost (AC)" without changing the visible label or the inline-edit contract (Enter commits, Escape cancels, focus auto-selects)

### Out of Scope (deliberate, per user direction)
- Dashboard `ProjectCard` — keeps the abbreviated `EAC:` label (space-constrained tile)
- `CostByPeriodTable` — already uses `Forecast Subtotal (ETC)` / `Total (EAC)` row labels
- Chart legends in `MonthlyCostBarChart` and `CumulativeCostLineChart` — stay short ("Actual" / "Forecast")
- About page features list — descriptive prose, abbreviations already understood in PM context
- `ForecastMetricsPanel` — already used the expanded "Estimate to Complete (ETC)" / "Estimate at Completion (EAC)" labels

### Tests
- Baseline unchanged: **762 passing** across 49 test files. No assertions touched these label strings (verified by grep), and the change is additive (a `title` attribute) with no visible-text or behavior change

## [0.22.4] - 2026-04-26

### Added
- **Inline reforecast rename via pencil button.** Previously the only way to correct a reforecast name typo was to delete the reforecast and recreate it (which would discard allocations and historical-cost entries). Added a small pencil icon to the right of the reforecast dropdown that swaps the dropdown for a text input in-place — same toolbar slot, no layout shift. Enter commits, Escape cancels, blur commits (matches the existing inline-edit contract used by `InlineEditableField`, `HistoricalCostsTable`, and `ReforecastNotes`). Validation: trim, reject empty, 50-char clamp (matches `NewReforecastDialog`'s `maxLength={50}` for parity). The dropdown is intentionally hidden while editing — switching reforecasts mid-rename is ambiguous, and the user must Enter or Escape first
- **`PencilIcon` shared component** (`src/components/icons/PencilIcon.tsx`) — Heroicons-style pencil SVG matching the shape of `TrashIcon`. Idle muted gray, hover blue (non-destructive). Available for any future rename affordance
- **`updateName` operation on `useReforecast` hook** — mutates the active reforecast's `name` field with trim + 50-char clamp + empty/no-op guards inside the hook so all callers (UI today, programmatic in future) get the same guarantees. Appends a `reforecast / update` changelog entry on commit, mirroring `updateHistoricalCosts`

### Tests
- Baseline: 749 → **762 passing** across 49 test files (+13, no removals). 8 new toolbar tests (pencil renders/hides, click-to-edit, Enter/Escape/blur commit semantics, empty-input rejection, no-switch-while-editing assertion via select absence). 5 new transformation-style tests for the rename updater logic in `reforecast.test.ts`

## [0.22.3] - 2026-04-26

### Reverted
- **Project summary tile label "Actual" → "Actual Cost".** The v0.22.0 rename was unintentional and broke alignment with EVM (earned value management) convention, which uses "Actual Cost" as the canonical term for cumulative-cost-incurred-to-date. Restored the original label on the project summary bar. The cumulative chart legend (also touched in v0.22.0) is left as-is for now — separate decision

## [0.22.2] - 2026-04-25

### Security audit (v0.22.0/v0.22.1 surface area)

This release is a targeted security audit of the v0.22.0 Historical Costs Breakdown surface area as left by the v0.22.1 refactor. Two confirmed defects were fixed; two lower-severity defense-in-depth items were deferred and explicitly tracked in CLAUDE.md.

### Fixed
- **F1 — Stale `actualsThroughDate` / `reforecastDate` could persist out of project bounds after a timeline tightening.** The Timeline Change confirmation dialog detected out-of-range allocations but did not examine reforecast-level date fields or the `historicalCosts` array. After a user shrunk `project.startDate` or `project.endDate` past existing reforecast dates, the stored values silently sat outside project bounds (HTML5 `min`/`max` on the inputs is advisory only — it prevents direct entry but does not normalize already-stored values). Calc-engine clipping and the `materializeBucketAt` range guard tolerated the divergence, but the data invariant ("stored reforecast dates lie within the project window") was broken and the displayed cutoff bucket could include or exclude entries inconsistently with the edit ceiling. Fixed by extracting a pair of pure helpers in `src/features/projects/lib/timelineChange.ts` (`computeTimelineChangeSummary`, `applyTimelineChangeToReforecasts`) wired into the project edit page. The apply callback now passes the NEW bounds explicitly to the helper, eliminating any sequencing ambiguity around which `startDate`/`endDate` is current. The Timeline Change dialog surfaces all three counts (allocations removed, dates adjusted, historical-cost entries stripped). Date fields are clamped (not cleared) to preserve user intent
- **F2 — Edit ceiling and display bucket disagreed when out-of-range historical entries were present.** `commitHistoricalCostEdit` filtered "other earlier entries" by `month < cutoffMonth` only — `buildHistoricalCostsView` filtered by `month >= projectStartMonth && month < cutoffMonth`. Result: a stored entry from before the project's current start month (e.g., a phantom Jan entry on a project later tightened to start in Feb) did NOT subtract from the displayed cutoff bucket but DID subtract from the edit ceiling. Users saw the displayed sum equal `actualCost`, then got clamped at a lower-than-expected ceiling when editing an earlier-month row. Fixed by passing `projectStartMonth` through to `commitHistoricalCostEdit` and applying the same in-range filter. The negative-bucket clamp itself (`Math.max(0, ...)`) was already intact in both paths — F2 was a correctness/UX defect, not a security one. With F1 in place, F2's manifesting condition (out-of-range stored entries) is normally resolved on the next project save anyway; F2 is a defense-in-depth alignment

### Deferred (tracked in CLAUDE.md)
- **F3 — Migration `0.10.0` does not type-check rebuilt entry fields.** Filters scenario entries, then maps surviving entries to `{ month: e.month, cost: e.cost, hours: typeof e.hours === 'number' ? e.hours : 0 }` without asserting `e.month` is a string or `e.cost` is a finite non-negative number. No production write path produces malformed entries; deferred as cheap-insurance hardening, not in response to a known exploit
- **F4 — Strict import validator (`validateHistoricalCostEntry`) does not reject extra properties on entries.** Hand-crafted JSON at version `0.10.0+` could re-introduce `source: "scenario"`-shaped entries and bypass the cleanup migration (which only runs at version ≤ 0.9.0). Defense-in-depth gap; deferred until a hardening pass

### Cleanup
- Deleted 46 stale macOS Finder copy artifacts (filenames like `routes.d 3.ts`, `validator 3.ts`) from the gitignored `.next/` build cache. These were producing a spurious `npx tsc --noEmit` duplicate-identifier error that hid the (clean) source-level baseline. After deletion, `npx tsc --noEmit` is 0 errors

### Tests
- Baseline: 733 → **749 passing** across 49 test files (+16, no removals). New file `src/features/projects/lib/__tests__/timelineChange.test.ts` covers F1 with 14 cases (summary counting, clamping, stripping, immutability, end-to-end scenario including the cutoff-equals-end-date case). 2 new cases appended to `historicalCostsView.test.ts` cover F2

### Audit posture
- Confirmed clean (no fix required): input parsing in `commitHistoricalCostEdit` (NaN/Infinity/negative all collapse to 0); toast firing on cap; `DATA_VERSION` gating prevents double-application of migrations; the 0.10.0 cleanup filter strips both `useForHistory` and `source: "scenario"` correctly; negative-bucket protection via `Math.max(0, ...)` in both view and edit paths; no production code path writes `source` or `useForHistory` (verified by grep); `sanitizeCurrency` wraps all `actualCost`/`baselineBudget` writes; floating-point drift bounded and not exploitable

## [0.22.1] - 2026-04-25

### Fixed
- **Stale `historicalCosts` could persist after a cutoff advance under specific over-allocation sequences.** When `materializeBucketOnAdvance` legitimately returned an empty array (because the prior-cutoff bucket evaluated to 0 and there was a stale entry to remove), the call site only conditionally set the field, so the existing stale value inherited via spread persisted. Fixed by treating the helper's return as authoritative — set when non-empty, `delete` (not `[]`) when the field was previously present and the helper returned empty. Repro required reducing `actualCost` to 0 with only a previously-materialized bucket entry stored, then advancing the cutoff. Added two regression scenarios in `userFlow.scenario.test.ts` using `'historicalCosts' in next` assertions to prove the key is actually deleted (or never introduced)

### Changed
- **DRY: extracted `materializeBucketAt` helper.** The bucket-computation formula (`max(0, actualCost − sum(strictly-earlier entries))` with project-start range guard) was duplicated between `materializeBucketOnAdvance` (cutoff-advance path) and the inline block in `createNewReforecast` (copy-from-source path). Both now delegate to a single `materializeBucketAt` helper in `historicalCostsView.ts`. `materializeBucketOnAdvance` becomes a thin wrapper that handles the should-we-materialize-at-all guards (missing prev cutoff, non-advancing change). No behavior change — both call sites preserved their existing project-start range-guard semantics
- **Extracted `commitHistoricalCostEdit` pure function.** The cap-and-upsert logic for inline edits in the Historical Costs Table (over-allocation clamping, no-op skip, entry build) was embedded in the React component. Moved to `historicalCostsView.ts` as a pure function returning `{ next, cappedAt }` — independently testable without React/toast scaffolding. Component glue shrank to a few lines that route the result to `addToast`/`onUpdate`. Existing component tests preserved (they assert externally-observable behavior). Added 7 unit tests for the pure function covering happy path, over-allocation cap, zero-entry removal, no-op detection, and invalid-input coercion
- **Validator alignment fix:** dropped dead `!== null` defensive checks for optional `actualsThroughDate` and `notes` fields in `validateReforecast`. The type contract uses the optional-field modifier (`?`) which only allows `undefined`, but the validator was accepting both `undefined` and `null`. No production write path produces `null` for either field (verified by full-history `git log --pickaxe-regex` and write-path audit), so no real-world import is affected. The change aligns the validator with the type contract — if a future code path ever produces `null`, it'll fail loudly with a validation error rather than silently passing
- **Doc clarity:** added a comment to `Reforecast.startDate` documenting the YYYY-MM format. Sibling fields (`reforecastDate`, `actualsThroughDate`) already had format comments; the missing one was a small footgun for new contributors

### Type-debt cleanup (test files only)
- Cleared all 41 pre-existing `tsc --noEmit` errors across 6 test files. Drift had accumulated across prior sprints whenever a domain type gained a new field but old test fixtures weren't updated. None of these errors blocked CI (Next.js production build only typechecks production code, and Vitest doesn't enforce strict types). After this cleanup, `npx tsc --noEmit` produces **0 errors** across the repo
- Files touched: `src/lib/calc/__tests__/fixtures/spreadsheet-1.5.ts`, `src/lib/storage/__tests__/localStorage.test.ts`, `src/features/reforecast/hooks/__tests__/useGridKeyboard.test.ts`, `src/features/reforecast/components/__tests__/AllocationGrid.test.tsx`, `src/features/reforecast/components/__tests__/ReforecastToolbar.test.tsx`, `src/lib/storage/__tests__/migrations.test.ts`. Production code untouched

### Dependencies
- `jsdom` 28.0.0 → 28.1.0 (test infrastructure, patch bump, 69 days post-release per the 60-day scrutiny rule). All other minor/patch updates currently available are blocked by the 60-day rule and were intentionally deferred (firebase 12.12.1, vitest 4.1.5, tailwindcss 4.2.4, react 19.2.5, @vitejs/plugin-react 5.2.0, eslint 9.39.4 — none older than 50 days as of release)

### Tests
- Baseline: 724 → **733 passing** across 48 files (+9 new tests, no removals: 2 B1 regression scenarios + 7 R2 unit tests)

## [0.22.0] - 2026-04-25

### Added
- **Per-month historical cost breakdown** under the cost charts on the project detail page. Collapsible table renders one row per month from project start through the cutoff month (driven by `actualsThroughDate`). Earlier months are user-editable inline numeric inputs; the cutoff-month row is read-only and auto-derives as `actualCost − sum(earlier-month entries)` so the column always sums exactly to the project total. Over-allocation attempts clamp to the available ceiling and surface a "Capped at $X" toast (error variant). Inputs commit on `Enter` (matches the `Baseline Budget` / `Actual` inline-edit contract from `ProjectSummary`); `Escape` cancels and restores the original value
- **Bucket materialization on copy/advance** — when copying a reforecast or advancing the cutoff to a later month, the prior cutoff month's effective bucket value is captured as a stored entry so it survives downstream edits. Always overwrites any pre-existing entry at that month (the cutoff row is never user-editable, so any prior entry there is stale by construction). Range-guarded so a cutoff before project start never materializes a phantom entry
- **Date input range validation** — the Reforecast Date and Actuals Through Date inputs now constrain to project start/end via native `min`/`max` attributes, preventing out-of-project-range typos from polluting the historical breakdown
- New `TrashIcon` shared component (`src/components/icons/TrashIcon.tsx`) so all three delete surfaces (dashboard tile, project detail page, reforecast toolbar) draw from a single source of truth

### Changed
- **Monthly cost bar chart is now stacked** — actual portion (teal) sits below the forecast portion (blue) per month, and mid-month cutoffs render as two-segment stacks that visualize the actual/forecast split explicitly. Tooltips on blended bars break down `Actual: $X / Forecast: $Y / Total: $Z`. The earlier 3-color blended palette (with a tertiary purple for cutoff months) was scrapped in favor of this clearer stacked treatment
- **Cumulative cost line chart split into two segments** — solid teal through any month containing actuals (including the blended cutoff month), dashed blue for the pure forecast trajectory beyond the cutoff. Cumulative chart right margin bumped 16→60 so the "Budget" label fits inside the plot area without clipping
- **Reforecast dropdown sorted newest-first** by `reforecastDate` desc, with `createdAt` desc as tiebreaker — quicker navigation in projects with many weekly reforecasts. New Reforecast dialog defaults `Copy From` to the newest source
- **`Actual Cost` tile renamed to `Actual`** on the project summary bar
- **Reforecast Delete button replaced by an icon-only trash glyph** at the far-right edge of the toolbar, past `+ New Reforecast`. Demotes the destructive action visually, keeps `+ New Reforecast` from drifting horizontally as the toolbar widens with the Actuals Through input. Idle muted gray, hover red. Confirmation dialog unchanged
- **Project Delete button replaced by the same icon-only trash glyph** on the project detail page, beside `Edit`. Same idle/hover semantics, sized one notch larger to balance the taller `Edit` button
- **Dashboard tile delete glyph** refactored to use the shared `TrashIcon` component (visual unchanged — same Heroicons trash SVG it was already drawing)
- Chart x-axis label fontSize 13→15 and y-offset 16→18 for legibility
- Cumulative chart legend `Actuals` → `Actual` for consistency with the bar chart and project summary tile

### Migration
- `DATA_VERSION` 0.8.0 → 0.9.0 — additive, no-op for existing data; allows the new optional `Reforecast.historicalCosts: HistoricalCostEntry[]` field
- `DATA_VERSION` 0.9.0 → 0.10.0 — cleanup migration that strips a `useForHistory: true` flag and `historicalCosts` entries with `source: "scenario"` from a scrapped earlier v0.22.0 design that polluted some users' localStorage during pre-fix testing. Most users will see no change

## [0.21.6] - 2026-04-24

### Fixed
- `LocalStorageWarningBanner` hydration mismatch. The component used a lazy `useState` initializer with a `typeof window === 'undefined'` guard intended to be SSR-safe, but the guard actually produced the mismatch: SSR returned `false` (no banner), first client render returned `true` (banner present), and React logged a recoverable hydration error on every page load where the banner was eligible to show. Reworked to always initialize `visible: false` on both SSR and first client render, then flip via `useEffect` after hydration. Classic pattern; comment updated to explain why a lazy initializer with a window guard is the wrong tool here. No visual change — just silences the console warning and lets the React tree hydrate cleanly on first render

## [0.21.5] - 2026-04-24

### Fixed
- v0.21.4 expanded the Reforecast name `<select>` floor from `min-w-48` (192px) to `min-w-64` (256px) — a +64px jump that produced obvious dead space between the selected value and the dropdown chevron on typical short names. Pulled back to `min-w-56` (224px, +32px from the original 192px) so the dropdown is modestly wider for longer names without looking comically empty for short ones

## [0.21.4] - 2026-04-24

### UX
- Reforecast name `<select>` floor width raised from `min-w-48` (192px) to `min-w-64` (256px). After the v0.21.3 date-input shrinkage left visible slack between the Actuals Through × button and the Delete / "+ New Reforecast" button pair, expanded the scenario dropdown to use some of that slack so longer reforecast names display fully without truncation. Chosen conservatively so the single-line desktop layout from v0.21.3 is preserved

## [0.21.3] - 2026-04-24

### Fixed
- Reforecast toolbar date fields actually shrunk this time. Prior v0.21.1 (`w-[140px]`) and v0.21.2 (`w-36 min-w-0 shrink`) Tailwind class combinations did not measurably shrink the native `<input type="date">` in practice — either the arbitrary-value class did not compile, or the browser's intrinsic min-width dominated. Switched to inline `style={{ width: 120, minWidth: 120 }}` which is bulletproof against both CSS-compilation and browser-default interference. Each date input is now exactly 120px wide, freeing ~160px of horizontal space for the Delete / "+ New Reforecast" button pair
- "+ New Reforecast" and "Delete" buttons received `whitespace-nowrap` so their labels no longer break into a second line when the toolbar gets tight
- Button group received `shrink-0` so it holds its width when space gets constrained

## [0.21.2] - 2026-04-24

### Fixed
- Reforecast toolbar wrap regression follow-up to v0.21.1. The prior `w-[140px]` arbitrary-value width on the date inputs was insufficient: the native `<input type="date">` has an intrinsic min-width that can override a declared width, and the `flex-wrap` container was still pushing Delete + "+ New Reforecast" to a second line on desktop widths. Switched to `w-36 min-w-0 shrink` (standard utilities + explicit min-width override) and added `md:flex-nowrap md:gap-3` to the container so the toolbar stays single-line at ≥768px. Below that breakpoint the layout still wraps gracefully for narrow mobile viewports

## [0.21.1] - 2026-04-24

### UX
- Baseline Budget and Actual Cost inline-edit inputs now auto-select their existing value on focus. Clicking to edit and typing immediately replaces the prior number — no more backspacing through the previous value
- Reforecast toolbar date inputs (`Date`, `Actuals Through`) constrained to 140px. The native `<input type="date">` default width left enough slack at common viewport sizes that the Delete + "+ New Reforecast" button pair wrapped to a second line; tightening the two date fields keeps the whole toolbar on one line. Scenario-name `<select>` retains its `min-w-48` so long reforecast names stay readable

## [0.21.0] - 2026-04-23

### Added
- Cloud Storage modal — a lightweight centered-overlay dialog triggered by any click on the auth chip (top-right of every page). Replaces the pattern of navigating to `/settings#cloud-storage` to sign in or switch storage modes. Settings retains its Cloud Storage section as a secondary access path
- Four state-driven variants in one dialog:
  - **Signed out** — Local radio selected/active, Cloud radio visibly disabled. Two side-by-side primary-blue sign-in buttons with full-color Google and Microsoft brand logos
  - **Signed in + local** — Cloud radio enabled. Identity card (normalized display name + email + red "Sign out" link). "Keep using local storage" button explicitly closes the modal without switching modes
  - **Signed in + cloud** — Cloud radio selected. Same identity card. Clicking Local triggers a switch-to-local confirmation
  - Fourth combination (signed-out + cloud) structurally impossible — sign-out already cascades mode→local via `performSignOutCleanup`
- Full display-name normalization: Microsoft Azure AD "Last, First MI" → "First MI Last" natural-reading order. New `normalizeDisplayName()` utility sibling to the existing `getFirstName()`, applied at every display surface (modal identity card)
- `<GoogleLogo>` and `<MicrosoftLogo>` inline SVG brand mark components in `src/components/icons/`
- Export Attribution and the localStorage-warning toggle now live inside the modal in addition to Settings, so users can adjust adjacent preferences without leaving the dialog

### Changed
- Auth chip (`StorageStatusPill`) lost its popover menus in favor of single-click modal-open behavior. All three chip variants (signed-out, signed-in-local, signed-in-cloud) now route every click through a shared `onOpen` prop. Lost behaviors — sign-out button in popover, "Switch to Cloud Storage" direct-link — are preserved inside the modal
- Notifications checkbox ("Warn me on startup when using local storage") extracted into a shared `LocalStorageWarningToggle` component. Settings page and modal both render the same component so toggle state stays in lock-step across surfaces
- `StorageStatusPill` now derives `mode` during render rather than via `useEffect(setMode)`. `usePathname()` and `useAuth()` trigger re-render on navigation / auth change; the render-time `getStorageMode()` read picks up fresh localStorage values. Eliminates a `react-hooks/set-state-in-effect` pattern

### Tests
- 9 new tests for `normalizeDisplayName`: Microsoft comma format with and without middle initial, Google format passthrough, single-name passthrough, null/undefined/empty handling, whitespace trimming, and degenerate comma positions (empty last or first segment returns input unchanged)
- Total: 671 tests across 44 files (up from 662)

## [0.20.2] - 2026-04-23

### Added
- Per-reforecast Notes field — free-text narrative (max 2000 characters) to record why a reforecast exists (scope change, team shift, delay, executive ask, etc.)
- Collapsible Notes panel renders directly below the reforecast toolbar. Collapsed by default; the note/document icon fills and a dot indicator appears when a reforecast has content, so context is discoverable at a glance
- Live character counter (`N / 2000`) during editing
- Notes roundtrip through JSON export/import and persist independently per reforecast (switching reforecasts surfaces that reforecast's own notes)

### Data Model
- `Reforecast.notes?: string` added to the domain type
- Data version bumped `0.7.0` → `0.8.0`; additive migration backfills `notes: ''` on every existing reforecast. Coerces non-string values to empty string
- `validateAppState` extended to reject non-string notes and notes exceeding the 2000-character cap on import
- `REFORECAST_NOTES_MAX_LENGTH = 2000` centralized in `src/lib/constants.ts`

### Tests
- 14 new tests across hook, migration, and validation layers (update/truncate/empty/isolation, migration backfill/preserve/coerce, validation accept/reject at boundary)

## [0.20.1] - 2026-04-19

### Fixed
- Fixed a latent Rules-of-Hooks violation in `CloudStorageSection` where a `useCallback` was declared after an `if (!firebaseAvailable) return null` early return. Constant at runtime today (Firebase config is env-derived), but the hoist to above the early return is correct per React's invariants

### Maintenance
- Lint gate cleanup: `npm run lint` now exits 0. Prior state on `main` was 35 problems (17 errors, 18 warnings) stemming from new React 19-era rules (`react-hooks/set-state-in-effect`) and miscellaneous unused-variable warnings
- Converted 4 `useEffect(() => setState(localStorage...))` sites to lazy `useState(() => ...)` initializers with `typeof window` guards (`page.tsx`, `settings/page.tsx`, `LocalStorageWarningBanner`, `FirstRunBanner`)
- Pragma-suppressed `react-hooks/set-state-in-effect` on 5 legitimate external-subscription hooks (`useProject`, `useProjects`, `useSettings`, `useTeamPool`, `useTheme`) with inline justification comments. The rule can't distinguish `cloudSyncBus`-driven refetches from cascading renders; `useTheme`'s `setMounted(true)` is the canonical SSR hydration guard. `useTheme` is flagged as a candidate for a future `useSyncExternalStore` refactor
- Pruned 7 unused type imports from `validation.ts` and 4 unused imports across test files and components
- Replaced 5 `as any` casts in `localStorage.test.ts` with narrower `as unknown as Record<string, unknown>` assertions for the legacy-shape migration tests
- Applied `prefer-const` to 3 `let` declarations in `usaFederalHolidays.ts`

### Security
- Hardened sign-out against cross-user data leakage. A centralized `performSignOutCleanup()` now cancels pending debounced saves before revoking Firebase credentials, clears per-user localStorage keys (`msb:projects`, `msb:settings`, `msb:teamPool`, `msb:changeLog`, `msb:originRef`, `msb:exportAttribution`, `msb:ratesReviewed`, `msb:hasUploadedToCloud`), resets storage mode to local, swaps the delegating repo to localStorage, calls `firebaseSignOut` inside a `try/finally`, and reloads the page
- `try/finally` guarantees the page reload fires even if `firebaseSignOut` rejects (network failure, revoked token), so the user is never left in a partially-cleaned-up state
- Local→Cloud migration now reads from the in-memory delegating repo (not a freshly-constructed LocalStorageRepository), closing a cross-user vector where a prior user's localStorage residue could be uploaded to a new user's Firestore account
- Sign-out preserves device-scoped keys: `msb-workspace-id`, `spert_tos_accepted_version`, `msb:suppressLocalStorageWarning`, `msb:theme`, `msb:version`, `spert_firstRun_seen` (documented inline in `signOutCleanup.ts`)
- `AuthProvider.signOut` now delegates to `performSignOutCleanup`; `CloudStorageSection.handleSignOut` and `StorageStatusPill.handleSignOut` are thin wrappers — no parallel cleanup drift
- Debounced saves are now cancellable in bulk via a module-level `pendingSaveRegistry` (each `useDebouncedSave` instance self-registers on mount)
- Debounced save errors are now caught and logged to `console.error` instead of becoming unhandled promise rejections

### UX
- Auth chip now renders four distinct states. Previously, a signed-in user in local mode saw the same "Sign in" chip as a signed-out user — an already-authenticated user staring at a Sign-in button. New signed-in-local state shows avatar + first name + lock icon, with a popover offering "Switch to Cloud Storage" (navigates to `/settings#cloud-storage`) and "Sign Out"
- Clicking "Switch to Cloud Storage" in the chip popover does NOT auto-switch mode; it navigates to the Cloud Storage section where the user explicitly confirms via the existing radio toggle (respects the upload-or-cancel prompt)
- First-name extraction (Microsoft "Last, First" vs. Google "First Last") extracted to a shared `getFirstName` utility — no more duplicated logic across chip branches
- Popup sign-in cancellations no longer surface red error banners. Closing the OAuth popup (`auth/popup-closed-by-user`) or double-clicking the sign-in button (`auth/cancelled-popup-request`) is now a silent no-op. Blocked popups show an actionable "Pop-up was blocked. Allow pop-ups for this site and try again." message
- Cloud Storage section has an `id="cloud-storage"` anchor for deep-linking from the chip popover

### Technical
- New `src/lib/storage/pendingSaveRegistry.ts` — module-level cancel registry for `useDebouncedSave` instances
- New `src/lib/auth/signOutCleanup.ts` — zero-argument `performSignOutCleanup()` with load-bearing execution order documented inline
- New `src/lib/utils/getFirstName.ts` — shared "Last, First" / "First Last" display-name parser
- `StorageStatusPill` re-reads storage mode on user changes (not just pathname changes) so sign-in without navigation correctly flips to the new signed-in-local chip branch
- `CloudStorageSection` split `confirmUpload` (main local→cloud migration, reads via delegating repo) from `confirmReupload` (re-upload stragglers, reads a fresh `LocalStorageRepository` — signposted as the only place this is safe)
- Added 22 new tests: 5 for `pendingSaveRegistry`, 10 for `getFirstName`, 7 for `signOutCleanup` (including the try/finally reload-on-reject guard). Total: 648 tests

## [0.20.0] - 2026-04-19

### Security
- Hardened sign-out against cross-user data leakage. A centralized performSignOutCleanup() now cancels pending debounced saves before revoking Firebase credentials, clears per-user localStorage keys (msb:projects, msb:settings, msb:teamPool, msb:changeLog, msb:originRef, msb:exportAttribution, msb:ratesReviewed, msb:hasUploadedToCloud), resets storage mode to local, swaps the delegating repo to localStorage, calls firebaseSignOut inside a try/finally, and reloads the page
- try/finally guarantees the page reload fires even if firebaseSignOut rejects (network failure, revoked token), so the user is never left in a partially-cleaned-up state
- Local→Cloud migration now reads from the in-memory delegating repo (not a freshly-constructed LocalStorageRepository), closing a cross-user vector where a prior user's localStorage residue could be uploaded to a new user's Firestore account
- Sign-out preserves device-scoped keys: msb-workspace-id, spert_tos_accepted_version, msb:suppressLocalStorageWarning, msb:theme, msb:version, spert_firstRun_seen (documented inline in signOutCleanup.ts)
- AuthProvider.signOut now delegates to performSignOutCleanup; CloudStorageSection.handleSignOut and StorageStatusPill.handleSignOut are thin wrappers — no parallel cleanup drift
- Debounced saves are now cancellable in bulk via a module-level pendingSaveRegistry (each useDebouncedSave instance self-registers on mount)
- Debounced save errors are now caught and logged to console.error instead of becoming unhandled promise rejections

### UX
- Auth chip now renders four distinct states. Previously, a signed-in user in local mode saw the same "Sign in" chip as a signed-out user — an already-authenticated user staring at a Sign-in button. New signed-in-local state shows avatar + first name + lock icon, with a popover offering "Switch to Cloud Storage" (navigates to /settings#cloud-storage) and "Sign Out"
- Clicking "Switch to Cloud Storage" in the chip popover does NOT auto-switch mode; it navigates to the Cloud Storage section where the user explicitly confirms via the existing radio toggle (respects the upload-or-cancel prompt)
- First-name extraction (Microsoft "Last, First" vs. Google "First Last") extracted to a shared getFirstName utility — no more duplicated logic across chip branches
- Popup sign-in cancellations no longer surface red error banners. Closing the OAuth popup (auth/popup-closed-by-user) or double-clicking the sign-in button (auth/cancelled-popup-request) is now a silent no-op. Blocked popups show an actionable "Pop-up was blocked. Allow pop-ups for this site and try again." message
- Cloud Storage section has an id="cloud-storage" anchor for deep-linking from the chip popover

### Technical
- New src/lib/storage/pendingSaveRegistry.ts — module-level cancel registry for useDebouncedSave instances
- New src/lib/auth/signOutCleanup.ts — zero-argument performSignOutCleanup() with load-bearing execution order documented inline
- New src/lib/utils/getFirstName.ts — shared "Last, First" / "First Last" display-name parser
- StorageStatusPill re-reads storage mode on user changes (not just pathname changes) so sign-in without navigation correctly flips to the new signed-in-local chip branch
- CloudStorageSection split confirmUpload (main local→cloud migration, reads via delegating repo) from confirmReupload (re-upload stragglers, reads a fresh LocalStorageRepository — signposted as the only place this is safe)
- Added 22 new tests: 5 for pendingSaveRegistry, 10 for getFirstName, 7 for signOutCleanup (including the try/finally reload-on-reject guard). Total: 648 tests

## [0.19.1] - 2026-04-09

### UX
- Auth chip is now a single clickable button — avatar, name, divider, and cloud icon form one unified click target
- Clicking the signed-in chip opens a lightweight popover showing the user's display name, email, and a Sign Out button
- Sign Out from the chip mirrors the Settings → Cloud Storage sign-out handler exactly (signs out of Firebase and resets storage mode to Local)
- Popover dismisses via Escape key, outside click, or Cancel button; dismissal is disabled while sign-out is in flight to prevent inconsistent state
- Signed-out chip remains a single button that navigates to Settings for the sign-in flow
- Removed nested `<button>`/`<Link>` elements inside the chip to comply with accessibility requirements (one chip, one click target)

## [0.19.0] - 2026-04-05

### Legal
- Updated Terms of Service and Privacy Policy to v04-05-2026
- Added SPERT® AHP to list of covered apps
- Updated effective date to April 5, 2026

## [0.18.9] - 2026-04-05

### UX
- Standardized auth chip to Option C split-pill design — matches SPERT Suite convention across all six apps
- Signed-in state now shows 26px avatar circle with first initial, first name only (not full name), vertical divider, and cloud icon linking to Settings
- Local/signed-out state shows lock icon with "Local only" label, vertical divider, and "Sign in" link to Settings
- Suite-standard blue (#0070f3) used for avatar, cloud icon, and sign-in label regardless of app accent color

## [0.18.8] - 2026-04-04

### UX
- Added persistent top bar to all pages — shows storage mode (Local/Cloud) and signed-in user in the upper-right corner, consistent with other SPERT Suite apps
- StorageStatusPill: gray "Local" pill when using local storage; blue pill with user initial and display name when signed into cloud; amber "Sign in" pill when cloud mode is selected but not authenticated — all states link to Settings
- Moved theme toggle (Light/Dark/System) from sidebar bottom to top bar for consistent placement across SPERT Suite apps

### New Components
- StorageStatusPill (src/components/StorageStatusPill.tsx) — three-state storage/auth indicator with reactive mode detection on navigation
- TopBar (src/components/TopBar.tsx) — right-aligned utility bar housing ThemeToggle and StorageStatusPill

## [0.18.7] - 2026-04-03

### UX
- Allocation grid row delete buttons (✕) are now gray by default and turn red on hover, reducing visual clutter

## [0.18.6] - 2026-04-02

### Features
- Added "Export All Projects" button to Dashboard header for quick JSON export without navigating to Settings
- Added localStorage warning banner — amber caution banner on every app load when data is stored locally, session-dismissable via "Got it"
- Added Notifications section in Settings with toggle to permanently suppress the localStorage warning banner

## [0.18.5] - 2026-03-31

### Maintenance
- Updated Terms of Service and Privacy Policy to v03-31-2026
- Updated canonical legal document URLs to spertsuite.com
- Updated consent UI text to SPERT® Suite branding
- Added License footer link (links to GitHub LICENSE file)
- Updated LICENSE project name to SPERT® Suite

## [0.18.4] - 2026-03-16

### UX
- Revised first-run notification wording to clarify that using the app implies agreement to Terms of Service and Privacy Policy

## [0.18.3] - 2026-03-11

### Infrastructure
- Pinned Node.js >=22 LTS in package.json engines field and .nvmrc for deployment readiness before Node 20 EOL
- Aligned @types/node to ^22 to match deployment target

## [0.18.2] - 2026-03-11

### Security
- Added 10 MB file size limit on JSON import to prevent memory exhaustion
- Replaced isNaN() with Number.isFinite() in RateTable, ThresholdSettings, and AllocationGrid to reject Infinity values
- Added min={0} HTML constraint on RateTable number inputs for browser-level enforcement
- Added maxLength={100} on PoolMemberTable edit name input for consistency with add form
- Strengthened date validation to reject syntactically valid but semantically invalid dates (e.g. 9999-99-99)
- Added X-Content-Type-Options, Referrer-Policy, X-Frame-Options, and Permissions-Policy security headers

## [0.18.1] - 2026-03-11

### Refactoring
- Extracted keyboard navigation logic from AllocationGrid into dedicated useGridKeyboard hook for better separation of concerns and testability
- Moved sanitizeCurrency utility from useReforecast hook to shared format.ts module
- Replaced non-null assertion (!) with conditional rendering for AllocationGridAddRow

### Dependencies
- Updated @vitejs/plugin-react to 5.1.4 (patch)
- Updated @types/react to 19.2.14 and @types/node to 24.12.0 (patches)

### Testing
- 626 passing tests across 40 test files (+22 new tests)
- New useGridKeyboard hook tests (17 tests: arrow navigation, Enter/Escape/Tab, Delete, digit entry, boundary clamping, readonly guard)
- New sanitizeCurrency tests (5 tests: finite values, NaN, Infinity, negative, zero)

## [0.18.0] - 2026-03-11

### Legal
- Added Terms of Service and Privacy Policy consent flow
- Footer now includes links to Terms of Service and Privacy Policy
- First-run banner introduces cloud storage consent for new users
- Cloud sign-in gated behind ToS acceptance modal (checkbox required)
- Acceptance recorded in Firestore; returning users skip modal

## [0.17.1] - 2026-03-10

### UX
- Dashboard empty state replaced with a 3-step Getting Started guide — directs new users to (1) review labor rates in Settings, (2) build the Team Pool, (3) create their first project
- Steps show a green checkmark when complete (labor rates reviewed, team members added)

### Bug Fixes
- Fixed role dropdown in Team Pool showing options in light gray text when opened — options now render in normal text color

## [0.17.0] - 2026-03-10

### Actuals Through Date (ETC Cutoff)
- New per-reforecast "Actuals Through Date" field — tells the calc engine where actuals end so ETC excludes already-covered costs
- Pre-cutoff months automatically zeroed (fully covered by actuals)
- Cutoff month prorated — only workdays after the cutoff date contribute to ETC
- Post-cutoff months unchanged
- Charts, cost table, and all derived metrics (EAC, variance, burn rate) automatically reflect the adjusted costs
- Date picker with clear button in ReforecastToolbar alongside existing Reforecast Date
- Field is optional — undefined means no cutoff (identical to prior behavior)
- No data migration needed (DATA_VERSION remains 0.7.0)

### Calculation Engine
- `getEtcStartDate()` helper computes cutoff + 1 calendar day
- `getMonthlyWorkHours()` gains optional `etcStartDate` parameter — additional lower bound on effective start date
- Burn rate now uses cost-based active months instead of allocation-based, naturally excluding pre-cutoff months
- `createNewReforecast()` copies `actualsThroughDate` from source when present

### Testing
- 604 passing tests across 39 test files (+20 new tests)
- New `getEtcStartDate` tests (day+1 logic, month/year boundaries)
- New `getMonthlyWorkHours` tests with `etcStartDate` (pre-cutoff → 0, cutoff → partial, post-cutoff → unchanged, combined with holidays)
- New `calculateProjectMetrics` tests with `actualsThroughDate` (zeroed pre-cutoff, prorated mid-month, burn rate adjustment)
- New `createNewReforecast` tests for `actualsThroughDate` copy behavior

## [0.16.3] - 2026-03-10

### Copyright & Attribution
- Added copyright headers to all 134 source files (TS, TSX, CSS, MJS) with appropriate comment syntax per file type
- Added author attribution block to top of LICENSE file — identifies William W. Davis, MSPM, PMP as original author with repository link
- Appended Section 7 additional terms to LICENSE — attribution preservation and UI notice preservation requirements per GNU GPL v3
- Added Copyright & Attribution Standing Instructions to CLAUDE.md — ensures all future sessions maintain copyright headers on new files

### About Page
- Updated "Your Data & Privacy" section to "Your Data & Storage" — now documents both Local Storage (default) and Cloud Storage (optional) modes, matching the pattern used across the SPERT suite
- Added Import & Export subsection for clearer data portability guidance

## [0.16.2] - 2026-03-10

### Security Hardening
- Removed unsafe-eval from Content Security Policy script-src directive
- Added server-side email format validation in project sharing before Firestore query
- Reduced email enumeration in sharing error messages — no longer reveals whether an email exists in the system
- Updated minimatch (ReDoS fix), rollup (path traversal fix), and ajv (ReDoS fix) to patched versions

## [0.16.1] - 2026-03-10

### Bug Fixes
- Fixed mode switch (local/cloud) not refreshing hooks or setting up cloud sync listeners — all mode switch paths now reload the page to ensure correct data source
- Fixed ensureProfile overwriting createdAt timestamp on every sign-in — now only sets createdAt on first profile creation
- Removed redundant sign-in error AlertDialog (inline error display is sufficient)

### Refactoring
- Extracted shared Firestore collection name constants to src/lib/firebase/collections.ts — eliminates duplication across 4 files
- Extracted pure utility functions (buildTeamSnapshot, stripUndefined, docToProject) from firestoreRepo.ts to src/lib/storage/firestoreUtils.ts for independent testability
- Cleaned up useCloudSync.ts — removed dead beforeunload handler and unnecessary initializedRef guard
- Moved deleteField to static import in sharing.ts for proper tree-shaking

### Testing
- 584 passing tests across 39 test files (+16 tests)
- New test file: firestoreUtils.test.ts — 13 tests for buildTeamSnapshot, stripUndefined, docToProject
- New tests for resolveAssignments teamSnapshot fallback (shared project viewing)

## [0.16.0] - 2026-03-10

### New Feature: Firebase Cloud Storage
- Optional cloud storage via Firebase Firestore — sync data across devices and browsers
- Firebase Authentication with Google and Microsoft SSO sign-in
- Cloud Storage section in Settings — toggle between Local and Cloud modes with one-click migration
- Local-to-cloud migration with upload confirmation, cleanup prompt, and re-upload detection
- Real-time sync via Firestore onSnapshot — changes propagate across browser tabs automatically
- Project sharing — owners can invite editors and viewers by email address
- "Shared" badge on dashboard project cards for projects with multiple members
- Team snapshot embedding — shared project viewers see correct team member names without needing them in their pool

### Architecture
- Delegating repository wrapper — repo.ts forwards calls to active implementation (local or cloud) with zero hook refactoring
- Firestore repository implementing full Repository interface with merge-safe saves and ownership-aware creates
- Cloud sync event bus (cloudSyncBus) for decoupled real-time update propagation
- Echo prevention via hasPendingWrites in onSnapshot listeners
- HMR-safe Firebase initialization with memoryLocalCache
- User-friendly Firebase error mapping (sanitizeFirebaseError)
- Storage mode persistence (msb:storageMode localStorage key)
- Separate createProject vs saveProject — only createProject sets owner/members fields

### New Files
- src/lib/firebase/config.ts — Firebase initialization with HMR guard
- src/lib/firebase/auth.ts — Authentication (Google, Microsoft SSO, profile management)
- src/lib/firebase/errors.ts — Error code to user-friendly message mapping
- src/lib/firebase/cloudSyncBus.ts — Pub/sub event bus for real-time sync
- src/lib/firebase/sharing.ts — Project member management (add/remove by email)
- src/lib/storage/firestoreRepo.ts — Full Firestore Repository implementation
- src/lib/storage/storageMode.ts — Storage mode getter/setter
- src/components/AuthProvider.tsx — React context for Firebase auth state
- src/components/CloudSyncProvider.tsx — Activates onSnapshot listeners
- src/hooks/useCloudSync.ts — Firestore real-time subscription management
- src/features/settings/components/CloudStorageSection.tsx — Cloud storage UI in Settings
- src/features/projects/components/SharingSection.tsx — Project sharing UI
- firestore.rules — Firestore security rules for spert-suite project
- firebase.json — Firebase project configuration

### Bug Prevention
- Incorporated 13 critical bug prevention patterns from 4 completed SPERT suite migrations
- Data-loss guard: empty cloud results never overwrite non-empty local data
- Debounced save cancel() method added alongside existing flush()
- Collision detection during import with try/catch for PERMISSION_DENIED on non-existent docs
- CSP headers updated for Firebase domains (script-src, frame-src, connect-src)

### Testing
- 568 passing tests across 38 test files (+20 tests, +4 test files)
- New test files: sanitizeFirebaseError, cloudSyncBus, storageMode, delegating repo wrapper

## [0.15.2] - 2026-03-09

### Documentation
- Quick Reference Guide — PDF download link added to About page (hosted on GitHub, not bundled with Vercel deployment)

## [0.15.1] - 2026-03-02

### UX Improvements
- Duplicate team member warning — adding a member with the same name shows a confirmation dialog (Cancel / Add Anyway)
- $0/hour labor rates — infrastructure roles that cost nothing to a project can now be added for resource planning
- Allocation grid member dropdown sorted alphabetically by name for faster scanning and type-ahead filtering
- Tighter Team Pool table layout — reduced row spacing and constrained width for better readability on large monitors

## [0.15.0] - 2026-02-22

### Data Integrity
- Hook flush consistency — useSettings and useTeamPool now expose flush(), matching useProject pattern
- Unmount cleanup on all pages with pending saves — Settings, Team Pool, Project Detail, and Edit Project pages flush debounced saves on navigation

### Code Quality
- Decomposed AllocationGrid (701 lines) into 4 focused sub-components: AllocationGridHeader, AllocationGridRow, AllocationGridSummaryRows, AllocationGridAddRow
- Deleted 7 macOS duplicate files ("file 2.ext" artifacts)

### New Features
- Toast notification system — auto-dismissing success/error/info toasts for export, import, bulk holiday add, and project delete operations
- Skeleton loading screens — shimmer placeholders on Dashboard, Project Detail, Edit Project, Team Pool, and Settings pages
- Keyboard shortcuts help modal — press Ctrl+? or click "Keyboard Shortcuts" in sidebar to view all allocation grid and global shortcuts

### New Components & Hooks
- ToastProvider + useToast (src/components/Toast.tsx)
- Skeleton, SkeletonProjectCard, SkeletonProjectDetail (src/components/Skeleton.tsx)
- ShortcutsDialog (src/components/ShortcutsDialog.tsx)
- useKeyboardShortcut (src/hooks/useKeyboardShortcut.ts)
- AllocationGridHeader, AllocationGridRow, AllocationGridSummaryRows, AllocationGridAddRow (src/features/reforecast/components/)

### Testing
- 548 passing tests across 34 test files (+111 tests, +10 test files)
- New component tests: BaseDialog, Toast, Skeleton, ShortcutsDialog, ProjectForm, ReforecastToolbar, AllocationGrid
- New hook tests: useSettings, useTeamPool

## [0.14.0] - 2026-02-20

### New Features
- Export attribution — new section in Settings for attaching name and identifier to JSON exports for team workflow traceability
- Workspace reconciliation tokens — exports include _originRef and _storageRef for cross-session data provenance tracking and localStorage hydration recovery
- Export pipeline diagnostics — dataset maintains a lightweight _changeLog of structural operations for client-side telemetry

### Technical
- New localStorage key msb-workspace-id for deterministic workspace binding
- Workspace utilities in src/lib/storage/fingerprint.ts for identity, changelog, and attribution management
- Import preserves _originRef and _changeLog from source data for provenance chain continuity

## [0.13.0] - 2026-02-03

### Accessibility & UX Polish
- Replaced browser window.confirm() in Holiday Calendar with styled ConfirmDialog
- Replaced browser alert() and confirm() in Data Export/Import with styled dialogs
- Added unique ARIA IDs to BaseDialog for accessibility compliance (useId)
- Added scope="col" to all table headers for screen reader compatibility

### New Components
- AlertDialog — informational dialog for error/success messages (non-destructive variant of ConfirmDialog)

## [0.12.0] - 2026-02-03

### Security Hardening
- Deep validation for imported JSON — validates nested structures (reforecasts, allocations, assignments)
- Type guards in migration functions — throws descriptive errors instead of silent data corruption
- Runtime type validation on localStorage reads with optional validator callbacks
- Storage quota error detection — throws user-friendly error when localStorage is full
- Text input length limits — project names (150), member names (100), holiday names (100), role names (50)

### Codebase Improvements
- New validation utility module (src/lib/utils/validation.ts)
- StorageQuotaError class for explicit quota handling
- Theme init script documented with STORAGE_KEYS reference
- 437 passing tests across 24 test files

## [0.11.0] - 2026-02-02

### Dark Mode Toggle
- Three-state theme toggle (Light / Dark / System) in sidebar
- Theme preference persisted in localStorage
- No flash of wrong theme on page load (blocking script in <head>)
- Tailwind v4 class-based dark mode via @custom-variant directive
- System preference mode tracks OS changes in real time

### Allocation Grid UX
- One-click add member — select from dropdown to immediately add (no extra "Add" button)
- Enter/Return in edit mode saves value and moves cursor down with wrap-around

### US Federal Holidays
- Bulk-add US Federal Holidays for 2026, 2027, 2028 (11 holidays per year)
- Observed date rules (weekend → nearest weekday)
- Duplicate detection skips already-added holidays

### Bug Fixes
- Fixed ThemeToggle SSR hydration mismatch (mounted guard in useTheme)
- Fixed useDarkMode returning true when user chose light mode but OS was dark
- Fixed RateTable using array index as React key (editing wrong row after deletion)
- Fixed reorderAssignments unsafe non-null assertion
- Fixed SettingsForm discount rate missing upper bound validation

### Refactoring
- Extracted shared date formatters (formatDateSlash, formatDateLong, formatDateMedium) to format.ts
- Extracted shared chart colors (getChartColors) to svg-utils.ts
- Extracted changelog data to changelogData.ts (page dropped from 424 to 63 lines)
- ProductivityWindowPanel now uses shared CollapsibleSection

### Housekeeping
- Deleted 4 stale duplicate files (macOS " 2" copies)
- 437 passing tests across 24 test files

## [0.10.0] - 2026-02-02

### Dependencies
- Updated react and react-dom from 19.2.3 to 19.2.4
- Updated @vitejs/plugin-react from 5.1.2 to 5.1.3
- Updated @types/node from ^20 to ^24 (matching Node.js 24 LTS runtime)
- Updated jsdom from ^27.4.0 to ^28.0.0
- Cleaned up extraneous native addon packages
- All dependencies at latest stable versions for JFrog vulnerability scan compliance

### Testing
- 387 passing tests across 21 test files (unchanged)

## [0.9.0] - 2026-02-01

### Traffic-Light Dashboard
- Three-state traffic-light status on dashboard project tiles (Green/Amber/Red)
- Status derived from variance percentage against configurable thresholds
- Colored EAC value with status indicator and text label ("On Track" / "At Risk" / "Over Budget")
- Traffic-light thresholds configurable in Settings > Dashboard Thresholds
- Traffic-light coloring applied to EAC on project detail page summary bar

### Refactoring
- Consolidated 3 delete dialogs into a single reusable ConfirmDialog component
- Extracted drag-to-reorder logic into a generic useDragReorder hook
- Extracted collapsible section pattern into a shared CollapsibleSection component
- Removed dashboard arrow-key reorder buttons (drag handles are sufficient)
- Sticky sidebar navigation on desktop

### Architecture
- TrafficLightThresholds type added to Settings with data migration v0.7.0
- Pure getTrafficLightStatus() and getTrafficLightDisplay() calculation functions
- Deleted 3 redundant dialog components and 2 stale untracked files

### Testing
- Traffic-light status and display tests
- Holiday subtraction and productivity window integration tests for calculateProjectMetrics
- generateId utility tests
- 387 passing tests across 21 test files

## [0.8.0] - 2026-01-31

### Holiday Calendar
- Global holiday calendar in Settings — non-work days subtracted from workday calculations
- Holiday CRUD table with inline editing, delete confirmation, and date auto-fill
- Collapsible Settings sections (Labor Rates, Holiday Calendar) with chevron toggle and count badges

### Allocation Grid
- Sortable "Team Member" column header (cycles None → Name A→Z → Role→Name)
- Inline drag handles (⠹) for manual row reorder
- Sticky name column with z-index layering for cell selection outlines

### UX
- Reforecast dropdown widened with min-w-48
- Form input UX polish: placeholder styling, submit guard, numeric clearing

## [0.7.0] - 2026-01-30

### Architecture
- Moved Baseline Budget from project-level into each Reforecast for per-snapshot budget tracking
- Added Reforecast Date — user-editable date recording when the reforecast was prepared
- Data migration v0.5.0 moves baselineBudget into all reforecasts, derives reforecastDate from createdAt
- Dashboard project tiles now show metrics from the most-recent reforecast (by date)
- New getMostRecentReforecast() helper with date sort and createdAt tie-breaking

### UX
- Baseline Budget is now inline-editable in the project summary bar (click to edit)
- Reforecast Date picker appears alongside the reforecast dropdown in the toolbar
- Switching reforecasts updates Baseline Budget, variance, budget ratio, and chart budget line
- Creating a reforecast copies the source budget; date always defaults to today

## [0.6.0] - 2026-01-30

### Architecture
- Moved Actual Cost from project-level into each Reforecast for point-in-time cost snapshots
- Data migration v0.4.0 moves existing actualCost into the active reforecast
- Every new project auto-creates a Baseline reforecast with $0 actual cost
- Projects without reforecasts receive a synthetic Baseline during migration

### UX
- Actual Cost is now inline-editable in the project summary bar (click to edit)
- Switching reforecasts updates Actual Cost, EAC, charts, and cost table
- Removed Actual Cost from the project create/edit form
- Creating a reforecast from an existing one copies its Actual Cost

## [0.5.0] - 2026-01-29

### Calculation Engine
- Replaced fixed "Working Hours per Month" setting with workday-based calculation engine
- Available hours now derived from actual weekdays (Mon-Fri) in each month, multiplied by 8 hours/day
- Partial first/last months clipped to project start/end dates for accurate cost calculation
- A 2-day project now correctly calculates 16 hours instead of 160
- Removed "Working Hours per Month" input from Settings page

### UX
- Confirmation dialog for team member removal from allocation grid (prevents accidental data loss)
- Empty team pool now shows link to Team Pool page instead of dead-end dropdown
- Consistent add-member experience in allocation grid (always uses grid table row)

### Architecture
- Data migration v0.3.0 strips deprecated `hoursPerMonth` from stored settings
- New `countWorkdays()` and `getMonthlyWorkHours()` date utilities
- `HOURS_PER_DAY = 8` constant replaces configurable `hoursPerMonth` setting

### Testing
- New workday utility tests (countWorkdays, getMonthlyWorkHours)
- Recomputed all golden-file regression test values for workday-based engine
- 224 passing tests across 16 test files

## [0.4.0] - 2026-01-29

### Bug Fixes
- Last reforecast deletion guard — prevents deleting the only reforecast
- Negative budget/actual cost validation with 3-layer protection (HTML, JS clamp, submit)
- Import now runs data migrations before persisting (fixes stale-format imports)
- Fixed empty-state early return hiding the "+ Add member" control in allocation grid

### Accessibility
- Skip-to-content keyboard link (hidden until Tab-focused)
- Color-only information remediation — Unicode indicators and text labels on variance, ratio, and EAC
- Keyboard-accessible project reordering (move up/down buttons alongside drag handle)

### UI/UX
- Mobile-responsive sidebar navigation with hamburger menu
- Empty states with dashed borders and hint text across allocation grid, team pool, and metrics panel
- Confirmation dialog for reforecast deletion (replaces inline Yes/No)

### Testing
- Edge-case tests: zero-budget projects, single-month projects, orphaned assignments, productivity windows
- Import/export round-trip and migration-on-import tests
- 204 passing tests across 15 test files

## [0.3.0] - 2026-01-29

### Reforecasts
- Create, switch, and delete reforecasts for any project
- Copy allocations from a prior reforecast when creating a new one
- Default copy-from selection is the most recently added reforecast

### Productivity Windows
- Define date-ranged productivity factors that adjust hours and cost
- Day-weighted blending for months that span window boundaries
- Productivity is a calculation overlay — stored allocations are never mutated

### Dashboard & UX
- Drag-to-reorder project tiles on the Dashboard
- Auto-focus project name field on New Project form
- End date calendar defaults to start date + 1 business day
- Currency fields display formatted values ($327,160) and switch to raw input on edit
- Team Pool: add-member form moved above the member list, sorting by name or role

### Charts & Metrics
- Cumulative cost chart now includes actual cost (EAC trajectory)
- ETC (Estimate to Complete) added to project summary bar

### Bug Fixes
- Fixed stale data when navigating away from project edit (debounced save flush)
- Fixed productivity factor day-weighted blending calculation

## [0.2.0] - 2026-01-29

### Global Team Pool
- Centralized team member management at /team with add, edit, and delete
- In-use guard prevents deleting team members assigned to projects
- Project assignments via pool picker in the allocation grid

### Calculation Engine
- Full calculation engine: ETC, EAC, variance, budget ratio, burn rate, NPV
- Golden-file spreadsheet parity tests ensuring math matches the original Excel

### Charts
- SVG monthly cost bar chart
- SVG cumulative cost line chart

### Architecture
- Data migration system with MigrationGuard component
- Repository pattern with async interface for future backend support
- Debounced save hook for responsive UI with batched persistence

## [0.1.0] - 2026-01-28

### Initial Release
- Settings page with labor rates, hours/month, and discount rate configuration
- JSON export/import for data portability
- Project CRUD with dashboard and project detail pages
- Allocation grid with inline editing, multi-cell selection, and drag-to-fill
- Dark mode support
- localStorage-based persistence
