# Changelog

All notable changes to MyScrumBudget are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
