import Link from 'next/link';
import { APP_VERSION } from '@/lib/constants';

interface ChangelogEntry {
  version: string;
  date: string;
  sections: {
    title: string;
    items: string[];
  }[];
}

const CHANGELOG: ChangelogEntry[] = [
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
          'Last reforecast deletion guard — prevents deleting the only reforecast',
          'Negative budget/actual cost validation with 3-layer protection (HTML, JS clamp, submit)',
          'Import now runs data migrations before persisting (fixes stale-format imports)',
          'Fixed empty-state early return hiding the "+ Add member" control in allocation grid',
        ],
      },
      {
        title: 'Accessibility',
        items: [
          'Skip-to-content keyboard link (hidden until Tab-focused)',
          'Color-only information remediation — Unicode indicators (\u25B2/\u25BC) and text labels on variance, ratio, and EAC',
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
          'Productivity is a calculation overlay — stored allocations are never mutated',
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

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-bold">Changelog</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Current version: {APP_VERSION}
      </p>

      <div className="mt-8 space-y-10">
        {CHANGELOG.map((entry, i) => (
          <div
            key={entry.version}
            className={`pb-8 ${
              i < CHANGELOG.length - 1
                ? 'border-b border-zinc-200 dark:border-zinc-800'
                : ''
            }`}
          >
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                v{entry.version}
              </h2>
              <span className="text-sm text-zinc-400 dark:text-zinc-500">
                {formatDate(entry.date)}
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {entry.sections.map((section) => (
                <div key={section.title}>
                  <h3 className="font-medium">{section.title}</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-6 text-sm text-zinc-600 dark:text-zinc-400">
                    {section.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
