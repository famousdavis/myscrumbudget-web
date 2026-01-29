/**
 * Golden-file fixture data extracted from MyScrumBudget_1.5.xlsx
 *
 * These values are the single source of truth for parity tests.
 * If a parity test fails, either:
 *   1. The implementation has a bug (fix the code), or
 *   2. We intentionally changed behavior (update the fixture + document why)
 *
 * Excel formulas decoded:
 *   Member cost  = hourlyRate * 160 * allocationPct
 *   Member hours = allocationPct * 160
 *   ETC          = SUM(all per-member monthly costs)
 *   EAC          = AC + ETC
 *   Burn rate    = ETC / ROUND(DATEDIF(startDate, EDATE(startDate, activeMonthCount), "d") / 7, 0)
 *   NPV (Excel)  = NPV(0.03, monthlyCosts[]) -- treats 0.03 as per-period rate
 *
 * INTENTIONAL DIVERGENCE (NPV):
 *   Excel uses 0.03 as a per-period (monthly) discount rate.
 *   Our app treats 0.03 as an annual rate and converts to monthly: 0.03 / 12 = 0.0025.
 *   This is documented in CLAUDE.md and README.md.
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
    startDate: '2026-06-15',
    endDate: '2027-07-15',
    actualCost: 200_000,
  },
  teamMembers,
  allocations,
  months: [...MONTHS],
  expected: {
    // Individual member checks (Aaliyah, BA, $75/hr)
    aaliyahMonth1Cost: 3_000,     // 75 * 160 * 0.25
    aaliyahMonth1Hours: 40,       // 160 * 0.25

    // Row 213: raw monthly cost totals from Excel
    totalMonthlyCosts: [
      34_752, 68_400, 68_400, 68_400, 68_400, 68_400,
      34_752, 68_400, 68_400, 68_400, 68_400, 68_400,
      68_400, 34_752,
    ],

    // Row 315: monthly hours totals from Excel
    // Note: 352.00000000000006 in Excel due to 0.13 * 160 = 20.8 floating point
    totalMonthlyHours: [
      352, 696, 696, 696, 696, 696,
      352, 696, 696, 696, 696, 696,
      696, 352,
    ],

    // Row 214: cumulative cost from Excel
    cumulativeCosts: [
      34_752, 103_152, 171_552, 239_952, 308_352, 376_752,
      411_504, 479_904, 548_304, 616_704, 685_104, 753_504,
      821_904, 856_656,
    ],

    // Row 316: cumulative hours from Excel
    cumulativeHours: [
      352, 1_048, 1_744, 2_440, 3_136, 3_832,
      4_184, 4_880, 5_576, 6_272, 6_968, 7_664,
      8_360, 8_712,
    ],

    // Key metrics from Excel
    etc: 856_656,                              // Cell K3
    eac: 1_056_656,                            // Cell K4 = 200000 + 856656
    weeklyBurnRate: 14_043.540983606557,       // Cell P2
    totalHours: 8_712,                         // Cell P4

    // Burn rate calculation detail
    burnRateDetail: {
      activeMonthCount: 14,
      edateEndDate: '2027-08-15',              // EDATE(2026-06-15, 14)
      daysBetween: 426,                        // DATEDIF(2026-06-15, 2027-08-15, "d")
      weeksRounded: 61,                        // ROUND(426 / 7, 0)
    },
  },
};
