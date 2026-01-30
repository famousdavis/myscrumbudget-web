/**
 * Regression test fixture — originally derived from MyScrumBudget_1.5.xlsx
 *
 * These values are the single source of truth for calculation regression tests.
 * If a test fails, either:
 *   1. The implementation has a bug (fix the code), or
 *   2. We intentionally changed behavior (update the fixture + document why)
 *
 * Calculation formulas (workday-based engine, v0.5.0+):
 *   Available hours = countWorkdays(monthStart, monthEnd) * 8
 *   Member cost     = hourlyRate * availableHours * allocationPct
 *   Member hours    = availableHours * allocationPct
 *   ETC             = SUM(all per-member monthly costs)
 *   EAC             = AC + ETC
 *   Burn rate       = ETC / ROUND(DATEDIF(startDate, EDATE(startDate, activeMonthCount), "d") / 7, 0)
 *
 * INTENTIONAL DIVERGENCE (vs Excel):
 *   1. Excel uses a fixed 160 hours/month; we derive hours from actual workdays.
 *      Partial first/last months are clipped to project start/end dates.
 *   2. NPV: Excel uses 0.03 as a per-period (monthly) discount rate.
 *      Our app treats 0.03 as an annual rate and converts to monthly: 0.03 / 12 = 0.0025.
 *      Documented in CLAUDE.md and README.md.
 */

import type { Settings, TeamMember, MonthlyAllocation } from '@/types/domain';

export interface SpreadsheetFixture {
  settings: Settings;
  project: {
    startDate: string;
    endDate: string;
    actualCost: number;
  };
  teamMembers: TeamMember[];
  allocations: MonthlyAllocation[];
  months: string[];
  expected: {
    aaliyahMonth1Cost: number;
    aaliyahMonth1Hours: number;
    totalMonthlyCosts: number[];
    totalMonthlyHours: number[];
    cumulativeCosts: number[];
    cumulativeHours: number[];
    etc: number;
    eac: number;
    weeklyBurnRate: number;
    totalHours: number;
    burnRateDetail: {
      activeMonthCount: number;
      edateEndDate: string;
      daysBetween: number;
      weeksRounded: number;
    };
    /** Available workday hours per month (workdays × 8), for reference in tests */
    monthlyAvailableHours: number[];
  };
}

// 14 active months
const MONTHS = [
  '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11',
  '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05',
  '2027-06', '2027-07',
] as const;

// Helper to build MonthlyAllocation[] from an allocation pattern array
function buildAllocations(
  memberId: string,
  pattern: number[],
): MonthlyAllocation[] {
  return pattern.map((allocation, i) => ({
    memberId,
    month: MONTHS[i],
    allocation,
  }));
}

// Team member definitions matching Excel rows 8-18
const teamMembers: TeamMember[] = [
  { id: 'tm_aaliyah', name: 'Aaliyah', role: 'BA' },
  { id: 'tm_mateo', name: 'Mateo', role: 'BA' },
  { id: 'tm_sofia', name: 'Sofia', role: 'IT-Security' },
  { id: 'tm_ethan', name: 'Ethan', role: 'IT-SoftEng' },
  { id: 'tm_aria', name: 'Aria', role: 'IT-SoftEng' },
  { id: 'tm_noah', name: 'Noah', role: 'IT-SoftEng' },
  { id: 'tm_julianna', name: 'Julianna', role: 'PMO' },
  { id: 'tm_luca', name: 'Luca', role: 'Manager' },
  { id: 'tm_amara', name: 'Amara', role: 'Manager' },
  { id: 'tm_kai', name: 'Kai', role: 'Manager' },
  { id: 'tm_priya', name: 'Priya', role: 'Manager' },
];

// Allocation patterns from Excel (14 months each)
// Half-months (Jun '26 and Jul '27) have halved allocations
const allocationPatterns: Record<string, number[]> = {
  tm_aaliyah:  [0.25, 0.50, 0.50, 0.50, 0.50, 0.50, 0.25, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.25],
  tm_mateo:    [0.25, 0.50, 0.50, 0.50, 0.50, 0.50, 0.25, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.25],
  tm_sofia:    [0.13, 0.25, 0.25, 0.25, 0.25, 0.25, 0.13, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.13],
  tm_ethan:    [0.40, 0.80, 0.80, 0.80, 0.80, 0.80, 0.40, 0.80, 0.80, 0.80, 0.80, 0.80, 0.80, 0.40],
  tm_aria:     [0.40, 0.80, 0.80, 0.80, 0.80, 0.80, 0.40, 0.80, 0.80, 0.80, 0.80, 0.80, 0.80, 0.40],
  tm_noah:     [0.40, 0.80, 0.80, 0.80, 0.80, 0.80, 0.40, 0.80, 0.80, 0.80, 0.80, 0.80, 0.80, 0.40],
  tm_julianna: [0.25, 0.50, 0.50, 0.50, 0.50, 0.50, 0.25, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.25],
  tm_luca:     [0.03, 0.05, 0.05, 0.05, 0.05, 0.05, 0.03, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.03],
  tm_amara:    [0.03, 0.05, 0.05, 0.05, 0.05, 0.05, 0.03, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.03],
  tm_kai:      [0.03, 0.05, 0.05, 0.05, 0.05, 0.05, 0.03, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.03],
  tm_priya:    [0.03, 0.05, 0.05, 0.05, 0.05, 0.05, 0.03, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.03],
};

// Build flat allocations array from patterns
const allocations: MonthlyAllocation[] = Object.entries(allocationPatterns).flatMap(
  ([memberId, pattern]) => buildAllocations(memberId, pattern),
);

export const SPREADSHEET_FIXTURE: SpreadsheetFixture = {
  settings: {
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
    startDate: '2026-06-15',
    endDate: '2027-07-15',
    actualCost: 200_000,
  },
  teamMembers,
  allocations,
  months: [...MONTHS],
  expected: {
    // Individual member checks (Aaliyah, BA, $75/hr)
    // Month 1 (Jun 2026): 12 workdays from 6/15-6/30, 96 available hours
    aaliyahMonth1Cost: 1_800,     // 75 * 96 * 0.25
    aaliyahMonth1Hours: 24,       // 96 * 0.25

    // Workday-based available hours per month (workdays × 8)
    // Jun: 12wd (partial), Jul: 23wd, Aug: 21wd, Sep: 22wd, Oct: 22wd, Nov: 21wd,
    // Dec: 23wd, Jan: 21wd, Feb: 20wd, Mar: 23wd, Apr: 22wd, May: 21wd,
    // Jun: 22wd, Jul: 11wd (partial)
    monthlyAvailableHours: [
      96, 184, 168, 176, 176, 168,
      184, 168, 160, 184, 176, 168,
      176, 88,
    ],

    // Monthly cost totals (workday-based)
    totalMonthlyCosts: [
      20_851.2, 78_660, 71_820, 75_240, 75_240, 71_820,
      39_964.8, 71_820, 68_400, 78_660, 75_240, 71_820,
      75_240, 19_113.6,
    ],

    // Monthly hours totals (workday-based)
    totalMonthlyHours: [
      211.2, 800.4, 730.8, 765.6, 765.6, 730.8,
      404.8, 730.8, 696, 800.4, 765.6, 730.8,
      765.6, 193.6,
    ],

    // Cumulative cost
    cumulativeCosts: [
      20_851.2, 99_511.2, 171_331.2, 246_571.2, 321_811.2, 393_631.2,
      433_596, 505_416, 573_816, 652_476, 727_716, 799_536,
      874_776, 893_889.6,
    ],

    // Cumulative hours
    cumulativeHours: [
      211.2, 1_011.6, 1_742.4, 2_508, 3_273.6, 4_004.4,
      4_409.2, 5_140, 5_836, 6_636.4, 7_402, 8_132.8,
      8_898.4, 9_092,
    ],

    // Key metrics (workday-based)
    etc: 893_889.6,
    eac: 1_093_889.6,                             // 200000 + 893889.6
    weeklyBurnRate: 14_653.927868852459,           // 893889.6 / 61
    totalHours: 9_092,

    // Burn rate calculation detail (unchanged — same formula)
    burnRateDetail: {
      activeMonthCount: 14,
      edateEndDate: '2027-08-15',              // EDATE(2026-06-15, 14)
      daysBetween: 426,                        // DATEDIF(2026-06-15, 2027-08-15, "d")
      weeksRounded: 61,                        // ROUND(426 / 7, 0)
    },
  },
};
