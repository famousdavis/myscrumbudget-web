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

interface Settings {
  hoursPerMonth: number;        // default 160
  laborRates: LaborRate[];
  discountRateAnnual: number;   // annual rate, default 0.03 (3%)
}

// Team Member
interface TeamMember {
  id: string;
  name: string;
  role: string;           // must match a LaborRate.role
  type: 'Core' | 'Extended';
}

// Monthly Allocation (user intent - never modified by productivity)
interface MonthlyAllocation {
  memberId: string;
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
  createdAt: string;      // ISO datetime
  startDate: string;      // forecast start month
  allocations: MonthlyAllocation[];
  productivityWindows: ProductivityWindow[];
}

// Project
interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  baselineBudget: number;
  actualCost: number;
  teamMembers: TeamMember[];
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
| `msb:projects` | Project[] | All projects |
| `msb:version` | string | Data schema version for migrations |

### JSON Schema

```typescript
// Full application state
interface AppState {
  version: string;        // Schema version (e.g., "1.0.0")
  settings: Settings;
  projects: Project[];
}

// Example stored data
const exampleState: AppState = {
  version: "1.0.0",
  settings: {
    hoursPerMonth: 160,
    discountRateAnnual: 0.03,
    laborRates: [
      { role: "BA", hourlyRate: 75 },
      { role: "IT-SoftEng", hourlyRate: 100 },
      { role: "IT-Security", hourlyRate: 90 },
      { role: "IT-DevOps", hourlyRate: 80 },
      { role: "Manager", hourlyRate: 150 },
      { role: "PMO", hourlyRate: 120 }
    ]
  },
  projects: [{
    id: "proj_001",
    name: "Alpha Project",
    startDate: "2026-06-15",
    endDate: "2027-07-15",
    baselineBudget: 1000000,
    actualCost: 200000,
    teamMembers: [
      { id: "tm_001", name: "Aaliyah", role: "BA", type: "Core" },
      { id: "tm_002", name: "Ethan", role: "IT-SoftEng", type: "Core" }
    ],
    reforecasts: [{
      id: "rf_001",
      name: "Q3 2026 Reforecast",
      createdAt: "2026-07-01T10:00:00Z",
      startDate: "2026-06",
      allocations: [
        { memberId: "tm_001", month: "2026-06", allocation: 0.25 },
        { memberId: "tm_001", month: "2026-07", allocation: 0.50 },
        { memberId: "tm_002", month: "2026-06", allocation: 0.40 }
      ],
      productivityWindows: []
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
│  │   /projects/[id]/team  → Team member management                         │ │
│  │   /settings            → Global settings (rates, hours/month)           │ │
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
│  │  │   lib/calc/     │  │   lib/storage/   │  │    components/ui/      │  ││
│  │  ├─────────────────┤  ├──────────────────┤  ├────────────────────────┤  ││
│  │  │ costs.ts        │  │ repository.ts    │  │ MonthGrid.tsx          │  ││
│  │  │ metrics.ts      │  │ localStorage.ts  │  │ DataTable.tsx          │  ││
│  │  │ npv.ts          │  │ migrations.ts    │  │ Chart.tsx (SVG)        │  ││
│  │  │ productivity.ts │  │ types.ts         │  │ EditableCell.tsx       │  ││
│  │  └─────────────────┘  └──────────────────┘  └────────────────────────┘  ││
│  │                                                                          ││
│  │  ┌─────────────────┐  ┌──────────────────┐                              ││
│  │  │    lib/utils/   │  │     types/       │                              ││
│  │  ├─────────────────┤  ├──────────────────┤                              ││
│  │  │ dates.ts        │  │ domain.ts        │                              ││
│  │  │ format.ts       │  │ storage.ts       │                              ││
│  │  │ id.ts           │  │                  │                              ││
│  │  └─────────────────┘  └──────────────────┘                              ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         LocalStorage                                     ││
│  │                                                                          ││
│  │    msb:settings    msb:projects    msb:version                          ││
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
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Dashboard (project list)
│   ├── projects/
│   │   ├── [id]/
│   │   │   ├── page.tsx         # Project detail/forecast view
│   │   │   ├── team/
│   │   │   │   └── page.tsx     # Team management
│   │   │   └── history/
│   │   │       └── page.tsx     # Reforecast history
│   │   └── new/
│   │       └── page.tsx         # Create project
│   └── settings/
│       └── page.tsx             # Global settings
│
├── features/                     # Feature modules
│   ├── projects/
│   │   ├── components/
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ProjectForm.tsx
│   │   │   └── ProjectSummary.tsx
│   │   ├── hooks/
│   │   │   ├── useProjects.ts
│   │   │   └── useProject.ts
│   │   └── types.ts
│   │
│   ├── reforecast/
│   │   ├── components/
│   │   │   ├── AllocationGrid.tsx
│   │   │   ├── CostChart.tsx
│   │   │   ├── ForecastMetricsPanel.tsx
│   │   │   └── ProductivityEditor.tsx
│   │   ├── hooks/
│   │   │   ├── useReforecast.ts
│   │   │   └── useMetrics.ts
│   │   └── types.ts
│   │
│   ├── team/
│   │   ├── components/
│   │   │   ├── TeamMemberRow.tsx
│   │   │   ├── TeamTable.tsx
│   │   │   └── RoleSelect.tsx
│   │   ├── hooks/
│   │   │   └── useTeam.ts
│   │   └── types.ts
│   │
│   └── settings/
│       ├── components/
│       │   ├── RateTable.tsx
│       │   └── SettingsForm.tsx
│       ├── hooks/
│       │   └── useSettings.ts
│       └── types.ts
│
├── lib/                          # Shared utilities
│   ├── calc/                     # Pure calculation functions
│   │   ├── costs.ts             # Cost calculations
│   │   ├── metrics.ts           # EAC, ETC, budget ratio, variance
│   │   ├── npv.ts               # NPV calculation
│   │   ├── productivity.ts      # Productivity factor lookup
│   │   ├── __tests__/
│   │   │   ├── costs.test.ts
│   │   │   ├── metrics.test.ts
│   │   │   ├── spreadsheet-parity.test.ts  # Golden-file tests
│   │   │   └── fixtures/
│   │   │       └── spreadsheet-1.5.ts
│   │   └── index.ts             # Re-exports
│   │
│   ├── storage/                  # Persistence layer
│   │   ├── repository.ts        # Abstract interface
│   │   ├── localStorage.ts      # LocalStorage implementation
│   │   ├── migrations.ts        # Version migrations
│   │   └── types.ts
│   │
│   └── utils/
│       ├── dates.ts             # Date manipulation
│       ├── format.ts            # Number/currency formatting
│       └── id.ts                # ID generation
│
├── components/                   # Shared UI components
│   └── ui/
│       ├── MonthGrid.tsx        # Spreadsheet-like month grid
│       ├── DataTable.tsx        # Generic data table
│       ├── EditableCell.tsx     # Inline editing
│       ├── Chart.tsx            # SVG chart wrapper
│       └── Button.tsx
│
├── types/
│   ├── domain.ts                # Core domain types
│   └── storage.ts               # Storage-specific types
│
├── hooks/
│   └── useLocalStorage.ts       # Generic localStorage hook
│
└── styles/
    └── globals.css              # Tailwind + custom styles
```

---

## Part 6: MVP Feature List

### Phase 1: Core Data & Settings
- [ ] Global settings management (hours/month, discount rate)
- [ ] Labor rate table CRUD
- [ ] LocalStorage persistence with migration support
- [ ] Data export/import (JSON)

### Phase 2: Projects
- [ ] Create/edit/delete projects
- [ ] Project metadata (name, dates, baseline budget, actual cost)
- [ ] Project list dashboard

### Phase 3: Team Management
- [ ] Add/edit/remove team members per project
- [ ] Role assignment with rate lookup
- [ ] Core/Extended classification

### Phase 4: Forecasting
- [ ] Monthly allocation grid (spreadsheet-like)
- [ ] Inline cell editing
- [ ] Auto-calculation of costs and hours

### Phase 5: Metrics & Calculations
- [ ] ETC, EAC calculations
- [ ] Variance vs baseline
- [ ] Budget ratio calculation
- [ ] Weekly burn rate (based on active months)
- [ ] NPV calculation (annual rate converted to monthly)

### Phase 6: Reforecast Snapshots
- [ ] Create named reforecasts
- [ ] Switch between reforecasts
- [ ] Copy allocation from previous reforecast

### Phase 7: Visualization
- [ ] Monthly cost bar chart (SVG)
- [ ] Cumulative cost curve (SVG)
- [ ] Burn rate trend line

### Phase 8: Productivity Windows (Enhancement)
- [ ] Define productivity limitation periods
- [ ] Apply factor to affected months (both hours and cost)
- [ ] Visual indication on allocation grid

### Deferred (Future)
- XLSX timecard import (with project alias mapping)
- Traffic-light dashboard
- Database backend
- Multi-user support

---

## Part 7: Incremental Build Plan

### Sprint 1: Foundation (1 week)
**Goal**: Basic app shell with data persistence

Tasks:
1. Initialize Next.js + TypeScript + Tailwind project
2. Implement `lib/storage/` with localStorage adapter and migration support
3. Create Settings page with rate table editor
4. Add data export/import functionality
5. Write unit tests for storage layer

Deliverables:
- Working settings page
- Persisted rate table
- Export/import JSON

### Sprint 2: Projects (1 week)
**Goal**: Project CRUD and dashboard

Tasks:
1. Implement project data structures
2. Build project list (dashboard) page
3. Create/edit project form
4. Add project deletion with confirmation
5. Unit tests for project operations

Deliverables:
- Dashboard with project cards
- Project create/edit flow
- Project metrics summary cards

### Sprint 3: Team & Allocations (1.5 weeks)
**Goal**: Team management and basic allocation grid

Tasks:
1. Team member CRUD within project
2. Role selector with rate lookup
3. Basic allocation grid component (read-only first)
4. Month column generation from project dates
5. Inline editing for allocation cells

Deliverables:
- Team management page
- Basic allocation grid
- Editable cells

### Sprint 4: Calculations (1 week)
**Goal**: Full calculation engine

Tasks:
1. Implement `lib/calc/costs.ts` - cost calculations
2. Implement `lib/calc/metrics.ts` - ETC, EAC, budget ratio
3. Implement `lib/calc/npv.ts` - NPV calculation (annual → monthly conversion)
4. Connect calculations to UI with memoized allocation maps
5. Comprehensive unit tests including spreadsheet parity tests

Deliverables:
- Live-updating metrics panel
- Verified calculation accuracy
- Golden-file tests passing

### Sprint 5: Visualization (1 week)
**Goal**: Charts and data display

Tasks:
1. SVG bar chart for monthly costs
2. SVG line chart for cumulative costs
3. Burn rate display
4. Summary row in allocation grid (totals, hours)

Deliverables:
- Cost charts
- Metrics dashboard
- Summary rows

### Sprint 6: Reforecasts (1 week)
**Goal**: Snapshot management

Tasks:
1. Reforecast creation UI
2. Reforecast switching
3. Copy from previous reforecast
4. Historical reforecast list

Deliverables:
- Reforecast management
- Version history

### Sprint 7: Productivity & Polish (1 week)
**Goal**: Productivity windows + UX polish

Tasks:
1. Productivity window CRUD
2. Calculation adjustment for productivity (hours and cost)
3. Visual indicators on allocation grid
4. Keyboard navigation
5. Error handling and validation
6. README and documentation

Deliverables:
- Complete MVP
- Documentation
- Ready for deployment

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

import type { Settings, Project, AppState } from '@/types/domain';

/**
 * Abstract repository interface for persistence
 * Allows swapping localStorage for IndexedDB or API later
 */
export interface Repository {
  // Settings
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;

  // Bulk operations
  exportAll(): Promise<AppState>;
  importAll(state: AppState): Promise<void>;
  
  // Maintenance
  clear(): Promise<void>;
  getVersion(): Promise<string>;
  migrateIfNeeded(): Promise<void>;
}
```

```typescript
// lib/storage/localStorage.ts

import type { Repository } from './repository';
import type { Settings, Project, AppState } from '@/types/domain';
import { runMigrations, CURRENT_VERSION } from './migrations';

const KEYS = {
  settings: 'msb:settings',
  projects: 'msb:projects',
  version: 'msb:version'
} as const;

const DEFAULT_SETTINGS: Settings = {
  hoursPerMonth: 160,
  discountRateAnnual: 0.03,
  laborRates: [
    { role: 'BA', hourlyRate: 75 },
    { role: 'IT-SoftEng', hourlyRate: 100 },
    { role: 'IT-Security', hourlyRate: 90 },
    { role: 'IT-DevOps', hourlyRate: 80 },
    { role: 'Manager', hourlyRate: 150 },
    { role: 'PMO', hourlyRate: 120 }
  ]
};

export function createLocalStorageRepository(): Repository {
  const get = <T>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') return fallback;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  };

  const set = (key: string, value: unknown): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  };

  return {
    async getSettings() {
      return get<Settings>(KEYS.settings, DEFAULT_SETTINGS);
    },

    async saveSettings(settings) {
      set(KEYS.settings, settings);
    },

    async getProjects() {
      return get<Project[]>(KEYS.projects, []);
    },

    async getProject(id) {
      const projects = await this.getProjects();
      return projects.find(p => p.id === id) ?? null;
    },

    async saveProject(project) {
      const projects = await this.getProjects();
      const index = projects.findIndex(p => p.id === project.id);
      if (index >= 0) {
        projects[index] = project;
      } else {
        projects.push(project);
      }
      set(KEYS.projects, projects);
    },

    async deleteProject(id) {
      const projects = await this.getProjects();
      set(KEYS.projects, projects.filter(p => p.id !== id));
    },

    async exportAll() {
      return {
        version: CURRENT_VERSION,
        settings: await this.getSettings(),
        projects: await this.getProjects()
      };
    },

    async importAll(state) {
      set(KEYS.version, state.version);
      set(KEYS.settings, state.settings);
      set(KEYS.projects, state.projects);
    },

    async clear() {
      Object.values(KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    },

    async getVersion() {
      return get<string>(KEYS.version, CURRENT_VERSION);
    },

    async migrateIfNeeded() {
      const currentVersion = await this.getVersion();
      const data = await this.exportAll();
      const migrated = runMigrations(data, currentVersion);
      
      if (migrated.version !== currentVersion) {
        await this.importAll(migrated);
      }
    }
  };
}
```

```typescript
// lib/storage/migrations.ts

import type { AppState } from '@/types/domain';

export const CURRENT_VERSION = '1.0.0';

type Migration = {
  version: string;
  migrate: (data: AppState) => AppState;
};

// Migrations run in order. Each transforms the data shape.
const MIGRATIONS: Migration[] = [
  // Example future migration:
  // {
  //   version: '1.1.0',
  //   migrate: (data) => ({
  //     ...data,
  //     projects: data.projects.map(p => ({ ...p, archived: false }))
  //   })
  // }
];

/**
 * Run all pending migrations
 */
export function runMigrations(data: AppState, fromVersion: string): AppState {
  const pendingMigrations = MIGRATIONS.filter(m => 
    compareVersions(m.version, fromVersion) > 0
  );

  if (pendingMigrations.length === 0) return data;

  let migrated = data;
  for (const migration of pendingMigrations) {
    migrated = migration.migrate(migrated);
    migrated = { ...migrated, version: migration.version };
  }

  return { ...migrated, version: CURRENT_VERSION };
}

/**
 * Simple semver comparison: returns >0 if a > b
 */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
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
2. **Clean TypeScript domain model** preserving all original functionality
3. **Repository pattern** enabling future persistence migrations
4. **Feature-based folder structure** optimized for solo maintenance
5. **Incremental build plan** with testable milestones
6. **Pure calculation functions** with comprehensive unit tests
7. **Golden-file parity tests** ensuring spreadsheet accuracy

Key design decisions:
- **Budget Ratio** instead of "CPI" to avoid EVM terminology confusion
- **Annual discount rate** converted to monthly (diverges from spreadsheet for clarity)
- **Burn rate uses active months**, not project end date (matches spreadsheet)
- **Productivity is a calculation overlay**, never mutates stored allocations
- **Pre-aggregated allocation maps** for efficient reactive UI rendering
- **Migration system** ready for schema evolution

The design prioritizes:
- Simplicity over abstraction
- Small, focused files
- Predictable patterns
- Seams for future enhancements without over-engineering for MVP
