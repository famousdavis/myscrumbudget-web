# MyScrumBudget Web App - Architecture Document

## Part 1: Spreadsheet Analysis Summary

### Source File Overview
- **File**: MyScrumBudget_1.5.xlsx (GPL-licensed by William W. Davis)
- **Key Worksheets**: 
  - `MyScrumBudget™` — Main calculations (336 rows × 48 columns)
  - `Vlookups` — Labor rates and constants

### Computational Model

#### Inputs
| Input | Location | Type | Description |
|-------|----------|------|-------------|
| Start Date | E2 | Date | Project start date |
| Finish Date | E3 | Date | Project end date (informational) |
| Discount Rate | E4 | Decimal | Annual rate for NPV calculation (default 3%) |
| Actual Cost (AC) | K2 | Currency | Historical spend to date |
| Hours/Month | Vlookups!A16 | Integer | Working hours per month (160) |
| Rate Table | Vlookups!A4:B9 | Table | Role → Hourly Rate mapping |
| Team Members | Rows 8-107 | Table | Name, Role, Core/Ext per member |
| Allocations | D8:AN107 | Grid | % allocation per person per month |

#### Rate Table (Vlookups!A4:B9)
| Role | Hourly Rate |
|------|-------------|
| BA | $75 |
| IT-SoftEng | $100 |
| IT-Security | $90 |
| IT-DevOps | $80 |
| Manager | $150 |
| PMO | $120 |

#### Core Formulas

**1. Hourly Rate Lookup (Column AP)**
```
=IFNA(VLOOKUP(B8, Vlookups!$A$4:$B$9, 2, FALSE), "")
```
Maps each team member's role to their hourly rate.

**2. Monthly Cost per Person (Rows 113-212)**
```
=IFERROR($AP8 * Vlookups!$A$16 * D8, "")
```
`cost = hourly_rate × hours_per_month × allocation_percentage`

Example: Aaliyah (BA, $75/hr) at 25% allocation = 75 × 160 × 0.25 = $3,000/month

**3. Monthly Hours per Person (Rows 215-314)**
```
=IFERROR(D8 * Vlookups!$A$16, "")
```
`hours = allocation_percentage × hours_per_month`

**4. Monthly Cost Totals (Row 213)**
```
=SUM(D113:D212)
```
Sum of all person-costs for each month.

**5. Cumulative Cost (Row 214)**
```
=D213           (first month)
=E213 + D214    (subsequent months)
```
Running total of costs.

**6. Monthly Hours Totals (Row 315)**
```
=SUM(D215:D314)
```

**7. Cumulative Hours (Row 316)**
```
=D315           (first month)
=E315 + D316    (subsequent months)
```

**8. Month Activity Indicator (Row 317)**
```
=IF(SUM(D8:D107) > 0, 1, 0)
```
1 if any allocation exists in month, 0 otherwise.

#### Key Outputs

**Estimate to Complete (ETC) - K3**
```
=SUM(D113:AN212)
```
Total remaining forecasted cost across all months and team members.

**Estimate at Completion (EAC) - K4**
```
=K2 + K3
```
`EAC = Actual_Cost + ETC`

**Average Weekly Burn Rate - P2**
```
=K3 / ROUND(DATEDIF(E2, TEXT(EDATE(E2, MAX(SUM(D317:AN317),1)), "MM/DD/YYYY"), "d") / 7, 0)
```
`burn_rate = ETC / weeks_to_last_active_month`

**Note:** Burn rate uses the last month with allocations, not the project end date.

**Net Present Value (NPV) - P3**
```
=NPV(E4, D213:AN213)
```
Discounted value of future monthly costs.

**Note:** The spreadsheet passes the rate directly to Excel's NPV function with monthly cash flows. We intentionally diverge to treat the stored rate as annual and convert to monthly internally (see Part 8).

**Total Labor Hours - P4**
```
=SUM(D111:AN111)
```

#### Display Calculations (Rows 109-112)
These are display-friendly versions (in thousands):
- Row 109: Monthly cost / 1000
- Row 110: Cumulative cost / 1000  
- Row 111: Monthly hours
- Row 112: Cumulative hours

---

## Part 2: Domain Model Translation

### Core Entities

```typescript
// Labor Rates (Global Settings)
interface LaborRate {
  role: string;           // e.g., "BA", "IT-SoftEng"
  hourlyRate: number;     // dollars per hour
}

// Holiday (Global Settings — non-work days subtracted from workday calculations)
interface Holiday {
  id: string;
  name: string;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD (same as startDate for single-day holidays)
}

interface Settings {
  discountRateAnnual: number;   // annual rate, default 0.03 (3%)
  laborRates: LaborRate[];
  holidays: Holiday[];          // non-work days subtracted from workday calcs (v0.8.0)
}

// Global Team Member Pool — stored once, referenced by projects
interface PoolMember {
  id: string;
  name: string;
  role: string;           // must match a LaborRate.role
}

// Links a pool member into a project (one per allocation row)
interface ProjectAssignment {
  id: string;             // unique — MonthlyAllocation.memberId references this
  poolMemberId: string;   // references PoolMember.id
}

// Resolved Team Member — produced by joining ProjectAssignment + PoolMember.
// Used by calc engine, AllocationGrid, and charts.
interface TeamMember {
  id: string;             // assignment id (for allocation lookups)
  name: string;
  role: string;
}

// Monthly Allocation (user intent - never modified by productivity)
interface MonthlyAllocation {
  memberId: string;       // references ProjectAssignment.id
  month: string;          // ISO date (YYYY-MM)
  allocation: number;     // 0.0 to 1.0 (percentage as decimal)
}

// Productivity Window (web app enhancement - applied at calculation time only)
interface ProductivityWindow {
  id: string;
  startDate: string;      // ISO date
  endDate: string;        // ISO date
  factor: number;         // 0.0 to 1.0 (100% = full productivity)
}

// Reforecast Snapshot
interface Reforecast {
  id: string;
  name: string;
  createdAt: string;        // ISO datetime
  startDate: string;        // forecast start month
  reforecastDate: string;   // ISO date (YYYY-MM-DD) — when this reforecast was prepared (v0.7.0)
  allocations: MonthlyAllocation[];
  productivityWindows: ProductivityWindow[];
  actualCost: number;       // per-reforecast actual cost (v0.6.0)
  baselineBudget: number;   // per-reforecast baseline budget (v0.7.0)
}

// Project
interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  // baselineBudget removed in v0.7.0 — now lives in Reforecast
  assignments: ProjectAssignment[];
  reforecasts: Reforecast[];
  activeReforecastId: string | null;
}
```

### Calculated Values

```typescript
interface MonthlyCalculation {
  month: string;
  cost: number;
  hours: number;
  cumulativeCost: number;
  cumulativeHours: number;
}

interface ProjectMetrics {
  etc: number;              // Estimate to Complete
  eac: number;              // Estimate at Completion
  variance: number;         // EAC - Baseline
  variancePercent: number;
  budgetRatio: number;      // Baseline / EAC (see note below)
  weeklyBurnRate: number;
  npv: number;
  totalHours: number;
  monthlyData: MonthlyCalculation[];
}
```

### Metrics Glossary

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| ETC | Sum of forecasted costs | Remaining spend |
| EAC | AC + ETC | Total expected spend |
| Variance | EAC - Baseline | Over/under budget ($) |
| Budget Ratio | Baseline / EAC | >1 = under budget, <1 = over |

**Note:** This tool does not implement full Earned Value Management (EVM). 
There is no earned value tracking or CPI/SPI in the traditional sense. 
The "Budget Ratio" compares your forecast to your baseline, not earned value to actual cost.

### Productivity Windows

Productivity windows apply a multiplier (0-100%) to a date range. 
This uniformly reduces both **hours** and **cost** for affected months.

Use cases:
- Holiday periods (e.g., December at 50%)
- Onboarding ramp-up (e.g., first month at 25%)
- Part-time availability windows

**Important:** Productivity affects the *effective* output at calculation time, not the stored allocations. Allocations always represent user intent.

### Discount Rate

The discount rate is stored as an **annual** rate (e.g., 0.03 = 3% per year).
NPV calculation converts this to a monthly rate internally (annual / 12).

Note: The original spreadsheet passes the rate directly to Excel's NPV function
with monthly cash flows, which technically applies it per-period. We intentionally
diverge to use standard annual rate semantics.

---

## Part 3: JSON Schema & LocalStorage Keys

### LocalStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `msb:settings` | Settings | Global app settings |
| `msb:teamPool` | PoolMember[] | Global team member pool |
| `msb:projects` | Project[] | All projects |
| `msb:version` | string | Data schema version for migrations |

### JSON Schema

```typescript
// Full application state
interface AppState {
  version: string;        // Schema version (e.g., "0.6.0")
  settings: Settings;
  teamPool: PoolMember[];
  projects: Project[];
}

// Example stored data
const exampleState: AppState = {
  version: "0.6.0",
  settings: {
    discountRateAnnual: 0.03,
    laborRates: [
      { role: "BA", hourlyRate: 75 },
      { role: "IT-SoftEng", hourlyRate: 100 },
      { role: "IT-Security", hourlyRate: 90 },
      { role: "IT-DevOps", hourlyRate: 80 },
      { role: "Manager", hourlyRate: 150 },
      { role: "PMO", hourlyRate: 120 }
    ],
    holidays: [
      { id: "hol_001", name: "Memorial Day", startDate: "2026-05-25", endDate: "2026-05-25" }
    ]
  },
  teamPool: [
    { id: "tm_001", name: "Aaliyah", role: "BA" },
    { id: "tm_002", name: "Ethan", role: "IT-SoftEng" }
  ],
  projects: [{
    id: "proj_001",
    name: "Alpha Project",
    startDate: "2026-06-15",
    endDate: "2027-07-15",
    // baselineBudget removed — now lives in Reforecast
    assignments: [
      { id: "tm_001", poolMemberId: "tm_001" },
      { id: "tm_002", poolMemberId: "tm_002" }
    ],
    reforecasts: [{
      id: "rf_001",
      name: "Q3 2026 Reforecast",
      createdAt: "2026-07-01T10:00:00Z",
      startDate: "2026-06",
      reforecastDate: "2026-07-01",
      allocations: [
        { memberId: "tm_001", month: "2026-06", allocation: 0.25 },
        { memberId: "tm_001", month: "2026-07", allocation: 0.50 },
        { memberId: "tm_002", month: "2026-06", allocation: 0.40 }
      ],
      productivityWindows: [],
      actualCost: 200000,
      baselineBudget: 1000000
    }],
    activeReforecastId: "rf_001"
  }]
};
```

---

## Part 4: Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER (Client)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Next.js App Router                              │ │
│  │                                                                         │ │
│  │   /                    → Dashboard (project list, summary)              │ │
│  │   /projects/[id]       → Project detail + reforecast view               │ │
│  │   /projects/[id]/edit  → Edit project metadata                          │ │
│  │   /team                → Global team member pool management             │ │
│  │   /settings            → Global settings (rates, hours/month)           │ │
│  │   /about               → About page                                    │ │
│  │   /changelog           → Version changelog                             │ │
│  │                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         Feature Modules                                  ││
│  │                                                                          ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ ││
│  │  │   projects/  │  │  reforecast/ │  │   settings/  │  │    team/    │ ││
│  │  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├─────────────┤ ││
│  │  │ components/  │  │ components/  │  │ components/  │  │ components/ │ ││
│  │  │ hooks/       │  │ hooks/       │  │ hooks/       │  │ hooks/      │ ││
│  │  │ types.ts     │  │ types.ts     │  │ types.ts     │  │ types.ts    │ ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                          Shared Layer                                    ││
│  │                                                                          ││
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────────┐  ││
│  │  │   lib/calc/     │  │   lib/storage/   │  │    components/         │  ││
│  │  ├─────────────────┤  ├──────────────────┤  ├────────────────────────┤  ││
│  │  │ costs.ts        │  │ repository.ts    │  │ MigrationGuard.tsx     │  ││
│  │  │ metrics.ts      │  │ localStorage.ts  │  │ charts/                │  ││
│  │  │ npv.ts          │  │ migrations.ts    │  │   MonthlyCostBarChart  │  ││
│  │  │ productivity.ts │  │ repo.ts (singl.) │  │   CumulativeCostLine   │  ││
│  │  │ allocationMap.ts│  │ types.ts         │  │   ChartTooltip         │  ││
│  │  │ index.ts        │  │                  │  │   svg-utils.ts         │  ││
│  │  └─────────────────┘  └──────────────────┘  └────────────────────────┘  ││
│  │                                                                          ││
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────────┐  ││
│  │  │    lib/utils/   │  │     types/       │  │     hooks/             │  ││
│  │  ├─────────────────┤  ├──────────────────┤  ├────────────────────────┤  ││
│  │  │ dates.ts        │  │ domain.ts        │  │ useDebouncedSave.ts    │  ││
│  │  │ format.ts       │  │ storage.ts       │  │ useDarkMode.ts         │  ││
│  │  │ id.ts           │  │                  │  │                        │  ││
│  │  │ teamResolution  │  │                  │  │                        │  ││
│  │  └─────────────────┘  └──────────────────┘  └────────────────────────┘  ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         LocalStorage                                     ││
│  │                                                                          ││
│  │    msb:settings    msb:teamPool    msb:projects    msb:version          ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

                              Future Extensions
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
┌───────────────┐          ┌─────────────────┐          ┌─────────────────┐
│   IndexedDB   │          │  XLSX Import    │          │  Backend API    │
│   Adapter     │          │  (timecards)    │          │  Adapter        │
└───────────────┘          └─────────────────┘          └─────────────────┘
```

---

## Part 5: Feature-Based Folder Layout

```
src/
├── app/                              # Next.js App Router
│   ├── layout.tsx                   # Root layout (nav + MigrationGuard)
│   ├── page.tsx                     # Dashboard (project list)
│   ├── projects/
│   │   ├── [id]/
│   │   │   ├── page.tsx             # Project detail + allocation grid + charts
│   │   │   └── edit/
│   │   │       └── page.tsx         # Edit project metadata
│   │   └── new/
│   │       └── page.tsx             # Create project
│   ├── team/
│   │   └── page.tsx                 # Global team pool management
│   ├── settings/
│   │   └── page.tsx                 # Global settings
│   ├── about/
│   │   └── page.tsx                 # About page
│   └── changelog/
│       └── page.tsx                 # Version changelog
│
├── features/                         # Feature modules
│   ├── projects/
│   │   ├── components/
│   │   │   ├── ProjectCard.tsx      # Dashboard project card
│   │   │   ├── ProjectForm.tsx      # Create/edit form
│   │   │   ├── ProjectSummary.tsx   # Metrics summary in project detail
│   │   │   ├── ForecastMetricsPanel.tsx  # ETC/EAC/variance display
│   │   │   └── DeleteProjectDialog.tsx
│   │   ├── hooks/
│   │   │   ├── useProjects.ts       # Project list CRUD
│   │   │   ├── useProject.ts        # Single project with debounced save
│   │   │   └── useProjectMetrics.ts # Calculation hook (resolves assignments)
│   │   └── __tests__/
│   │       └── projects.test.ts
│   │
│   ├── reforecast/
│   │   ├── components/
│   │   │   ├── AllocationGrid.tsx   # Spreadsheet-like allocation grid (sort, drag reorder, sticky columns)
│   │   │   ├── ReforecastToolbar.tsx # Reforecast switcher + create/delete
│   │   │   └── DeleteReforecastDialog.tsx  # Confirmation dialog
│   │   ├── hooks/
│   │   │   └── useReforecast.ts     # Reforecast CRUD + allocation management
│   │   └── lib/
│   │       └── gridHelpers.ts       # Pure helpers for grid selection/fill/colors
│   │
│   ├── team/
│   │   ├── components/
│   │   │   ├── AddPoolMemberForm.tsx  # Add member to global pool
│   │   │   ├── PoolMemberTable.tsx    # Pool member list with edit/delete
│   │   │   └── RoleSelect.tsx         # Role dropdown
│   │   ├── hooks/
│   │   │   ├── useTeam.ts            # Project-level assignment management (sort, reorder)
│   │   │   └── useTeamPool.ts        # Global pool CRUD with in-use guard
│   │   └── __tests__/
│   │       └── team.test.ts
│   │
│   └── settings/
│       ├── components/
│       │   ├── RateTable.tsx          # Labor rate editor (collapsible)
│       │   ├── HolidayTable.tsx       # Holiday calendar editor (collapsible)
│       │   ├── SettingsForm.tsx       # Discount rate
│       │   └── DataPortability.tsx    # JSON export/import
│       └── hooks/
│           └── useSettings.ts
│
├── lib/                              # Shared utilities
│   ├── calc/                         # Pure calculation functions
│   │   ├── costs.ts                 # Cost calculations
│   │   ├── metrics.ts               # EAC, ETC, budget ratio, burn rate
│   │   ├── npv.ts                   # NPV (annual → monthly conversion)
│   │   ├── productivity.ts          # Productivity factor lookup
│   │   ├── allocationMap.ts         # Pre-aggregated allocation map
│   │   ├── index.ts                 # Re-exports (calculateProjectMetrics)
│   │   └── __tests__/
│   │       ├── costs.test.ts
│   │       ├── metrics.test.ts
│   │       ├── npv.test.ts
│   │       ├── productivity.test.ts
│   │       ├── allocationMap.test.ts
│   │       ├── spreadsheet-parity.test.ts  # Golden-file tests
│   │       ├── edge-cases.test.ts         # Zero-budget, orphaned, single-month
│   │       └── fixtures/
│   │           └── spreadsheet-1.5.ts
│   │
│   ├── storage/                      # Persistence layer
│   │   ├── repository.ts            # Abstract interface
│   │   ├── localStorage.ts          # LocalStorage implementation
│   │   ├── repo.ts                  # Shared singleton instance
│   │   ├── migrations.ts            # Version migrations (v1→v0.2.0)
│   │   └── __tests__/
│   │       ├── localStorage.test.ts
│   │       └── migrations.test.ts
│   │
│   ├── utils/
│   │   ├── dates.ts                 # Date/month manipulation
│   │   ├── format.ts                # Number/currency formatting
│   │   ├── id.ts                    # ID generation
│   │   ├── teamResolution.ts        # resolveAssignments, getActiveReforecast
│   │   └── __tests__/
│   │       ├── teamResolution.test.ts
│   │       ├── holidays.test.ts       # countHolidayWorkdays tests
│   │       └── dates.test.ts          # Workday and holiday-aware tests
│   └── constants.ts                 # App version, name, description
│
├── components/                       # Shared components
│   ├── MigrationGuard.tsx           # Runs migrations before rendering
│   ├── Sidebar.tsx                  # Mobile-responsive nav sidebar
│   ├── Footer.tsx                   # App footer (version, copyright, GPL)
│   ├── CostByPeriodTable.tsx        # Annual cost breakout table
│   └── charts/
│       ├── MonthlyCostBarChart.tsx   # SVG bar chart
│       ├── CumulativeCostLineChart.tsx  # SVG line chart
│       ├── ChartTooltip.tsx          # Hover tooltip
│       ├── svg-utils.ts             # Chart math utilities
│       └── __tests__/
│           └── svg-utils.test.ts
│
├── hooks/                            # Shared hooks
│   ├── useDebouncedSave.ts          # Generic debounced persistence
│   └── useDarkMode.ts               # Dark mode toggle
│
├── types/
│   ├── domain.ts                    # Core domain types
│   └── storage.ts                   # LocalStorage key constants
│
├── test/
│   └── setup.ts                     # Vitest setup (jsdom localStorage mock)
│
└── styles/
    └── globals.css                  # Tailwind + custom styles
```

---

## Part 6: MVP Feature List

### Phase 1: Core Data & Settings (Sprint 1 — DONE)
- [x] Global settings management (hours/month, discount rate)
- [x] Labor rate table CRUD
- [x] LocalStorage persistence with migration support
- [x] Data export/import (JSON)

### Phase 2: Projects (Sprint 2 — DONE)
- [x] Create/edit/delete projects
- [x] Project metadata (name, dates, baseline budget, actual cost)
- [x] Project list dashboard

### Phase 3: Team Management (Sprint 3 — DONE)
- [x] Global team member pool (add/edit/remove on /team page)
- [x] Project assignments via pool picker in allocation grid
- [x] Role assignment with rate lookup
- [x] Same pool member can be added to a project multiple times
- [x] Pool member edits sync across all projects
- [x] Deletion blocked if pool member is in use

### Phase 4: Forecasting (Sprint 3 — DONE)
- [x] Monthly allocation grid (spreadsheet-like)
- [x] Inline cell editing (double-click or type)
- [x] Multi-cell selection (click-drag, shift-click)
- [x] Excel-like drag-to-fill handle
- [x] Auto-calculation of costs and hours (summary rows)
- [x] Sortable "Team Member" column header (cycles: None → Name A→Z → Role→Name → None; persists order)
- [x] Drag-to-reorder team member rows via inline grip handle (⠿)
- [x] Sticky name column (frozen pane) with z-index layering for selected cell outlines

### Phase 5: Metrics & Calculations (Sprint 4 — DONE)
- [x] ETC, EAC calculations
- [x] Variance vs baseline
- [x] Budget ratio calculation
- [x] Weekly burn rate (based on active months)
- [x] NPV calculation (annual rate converted to monthly)
- [x] Golden-file spreadsheet parity tests (157 tests)

### Phase 6: Visualization (Sprint 5 — DONE)
- [x] Monthly cost bar chart (SVG)
- [x] Cumulative cost line chart (SVG)
- [x] Chart tooltips with formatted values
- [x] Summary rows in allocation grid (monthly cost + hours)

### Phase 7: Reforecast Snapshots (Sprint 6 — DONE)
- [x] Create named reforecasts
- [x] Switch between reforecasts
- [x] Copy allocation from previous reforecast

### Phase 8: Productivity Windows (Sprint 7 — DONE)
- [x] Define productivity limitation periods
- [x] Apply factor to affected months (both hours and cost)
- [x] Visual indication on allocation grid
- [x] Keyboard navigation for allocation grid
- [x] README with domain glossary

### Phase 9: UX Polish & Branding (Sprint 8 — DONE)
- [x] Footer with copyright, version link, GPL notice
- [x] About page with app description, author, GitHub link, privacy
- [x] Changelog page with versioned release history
- [x] TM trademark branding on MyScrumBudget name
- [x] Cost-by-Period table (annual spend breakout below charts)
- [x] Dashboard drag-to-reorder project tiles
- [x] Team pool table sort by name
- [x] Currency formatting in project form (click-to-edit)
- [x] Auto-set end date from start date (nextBusinessDay)
- [x] Cumulative cost chart includes actual cost offset
- [x] ETC displayed in project summary bar
- [x] Default copy-from forecast to most recent reforecast
- [x] Debounced save flush on unmount (prevents stale data)
- [x] Codebase refactoring (deduplication, shared utilities)
- [x] 190 passing tests across 14 test files

### Phase 10: Bug Fixes, Accessibility & UX (Sprint 9 — DONE)
- [x] Last reforecast deletion guard (prevents deleting the only reforecast)
- [x] Negative budget/actual cost validation (HTML min, JS clamp, submit-time check)
- [x] Import runs migrations before persisting (DataPortability uses runMigrations)
- [x] Mobile navigation sidebar with hamburger menu (responsive, md: breakpoint)
- [x] Empty states with dashed borders and hint text (AllocationGrid, PoolMemberTable, ForecastMetricsPanel)
- [x] Confirmation dialog for reforecast deletion (DeleteReforecastDialog)
- [x] Color-only information remediation (Unicode indicators + text labels on variance/ratio/EAC)
- [x] Skip-to-content link (keyboard-accessible, hidden until focused)
- [x] Drag-to-reorder keyboard alternative (move up/down buttons on project cards)
- [x] Edge case tests (zero-budget, single-month, orphaned assignments, productivity windows, import round-trip)
- [x] 204 passing tests across 15 test files

### Phase 11: Workday-Based Calculation Engine (Sprint 10 — DONE)
- [x] Replaced fixed `hoursPerMonth` setting with workday-based calculation (Mon-Fri × 8 hrs/day)
- [x] Partial first/last months clipped to project start/end dates
- [x] Removed "Working Hours per Month" input from Settings page
- [x] Data migration v0.3.0 strips `hoursPerMonth` from stored settings
- [x] New `countWorkdays()` and `getMonthlyWorkHours()` date utilities
- [x] Confirmation dialog for team member removal from allocation grid
- [x] Empty pool shows link to Team Pool page instead of dead-end dropdown
- [x] Consistent add-member UX (always uses grid table row)
- [x] Recomputed golden-file regression test values for workday-based engine
- [x] 224 passing tests across 16 test files

### Phase 12: Per-Reforecast Actual Cost (Sprint 11 — DONE)
- [x] Moved `actualCost` from `Project` into each `Reforecast` for point-in-time cost snapshots
- [x] Data migration v0.4.0 moves existing actualCost to active reforecast, creates Baseline for projects without reforecasts
- [x] Inline-editable Actual Cost in project summary bar (click-to-edit)
- [x] Switching reforecasts updates Actual Cost, EAC, charts, and cost table
- [x] Creating a reforecast from an existing one copies its actualCost
- [x] Removed Actual Cost from project create/edit form
- [x] Every new project auto-creates a Baseline reforecast with $0 actual cost

### Phase 13: Per-Reforecast Budget + Reforecast Date (Sprint 12 — DONE)
- [x] Moved `baselineBudget` from `Project` into each `Reforecast` for per-snapshot budget tracking
- [x] Added `reforecastDate` (user-editable, defaults to today) to record when the reforecast was prepared
- [x] Data migration v0.5.0 copies baselineBudget into all reforecasts, derives reforecastDate from createdAt
- [x] Dashboard project tiles now show metrics from the most-recent reforecast by reforecastDate
- [x] Inline-editable Baseline Budget in project summary bar (click-to-edit)
- [x] Reforecast Date picker in toolbar alongside reforecast dropdown
- [x] Switching reforecasts updates Baseline Budget, variance, budget ratio, and chart budget line
- [x] Creating a reforecast copies the source budget; reforecastDate always defaults to today
- [x] 328 passing tests across 18 test files

### Phase 14: Holiday Calendar (Sprint 13 — DONE)
- [x] Global holiday calendar in Settings (name, start date, end date per holiday)
- [x] `Holiday` interface added to `Settings` type
- [x] `countHolidayWorkdays()` utility counts holiday workdays within a date range (deduplicates overlapping entries)
- [x] `getMonthlyWorkHours()` gains optional `holidays` parameter — subtracts holiday workdays from available hours
- [x] Holidays threaded through calc engine via `settings.holidays` in `calculateProjectMetrics()`
- [x] Weekend holidays silently ignored (no effect on workday count)
- [x] Data migration v0.6.0 adds `holidays: []` to settings
- [x] HolidayTable component with inline editing, delete confirmation, sorted by start date
- [x] Dates displayed as MM/DD/YYYY; stored as YYYY-MM-DD
- [x] Start date auto-fills end date for single-day holiday convenience
- [x] Both RateTable and HolidayTable collapsible (default collapsed) with chevron + count badge
- [x] Add buttons disabled until validation passes (both tables)
- [x] 364 passing tests across 19 test files

### Allocation Grid Row Sorting & Reorder (v0.8.0)
- [x] Sortable "Team Member" column header — click cycles: None → Name A→Z → Role→Name → None
- [x] Sort is a one-time reorder action that persists `project.assignments` order (not a view-only filter)
- [x] Inline drag handle (⠿) on each row for manual reorder (HTML5 drag-and-drop)
- [x] `reorderAssignments()` and `sortAssignments()` in `useTeam` hook
- [x] Sticky name column (CSS `position: sticky; left: 0`) for horizontal scrolling
- [x] Selected/focused cells use `z-20` to render outline above sticky columns (`z-10`)

### Deferred (Future)
- XLSX timecard import (with project alias mapping)
- Traffic-light dashboard
- Database backend
- Multi-user support

---

## Part 7: Incremental Build Plan

### Sprint 1: Foundation — COMPLETE (v0.1.0)
**Goal**: Basic app shell with data persistence

Delivered:
- Next.js 16 + TypeScript strict + Tailwind CSS v4 + Vitest
- localStorage repository with async interface and migration support
- Settings page with rate table editor
- JSON export/import (DataPortability component)
- MigrationGuard component (runs migrations before rendering)

### Sprint 2: Projects — COMPLETE (v0.1.0)
**Goal**: Project CRUD and dashboard

Delivered:
- Dashboard with project cards (ETC, EAC, team count, variance)
- Project create/edit/delete flows
- Project detail page with allocation grid and charts

### Sprint 3: Team & Allocations — COMPLETE (v0.1.1 → v0.2.0)
**Goal**: Team management and allocation grid

Delivered:
- Global team member pool (/team page) with CRUD
- Pool-to-project assignment via allocation grid picker
- resolveAssignments() helper (joins assignments + pool → TeamMember[])
- Allocation grid with inline editing, multi-cell selection, drag-to-fill
- v0.2.0 migration (extracts pool from embedded teamMembers, rewrites to assignments)
- Removed Core/Extended type classification (deferred for future if needed)

### Sprint 4: Calculations — COMPLETE (v0.1.2)
**Goal**: Full calculation engine

Delivered:
- Pure calc functions: costs, metrics, NPV, productivity, allocationMap
- calculateProjectMetrics orchestrator (accepts explicit teamMembers param)
- ForecastMetricsPanel with live-updating ETC/EAC/variance/burn rate/NPV
- 157 unit tests including golden-file spreadsheet parity tests

### Sprint 5: Visualization — COMPLETE (v0.1.3)
**Goal**: Charts and data display

Delivered:
- SVG MonthlyCostBarChart with tooltips
- SVG CumulativeCostLineChart with baseline reference line
- Allocation grid summary rows (monthly cost + hours)
- Chart tooltip component with formatted values

### Sprint 6: Reforecasts — COMPLETE (v0.3.0)
**Goal**: Snapshot management

Delivered:
- Reforecast creation UI with ReforecastToolbar and NewReforecastDialog
- Reforecast switching via dropdown
- Copy allocations from previous reforecast (deep-clone with new IDs)
- 12 reforecast management tests

### Sprint 7: Productivity & Polish — COMPLETE (v0.3.0)
**Goal**: Productivity windows + UX polish

Delivered:
- Productivity window CRUD (ProductivityWindowPanel with add/edit/delete)
- Calculation adjustment already wired (getProductivityFactor per month)
- Amber visual indicators on allocation grid for months with reduced productivity
- Keyboard navigation (arrow keys, Enter, Tab, Delete, digit-to-edit)
- Error handling and validation in forms
- README.md with domain glossary and intentional divergences
- 183 total tests (up from 157)

### Sprint 8: UX Polish & Branding — COMPLETE (v0.3.0)
**Goal**: App branding, navigation, and UX refinements

Delivered:
- Footer component (copyright, GPL, version link to changelog)
- About page (/about) with app description, privacy, author, GitHub link
- Changelog page (/changelog) with versioned release history
- TM trademark branding on MyScrumBudget name throughout app
- Cost-by-Period table — annual spend breakout below cost charts
- Dashboard drag-to-reorder project tiles (persisted to localStorage)
- Team pool table sorted alphabetically
- Currency formatting in project form inputs (click-to-edit pattern)
- Auto-set end date via nextBusinessDay when start date changes
- Cumulative cost chart now offsets by actual cost (EAC trajectory)
- ETC metric displayed in project summary bar
- New reforecast defaults copy-from to most recent reforecast
- useDebouncedSave flush on unmount (prevents stale data on navigation)
- Codebase refactoring: extracted shared utilities (formatShortMonth, nextBusinessDay, getActiveReforecast, chart layout constants), consolidated imports, renamed DATA_VERSION
- 190 total tests across 14 test files

### Sprint 9: Bug Fixes, Accessibility & UX — COMPLETE (v0.4.0)
**Goal**: Harden edge cases, improve accessibility, add mobile nav

Delivered:
- Last reforecast deletion guard (hook + UI: hides Delete button when only one reforecast)
- Negative budget/actual cost validation (3-layer: HTML min attr, JS clamp on change, submit-time check)
- Import migrations: DataPortability now runs `runMigrations()` before `importAll()`
- Mobile-responsive sidebar (Sidebar.tsx client component with hamburger toggle, overlay backdrop)
- Empty states with dashed borders and hint text (AllocationGrid, PoolMemberTable, ForecastMetricsPanel)
- Reforecast deletion confirmation dialog (DeleteReforecastDialog.tsx, mirrors DeleteProjectDialog pattern)
- Color-only information fix: Unicode triangles (▲/▼) and text labels ("over budget"/"under budget") on variance, ratio, and EAC
- Skip-to-content link in layout (hidden until keyboard-focused)
- Keyboard-accessible project reordering (move up/down buttons flanking drag handle)
- Edge case tests: zero-budget projects, single-month projects, orphaned assignments, non-overlapping productivity windows, import/export round-trip, migration-on-import
- 204 total tests across 15 test files

### Sprint 10: Workday-Based Calculation Engine — COMPLETE (v0.5.0)
**Goal**: Replace fixed hoursPerMonth with calendar-based workday calculation

Delivered:
- Replaced fixed `hoursPerMonth` setting (default 160) with workday-based engine: `countWorkdays(start, end) × HOURS_PER_DAY`
- Partial first/last months clipped to project start/end dates (a 2-day project now calculates correctly: 2 workdays × 8 × $100 = $1,600 instead of $16,000)
- `HOURS_PER_DAY = 8` constant in `lib/constants.ts` (not configurable)
- New date utilities: `countWorkdays()`, `getMonthlyWorkHours()` in `lib/utils/dates.ts`
- Removed "Working Hours per Month" input from Settings page
- Removed `hoursPerMonth` from `Settings` interface and `DEFAULT_SETTINGS`
- Data migration v0.3.0 strips `hoursPerMonth` from stored settings
- Confirmation dialog for team member removal from allocation grid (DeleteAssignmentDialog.tsx)
- Empty pool: link to Team Pool page instead of dead-end dropdown
- Consistent add-member UX: removed standalone empty-state UI, always uses grid table row
- Recomputed all golden-file regression test values for workday-based engine
- New dates.test.ts with 19 tests for workday utilities
- 224 total tests across 16 test files

### Sprint 11: Per-Reforecast Actual Cost — COMPLETE (v0.6.0)
**Goal**: Move actualCost from project-level into each reforecast snapshot

Delivered:
- Moved `actualCost` from `Project` interface into `Reforecast` interface
- Data migration v0.4.0: moves project.actualCost to active reforecast (others get 0); creates Baseline for projects without reforecasts
- `updateActualCost` callback in `useReforecast` hook updates active reforecast's actualCost
- Inline-editable Actual Cost in project summary bar (click-to-edit pattern)
- Switching reforecasts updates Actual Cost, EAC, variance, charts, and cost table
- Creating a reforecast from an existing one copies its actualCost
- Removed Actual Cost from ProjectForm (create/edit) — only Baseline Budget remains
- Every new project auto-creates a Baseline reforecast with $0 actual cost
- Updated all 16 test files with new migration and actualCost-per-reforecast tests

### Sprint 12: Per-Reforecast Budget + Reforecast Date — COMPLETE (v0.7.0)
**Goal**: Move baselineBudget into each reforecast, add reforecastDate, dashboard uses most-recent reforecast

Delivered:
- Moved `baselineBudget` from `Project` interface into `Reforecast` interface
- Added `reforecastDate: string` (ISO date) to `Reforecast` — user-editable, defaults to today
- Data migration v0.5.0: copies project.baselineBudget into all reforecasts, derives reforecastDate from createdAt
- `getMostRecentReforecast(project)` helper sorts by reforecastDate desc with createdAt tie-breaking
- Dashboard `ProjectCard` uses most-recent reforecast for metrics (not activeReforecastId)
- `updateBaselineBudget` and `updateReforecastDate` callbacks in `useReforecast` hook
- Inline-editable Baseline Budget in project summary bar (click-to-edit, same pattern as Actual Cost)
- Reforecast Date `<input type="date">` added to ReforecastToolbar alongside dropdown
- Edit page reads/writes baselineBudget to/from active reforecast
- Shared reforecast factory (`createBaselineReforecast`, `createNewReforecast`) updated for both fields
- 328 passing tests across 18 test files

### Sprint 13: Holiday Calendar — COMPLETE (v0.8.0)
**Goal**: Global holiday calendar that subtracts non-work days from cost calculations

Delivered:
- `Holiday` interface (id, name, startDate, endDate) added to `Settings`
- `countHolidayWorkdays()` in `dates.ts` — counts holiday workdays within a date range, using `Set<string>` for deduplication
- `getMonthlyWorkHours()` updated with optional `holidays` parameter (backward compatible default `[]`)
- `Math.max(0, ...)` guard prevents negative hours from excessive holidays
- Single-line threading in `lib/calc/index.ts` — passes `settings.holidays` to `getMonthlyWorkHours()`
- `countWorkdays()` intentionally NOT modified — holidays handled at `getMonthlyWorkHours()` level only, preserving `getProductivityFactor()` behavior
- Data migration v0.6.0 adds `holidays: []` to settings
- `HolidayTable.tsx` — CRUD table matching RateTable pattern with inline editing, delete confirmation, start-date-to-end-date auto-fill
- Dates displayed as MM/DD/YYYY in table rows; stored as YYYY-MM-DD for sorting
- Both RateTable and HolidayTable made collapsible (default collapsed) with rotating chevron + count badge
- Add buttons disabled until validation passes on both tables
- Date input placeholder text styled to match text input placeholder color
- 15 new `countHolidayWorkdays` tests, 8 new `getMonthlyWorkHours` holiday tests, 2 migration tests
- 364 total tests across 19 test files

### Allocation Grid Sorting & Reorder — COMPLETE (v0.8.0)
**Goal**: Sortable column header and drag-to-reorder for team member rows

Delivered:
- Sortable "Team Member" column header — click cycles through None → Name A→Z → Role→Name → None
- Sorting physically reorders `project.assignments` and persists (one-time action, not a view filter)
- Inline drag handle (⠿) in name cell for manual row reorder (HTML5 drag-and-drop, same pattern as dashboard project cards)
- `reorderAssignments(orderedIds)` and `sortAssignments(mode)` in `useTeam` hook
- Sticky name column (CSS `position: sticky; left: 0`) — Excel-like frozen pane for horizontal scrolling
- Selected/focused allocation cells elevated to `z-20` to render outline above sticky columns (`z-10`)
- No data model changes — `project.assignments` is already an ordered array

### Sprint 14: Traffic-Light Dashboard + Refactoring — COMPLETE (v0.9.0)
**Goal**: Three-state traffic-light status on dashboard project tiles, configurable thresholds, codebase refactoring

Delivered:
- `TrafficLightThresholds` and `TrafficLightStatus` types added to `domain.ts`
- `trafficLightThresholds` added to `Settings` interface with defaults `{ amberPercent: 5, redPercent: 15 }`
- Pure `getTrafficLightStatus()` and `getTrafficLightDisplay()` functions in `lib/calc/trafficLight.ts`
- Data migration v0.7.0 adds `trafficLightThresholds` to settings with defaults
- `ThresholdSettings.tsx` — collapsible settings section for amber/red thresholds
- `ProjectCard.tsx` — colored EAC value with status indicator dot and text label ("On Track" / "At Risk" / "Over Budget")
- `ProjectSummary.tsx` — traffic-light coloring on EAC in project detail page
- Consolidated 3 delete dialogs (`DeleteProjectDialog`, `DeleteReforecastDialog`, `DeleteAssignmentDialog`) into a single reusable `ConfirmDialog` component
- Extracted drag-to-reorder logic into generic `useDragReorder` hook (used by dashboard and allocation grid)
- Extracted collapsible section pattern into shared `CollapsibleSection` component (used by all Settings sections)
- Removed dashboard arrow-key reorder buttons (drag handles sufficient)
- Sticky sidebar navigation on desktop
- Deleted stale untracked files (`AddMemberForm.tsx`, `TeamTable.tsx`)
- 387 passing tests across 21 test files

### Sprint 15: Dependency Update — COMPLETE (v0.10.0)
**Goal**: Update all dependencies to latest stable versions for JFrog vulnerability scan compliance

Delivered:
- Updated react and react-dom from 19.2.3 to 19.2.4
- Updated @vitejs/plugin-react from 5.1.2 to 5.1.3
- Updated @types/node from ^20 (20.19.30) to ^24 (24.10.9) matching Node.js 24 LTS runtime
- Updated jsdom from ^27.4.0 (27.4.0) to ^28.0.0 (28.0.0)
- Cleaned up 5 extraneous native addon packages (@emnapi/*, @napi-rs/*, @tybys/*)
- npm audit: 0 vulnerabilities
- 387 passing tests across 21 test files (unchanged)

---

## Part 8: TypeScript Calculation Functions

### Core Calculation Module (`lib/calc/`)

```typescript
// lib/calc/costs.ts

import type { Settings, TeamMember, MonthlyAllocation } from '@/types/domain';

// Pre-aggregated allocation lookup for performance
type AllocationMap = Map<string, Map<string, number>>; // month -> memberId -> allocation

/**
 * Build allocation map for O(1) lookups
 */
export function buildAllocationMap(allocations: MonthlyAllocation[]): AllocationMap {
  const map = new Map<string, Map<string, number>>();
  
  for (const alloc of allocations) {
    if (!map.has(alloc.month)) {
      map.set(alloc.month, new Map());
    }
    map.get(alloc.month)!.set(alloc.memberId, alloc.allocation);
  }
  
  return map;
}

/**
 * Get hourly rate for a team member based on their role
 */
export function getHourlyRate(
  role: string, 
  settings: Settings
): number {
  const rate = settings.laborRates.find(r => r.role === role);
  return rate?.hourlyRate ?? 0;
}

/**
 * Calculate monthly cost for a single team member
 * Productivity factor reduces effective cost proportionally
 */
export function calculateMemberMonthlyCost(
  allocation: number,
  hourlyRate: number,
  hoursPerMonth: number,
  productivityFactor: number = 1
): number {
  return hourlyRate * hoursPerMonth * allocation * productivityFactor;
}

/**
 * Calculate monthly hours for a single team member
 * Productivity factor reduces effective hours (e.g., holidays, reduced availability)
 */
export function calculateMemberMonthlyHours(
  allocation: number,
  hoursPerMonth: number,
  productivityFactor: number = 1
): number {
  return hoursPerMonth * allocation * productivityFactor;
}

/**
 * Calculate total monthly cost for all team members
 */
export function calculateTotalMonthlyCost(
  month: string,
  allocationMap: AllocationMap,
  teamMembers: TeamMember[],
  settings: Settings,
  productivityFactor: number = 1
): number {
  const monthAllocations = allocationMap.get(month);
  if (!monthAllocations) return 0;

  let total = 0;
  for (const member of teamMembers) {
    const allocation = monthAllocations.get(member.id) ?? 0;
    if (allocation > 0) {
      const rate = getHourlyRate(member.role, settings);
      total += calculateMemberMonthlyCost(
        allocation,
        rate,
        settings.hoursPerMonth,
        productivityFactor
      );
    }
  }
  return total;
}

/**
 * Calculate total monthly hours for all team members
 */
export function calculateTotalMonthlyHours(
  month: string,
  allocationMap: AllocationMap,
  settings: Settings,
  productivityFactor: number = 1
): number {
  const monthAllocations = allocationMap.get(month);
  if (!monthAllocations) return 0;

  let total = 0;
  for (const [, allocation] of monthAllocations) {
    total += calculateMemberMonthlyHours(
      allocation,
      settings.hoursPerMonth,
      productivityFactor
    );
  }
  return total;
}
```

```typescript
// lib/calc/metrics.ts

import type { MonthlyCalculation, MonthlyAllocation } from '@/types/domain';

/**
 * Calculate Estimate to Complete (ETC)
 * Sum of all forecasted future costs
 */
export function calculateETC(monthlyCosts: number[]): number {
  return monthlyCosts.reduce((sum, cost) => sum + cost, 0);
}

/**
 * Calculate Estimate at Completion (EAC)
 * EAC = Actual Cost + ETC
 */
export function calculateEAC(actualCost: number, etc: number): number {
  return actualCost + etc;
}

/**
 * Calculate variance from baseline
 * Negative = under budget, Positive = over budget
 */
export function calculateVariance(eac: number, baseline: number): number {
  return eac - baseline;
}

/**
 * Calculate variance percentage
 */
export function calculateVariancePercent(
  eac: number, 
  baseline: number
): number {
  if (baseline === 0) return 0;
  return ((eac - baseline) / baseline) * 100;
}

/**
 * Calculate Budget Performance Ratio
 * 
 * Ratio of baseline budget to current forecast (EAC).
 * - > 1.0 = forecasting under budget
 * - = 1.0 = on budget  
 * - < 1.0 = forecasting over budget
 * 
 * NOTE: This is NOT the same as EVM Cost Performance Index (CPI = EV/AC).
 * This tool does not track earned value. This ratio compares the original
 * budget to the current estimate at completion.
 */
export function calculateBudgetPerformanceRatio(
  baselineBudget: number, 
  eac: number
): number {
  if (eac === 0) return 0;
  return baselineBudget / eac;
}

/**
 * Calculate weekly burn rate
 * burnRate = ETC / weeks_in_forecast_period
 * 
 * Matches Excel: uses last month with allocations, not project end date
 */
export function calculateWeeklyBurnRate(
  etc: number,
  startDate: Date,
  activeMonths: string[]
): number {
  if (activeMonths.length === 0 || etc === 0) return 0;
  
  // Find the last active month
  const sortedMonths = [...activeMonths].sort();
  const lastActiveMonth = sortedMonths[sortedMonths.length - 1];
  
  // Get last day of that month
  const [year, month] = lastActiveMonth.split('-').map(Number);
  const endDate = new Date(year, month, 0); // Day 0 of next month = last day of this month
  
  // Calculate weeks
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay);
  const weeks = Math.max(1, Math.round(days / 7));
  
  return etc / weeks;
}

/**
 * Extract active months (months with any allocation > 0)
 */
export function getActiveMonths(allocations: MonthlyAllocation[]): string[] {
  const monthsWithAllocation = new Set<string>();
  
  for (const alloc of allocations) {
    if (alloc.allocation > 0) {
      monthsWithAllocation.add(alloc.month);
    }
  }
  
  return Array.from(monthsWithAllocation);
}

/**
 * Generate monthly calculations with cumulative totals
 */
export function generateMonthlyCalculations(
  months: string[],
  monthlyCosts: Map<string, number>,
  monthlyHours: Map<string, number>
): MonthlyCalculation[] {
  let cumulativeCost = 0;
  let cumulativeHours = 0;

  return months.map(month => {
    const cost = monthlyCosts.get(month) ?? 0;
    const hours = monthlyHours.get(month) ?? 0;
    cumulativeCost += cost;
    cumulativeHours += hours;

    return {
      month,
      cost,
      hours,
      cumulativeCost,
      cumulativeHours
    };
  });
}
```

```typescript
// lib/calc/npv.ts

/**
 * Calculate Net Present Value of monthly cash flows
 * 
 * @param annualDiscountRate - Annual rate (e.g., 0.03 for 3%)
 * @param monthlyCashFlows - Array of monthly cash flows
 * 
 * Note: Converts annual rate to monthly internally (annual / 12).
 * This diverges from the original spreadsheet which passes the rate
 * directly to Excel's NPV function.
 */
export function calculateNPV(
  annualDiscountRate: number,
  monthlyCashFlows: number[]
): number {
  const monthlyRate = annualDiscountRate / 12;

  return monthlyCashFlows.reduce((npv, cashFlow, index) => {
    const period = index + 1;
    return npv + cashFlow / Math.pow(1 + monthlyRate, period);
  }, 0);
}
```

```typescript
// lib/calc/productivity.ts

import type { ProductivityWindow } from '@/types/domain';

/**
 * Calculate productivity factor for a given month
 * based on overlapping productivity windows.
 * 
 * Returns the minimum factor if multiple windows overlap.
 * Returns 1 (full productivity) if no windows apply.
 */
export function getProductivityFactor(
  month: string,
  windows: ProductivityWindow[]
): number {
  if (windows.length === 0) return 1;

  const monthStart = new Date(month + '-01');
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(monthEnd.getDate() - 1);

  // Find overlapping windows
  const overlapping = windows.filter(w => {
    const windowStart = new Date(w.startDate);
    const windowEnd = new Date(w.endDate);
    return windowStart <= monthEnd && windowEnd >= monthStart;
  });

  if (overlapping.length === 0) return 1;

  // Use minimum factor if multiple windows overlap
  return Math.min(...overlapping.map(w => w.factor));
}
```

---

## Part 9: Repository Interface

```typescript
// lib/storage/repository.ts

import type { Settings, PoolMember, Project, AppState } from '@/types/domain';

export interface Repository {
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;

  getTeamPool(): Promise<PoolMember[]>;
  saveTeamPool(pool: PoolMember[]): Promise<void>;

  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;

  exportAll(): Promise<AppState>;
  importAll(state: AppState): Promise<void>;

  clear(): Promise<void>;
  getVersion(): Promise<string>;
  migrateIfNeeded(): Promise<void>;
}
```

```typescript
// lib/storage/repo.ts — shared singleton used by all hooks and components

import { createLocalStorageRepository } from './localStorage';
export const repo = createLocalStorageRepository();
```

The localStorage implementation (`localStorage.ts`) uses `STORAGE_KEYS` from `types/storage.ts` and handles team pool via `getTeamPool()`/`saveTeamPool()`. The `exportAll()`/`importAll()` methods include `teamPool` in the `AppState` round-trip.

```typescript
// lib/storage/migrations.ts — current data version is 0.7.0

export const DATA_VERSION = '0.7.0';

// Migration chain: v1.0.0 → v0.1.0 → v0.2.0 → v0.3.0 → v0.4.0 → v0.5.0 → v0.6.0 → v0.7.0
// v0.1.0: Extracts teamMembers from projects into global teamPool, rewrites to assignments
// v0.2.0: (structural migration)
// v0.3.0: Strips deprecated hoursPerMonth from settings
// v0.4.0: Moves actualCost from Project into each Reforecast; creates Baseline for projects without reforecasts
// v0.5.0: Moves baselineBudget from Project into each Reforecast; adds reforecastDate (derived from createdAt)
// v0.6.0: Adds holidays array to settings (empty default)
// v0.7.0: Adds trafficLightThresholds to settings (default: amber 5%, red 15%)
```

---

## Part 10: Testing Strategy

### Unit Tests
Standard unit tests for individual functions in `lib/calc/`.

### Golden-File Spreadsheet Parity Tests
Critical tests that verify our calculations match the original Excel file exactly.

```typescript
// lib/calc/__tests__/spreadsheet-parity.test.ts

import { describe, it, expect } from 'vitest';
import {
  calculateMemberMonthlyCost,
  calculateMemberMonthlyHours,
} from '../costs';
import { calculateETC, calculateEAC, calculateWeeklyBurnRate } from '../metrics';

/**
 * Golden file test: values extracted directly from MyScrumBudget_1.5.xlsx
 * 
 * If these tests fail, either:
 * 1. Our implementation diverged from spreadsheet logic
 * 2. We intentionally changed behavior (update the test + document why)
 */
describe('Spreadsheet Parity', () => {
  // Fixture: exact data from MyScrumBudget_1.5.xlsx
  const SPREADSHEET = {
    settings: {
      hoursPerMonth: 160,
      discountRateAnnual: 0.03,
      laborRates: [
        { role: 'BA', hourlyRate: 75 },
        { role: 'IT-SoftEng', hourlyRate: 100 },
        { role: 'IT-Security', hourlyRate: 90 },
        { role: 'IT-DevOps', hourlyRate: 80 },
        { role: 'Manager', hourlyRate: 150 },
        { role: 'PMO', hourlyRate: 120 },
      ],
    },
    project: {
      startDate: new Date('2026-06-15'),
      actualCost: 200000,
    },
    aaliyah: {
      role: 'BA',
      allocations: [0.25, 0.5, 0.5, 0.5, 0.5, 0.5, 0.25, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.25],
    },
    expected: {
      aaliyahMonth1Cost: 3000,        // 75 * 160 * 0.25
      aaliyahMonth1Hours: 40,          // 160 * 0.25
      totalMonth1Cost: 34752,          // Row 109, Col D (×1000 in display)
      etc: 856656,                     // Cell K3
      eac: 1056656,                    // Cell K4
      weeklyBurnRate: 14043.54,        // Cell P2 (approx)
    },
  };

  describe('Individual Cost Calculations', () => {
    it('calculates Aaliyah month 1 cost correctly', () => {
      const cost = calculateMemberMonthlyCost(0.25, 75, 160, 1);
      expect(cost).toBe(SPREADSHEET.expected.aaliyahMonth1Cost);
    });

    it('calculates Aaliyah month 1 hours correctly', () => {
      const hours = calculateMemberMonthlyHours(0.25, 160, 1);
      expect(hours).toBe(SPREADSHEET.expected.aaliyahMonth1Hours);
    });
  });

  describe('Aggregate Calculations', () => {
    it('calculates EAC correctly', () => {
      const eac = calculateEAC(
        SPREADSHEET.project.actualCost,
        SPREADSHEET.expected.etc
      );
      expect(eac).toBe(SPREADSHEET.expected.eac);
    });
  });

  describe('Burn Rate', () => {
    it('calculates weekly burn rate matching spreadsheet', () => {
      const activeMonths = [
        '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11',
        '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05',
        '2027-06', '2027-07'
      ];
      
      const burnRate = calculateWeeklyBurnRate(
        SPREADSHEET.expected.etc,
        SPREADSHEET.project.startDate,
        activeMonths
      );
      
      expect(burnRate).toBeCloseTo(SPREADSHEET.expected.weeklyBurnRate, 0);
    });
  });
});
```

---

## Part 11: Key UI Components (Sketched)

### MonthGrid Component
```tsx
// components/ui/MonthGrid.tsx
// Spreadsheet-like grid for monthly allocations

interface MonthGridProps {
  months: string[];
  teamMembers: TeamMember[];
  allocations: AllocationMap;
  onAllocationChange: (memberId: string, month: string, value: number) => void;
  readonly?: boolean;
}

// Features:
// - Sticky row headers (team member names)
// - Sticky column headers (month labels)
// - Tab navigation between cells
// - Percentage input validation (0-100)
// - Color coding by allocation level
```

### ForecastMetricsPanel Component
```tsx
// features/reforecast/components/ForecastMetricsPanel.tsx
// Display calculated project metrics

interface ForecastMetricsPanelProps {
  metrics: ProjectMetrics;
  baseline: number;
}

// Displays:
// - ETC, EAC in currency format
// - Variance with color (red if over, green if under)
// - Budget Ratio with status indicator
// - Weekly burn rate
// - Total hours
```

### CostChart Component  
```tsx
// features/reforecast/components/CostChart.tsx
// SVG-based cost visualization

interface CostChartProps {
  monthlyData: MonthlyCalculation[];
  baseline?: number;
}

// Features:
// - Stacked bar chart for monthly costs
// - Line overlay for cumulative cost
// - Baseline reference line
// - Hover tooltips
// - Responsive sizing
```

---

## Part 12: Future Extension Seams

### XLSX Timecard Import
The architecture supports adding project alias mapping for flexible import:

```typescript
// Future addition to Settings
interface Settings {
  // ... existing fields ...
  
  // Maps timecard project names to internal project IDs
  timecardProjectAliases?: Record<string, string>;
}
```

### Database Backend
The Repository interface allows swapping LocalStorage for any backend:

```typescript
// Future: lib/storage/apiRepository.ts
export function createApiRepository(baseUrl: string): Repository {
  // Same interface, HTTP calls instead of localStorage
}
```

### IndexedDB
For larger datasets while remaining client-side:

```typescript
// Future: lib/storage/indexedDbRepository.ts
export function createIndexedDbRepository(): Repository {
  // Same interface, IndexedDB instead of localStorage
}
```

---

## Summary

This architecture document provides:

1. **Complete analysis** of the MyScrumBudget spreadsheet formulas and data model
2. **Clean TypeScript domain model** with global team pool + project assignments
3. **Repository pattern** with shared singleton and migration support
4. **Feature-based folder structure** optimized for solo maintenance
5. **Incremental build plan** with testable milestones (Sprints 1–15 complete)
6. **Pure calculation functions** with 387 unit tests
7. **Golden-file parity tests** ensuring spreadsheet accuracy

Key design decisions:
- **Global team pool** with per-project assignments (same member can appear multiple times)
- **Budget Ratio** instead of "CPI" to avoid EVM terminology confusion
- **Annual discount rate** converted to monthly (diverges from spreadsheet for clarity)
- **Burn rate uses active months**, not project end date (matches spreadsheet)
- **Productivity is a calculation overlay**, never mutates stored allocations
- **Pre-aggregated allocation maps** for efficient reactive UI rendering
- **Shared repo singleton** (`repo.ts`) used by all hooks — no duplicate instantiation
- **Generic `useDebouncedSave<T>`** hook for consistent debounced persistence
- **resolveAssignments()** at hook level keeps calc functions consuming `TeamMember[]`

The design prioritizes:
- Simplicity over abstraction
- Small, focused files
- Predictable patterns
- Seams for future enhancements without over-engineering for MVP
