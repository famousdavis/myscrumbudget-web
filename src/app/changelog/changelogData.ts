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
