// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Labor Rates (Global Settings)
export interface LaborRate {
  role: string;
  hourlyRate: number;
}

// Holiday (Global Settings — non-work days subtracted from workday calculations)
export interface Holiday {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD (same as startDate for single-day holidays)
}

// Traffic-light thresholds for dashboard status indicators.
// Based on variancePercent: positive = over budget.
export interface TrafficLightThresholds {
  amberPercent: number;  // variance% above this → Amber (default: 5)
  redPercent: number;    // variance% above this → Red (default: 15)
  violetPercent: number; // variance% below -violetPercent → Violet (default: 20 means below -20%)
}

export type TrafficLightStatus = 'green' | 'amber' | 'red' | 'violet';

export interface Settings {
  discountRateAnnual: number;
  laborRates: LaborRate[];
  holidays: Holiday[];
  trafficLightThresholds: TrafficLightThresholds;
}

// Global Team Member Pool
export interface PoolMember {
  id: string;
  name: string;
  role: string; // references LaborRate.role
  archived?: boolean; // undefined or false = active; true = hidden from picker but still resolves in saved reforecasts
}

// Project Assignment — links a pool member into a project
// Each assignment gets its own allocation row; the same poolMemberId
// can appear multiple times in a project for "generic" roles.
export interface ProjectAssignment {
  id: string; // unique — MonthlyAllocation.memberId references this
  poolMemberId: string; // references PoolMember.id
}

// Resolved Team Member — produced by joining ProjectAssignment + PoolMember.
// Used by calc engine, AllocationGrid, and charts.
export interface TeamMember {
  id: string; // assignment id (for allocation lookups)
  name: string;
  role: string;
}

// Monthly Allocation (user intent - never modified by productivity)
export interface MonthlyAllocation {
  memberId: string; // references ProjectAssignment.id
  month: string; // ISO date (YYYY-MM)
  allocation: number; // 0.0 to 1.0
}

// Productivity Window (applied at calculation time only)
export interface ProductivityWindow {
  id: string;
  startDate: string;
  endDate: string;
  factor: number; // 0.0 to 1.0
}

/**
 * Per-month breakdown entry attached to a Reforecast. When
 * reforecast.historicalCosts is present and non-empty, the entries
 * must sum to reforecast.actualCost (invariant). The cutoff-month
 * entry (matching actualsThroughDate's YYYY-MM) is not stored —
 * it's derived at display time as actualCost − sum(other entries).
 */
export interface HistoricalCostEntry {
  month: string; // YYYY-MM
  cost: number;
  hours: number; // 0 when unknown; reserved for future cumulative-hours display
}

// Reforecast Snapshot
export interface Reforecast {
  id: string;
  name: string;
  createdAt: string;
  startDate: string; // YYYY-MM-DD — first day of the reforecast window
  endDate: string; // YYYY-MM-DD — last day of the reforecast window
  reforecastDate: string; // ISO date (YYYY-MM-DD) — when this reforecast was prepared
  allocations: MonthlyAllocation[];
  assignments: ProjectAssignment[];
  productivityWindows: ProductivityWindow[];
  actualCost: number;
  baselineBudget: number;
  actualsThroughDate?: string; // YYYY-MM-DD — ETC excludes costs through this date
  notes?: string; // free-text narrative explaining why this reforecast exists (max 2000 chars)
  historicalCosts?: HistoricalCostEntry[];
  charterBudget?: CharterBudget; // optional uncertainty-adjusted charter budget; undefined = not set / cleared
}

/** Distribution choice for the charter budget calculation. */
export type Distribution = 'normal' | 'lognormal' | 'beta_pert';

/**
 * Five-question risk profile that drives the charter budget CV.
 * Single source of truth: the charter engine takes this as a parameter AND
 * CharterBudget['riskProfile'] references it, so the two cannot drift apart.
 */
export interface RiskProfile {
  projectType: 'vendor' | 'infra' | 'biz' | 'custom' | 'data' | 'ai';
  requirementsClarity: 'well' | 'partial' | 'expl';
  teamExperience: 'high' | 'some' | 'new';
  orgChangeImpact: 'low' | 'mod' | 'high';
  integrationComplexity: 'solo' | 'mod' | 'high';
  cvOverride: number | null; // manual CV override as a fraction in [0.08, 0.50] (= CV_FLOOR..CV_CEILING), or null
  optimismUpliftPct: number; // optimism-bias uplift as a fraction >= 0 (0 = no uplift)
}

/**
 * Stored charter budget snapshot on a Reforecast. The derived fields are frozen
 * at calculatedAt (live ETC may have since moved — see staleness detection); they
 * are a cache for the badge and are recomputed on panel open for display.
 */
export interface CharterBudget {
  riskProfile: RiskProfile;
  distribution: Distribution;
  targetPercentile: number; // 60 | 70 | 75 | 80 | 85 | 90 | 95
  etcIsP80Schedule: boolean;
  // ---- derived snapshot, frozen at calculatedAt ----
  derivedCV: number;
  derivedSigma: number;
  etcAtCalculation: number; // raw ETC when computed; drives the staleness check
  adjustedCostBasis: number; // ETC × (1 + uplift); = ETC when uplift 0
  charterBudgetAmount: number;
  medianAmount: number;
  calculatedAt: string; // ISO-8601 (NOT a Firestore Timestamp)
}

/**
 * Return shape of computeCharterBudget(). Intentionally distinct from the stored
 * CharterBudget — the panel maps this (+ form inputs + calculatedAt) into the
 * stored object at a single assembly step (mapping lives in one place).
 */
export interface CharterBudgetResult {
  cv: number;
  sigma: number;
  center: number;
  etc: number;
  upliftAmount: number;
  charterAmount: number;
  medianAmount: number;
  contingencyAmt: number;
  contingencyPct: number;
  totalOverEtcPct: number;
  cvWarn: boolean;
  ceilingActive: boolean;
  floorActive: boolean;
}

// Optional Dashboard tile tint (v0.33.0). A small curated palette of keys that
// deliberately AVOIDS the traffic-light status hues (red/amber/green/violet) so a
// user's organizing tint can never be confused with a health indicator. Absence
// of the field means "no tint".
export type ProjectColor = 'blue' | 'teal' | 'slate' | 'purple' | 'pink';

// Project
export interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  reforecasts: Reforecast[];
  activeReforecastId: string | null;
  /** Optional Dashboard tile tint (v0.33.0). Absent = no tint. */
  color?: ProjectColor;
}

// Calculated Values
export interface MonthlyCalculation {
  month: string;
  cost: number;
  hours: number;
  cumulativeCost: number;
  cumulativeHours: number;
}

export interface ProjectMetrics {
  etc: number;
  eac: number;
  variance: number;
  variancePercent: number;
  budgetRatio: number;
  weeklyBurnRate: number;
  npv: number;
  totalHours: number;
  monthlyData: MonthlyCalculation[];
}

// Theme preference (UI-only, not part of AppState or migrations)
export type ThemeMode = 'light' | 'dark' | 'system';

// Full application state
export interface AppState {
  version: string;
  /**
   * Discriminant for future multi-format defense (pitfall #61 gate).
   * Added v0.30.0. Legacy exports (before v0.30.0) omit this field — they
   * are accepted by the import handler as 'dataset' by convention.
   * When a second export format ships (e.g. 'single-project'), the import
   * handler's guard must be tightened to REQUIRE this field.
   */
  msbExportKind?: 'dataset';
  settings: Settings;
  teamPool: PoolMember[];
  projects: Project[];
  // Workspace reconciliation tokens (optional for backward compatibility)
  _originRef?: string;
  _storageRef?: string;
  _changeLog?: import('@/lib/storage/fingerprint').ChangeLogEntry[];
  _exportedBy?: string;
  _exportedById?: string;
}
