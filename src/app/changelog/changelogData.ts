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
