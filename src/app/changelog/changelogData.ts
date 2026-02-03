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
