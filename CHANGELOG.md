# Changelog

All notable changes to MyScrumBudget are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
