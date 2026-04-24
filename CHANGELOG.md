# Changelog

All notable changes to MyScrumBudget are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
