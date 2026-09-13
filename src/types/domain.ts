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

/**
 * The cost inputs a project was costed with, carried ON the project so every
 * reader prices it the same way (v0.39.0).
 *
 * ⚠️ NOTHING WRITES ONE AT v0.39.0. This release ships the field, the read path
 * and the validator; the writer is v0.40.0 (an owner-only refresh at
 * `saveProject`). Until then `docToProject` never sees a snapshot, so every
 * behaviour below is unreachable — the point is to get the read path right
 * BEFORE anything writes, not to change a number today.
 *
 * WHY IT EXISTS: `calculateProjectMetrics` prices a project from the READER's
 * `Settings`. On a shared project that is the reader's own rate card, so six
 * collaborators can see six different ETCs for one project. This is the field
 * that lets them agree.
 *
 * ⚠️ `trafficLightThresholds` is DELIBERATELY ABSENT. It is a per-user display
 * preference, not a cost input — how red you want "over budget" to look is
 * yours, while what the project costs is the owner's. `effectiveSettings`
 * constructs its result field by field rather than spreading, so that choice is
 * stated at the site instead of being implied by key order.
 *
 * ⚠️ DERIVED CACHE, NOT AUTHORED DATA — like `_teamSnapshot` and unlike `color`
 * (v0.33.0) or `archived` (v0.34.0), which are user-authored and bumped
 * DATA_VERSION. It is excluded from the import allowlist (`PROJECT_FIELD_SET`):
 * an imported dataset carries its own settings, so the fallback is never needed
 * there, and a snapshot that survived an import would be stale by construction
 * with no way for the importer to clear it.
 */
export interface CostSnapshot {
  laborRates: LaborRate[];
  holidays: Holiday[];
  discountRateAnnual: number;
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
  /**
   * Optional project-archiving flag (v0.34.0). undefined or false = active;
   * true = hidden from the Dashboard grid by default. Never backfilled;
   * stripped back to undefined on unarchive (mirrors PoolMember.archived).
   */
  archived?: boolean;
  /**
   * Last-known display names for this project's assignees, keyed by
   * `poolMemberId` (v0.38.2). Populated ONLY on the Firestore read path
   * (`docToProject`).
   *
   * ⚠️ CORRECTED v0.38.3 — this said "absent in local mode and absent from
   * JSON exports". The second half was FALSE and the first was unverified.
   * Measured 2026-09-12:
   *   - LOCAL MODE: genuinely absent. Nothing in local mode sets it, the
   *     import sanitizer strips it, and there is no cloud-to-local copy path
   *     (all four `importAll` call sites write INTO cloud, or are internal to
   *     `localStorage.ts`). ⚠️ It is nonetheless PERSISTABLE by construction —
   *     `localStorage.saveProject` stores the Project verbatim — so adding a
   *     cloud-to-local path would land it in local storage.
   *   - JSON EXPORTS: a CLOUD-mode export DOES carry it. `sanitizeAppState`
   *     runs on the IMPORT path only (`useImportState.ts:151`); export writes
   *     `repository.exportAll()` straight to the file, and the Firestore
   *     `exportAll` returns `docToProject` output. Local-mode exports do not.
   *
   * That asymmetry — emitted, never ingested — is INTENDED, not an oversight:
   * emitting costs nothing and can only help a reader, while ingesting a
   * snapshot would import a map that is stale by construction and could mask a
   * genuinely unresolvable member behind an out-of-date name.
   *
   * WHY IT EXISTS: `resolveAssignments` joins `ProjectAssignment.poolMemberId`
   * against the VIEWER's own team pool. A collaborator on a shared project has
   * none of the owner's pool members, so every row resolved to "(Unknown)".
   * This is the fallback that names them.
   *
   * ⚠️ DERIVED CACHE, NOT AUTHORED DATA — this is why it carries no
   * DATA_VERSION bump and no migration, unlike `color` (v0.33.0) and
   * `archived` (v0.34.0), which are user-authored and did. It is regenerated
   * from the writer's pool on every cloud write, so there is nothing to
   * backfill and nothing a migration could repair. It is also deliberately
   * excluded from the import allowlist (`PROJECT_FIELD_SET`): an imported JSON
   * dataset carries its own `teamPool`, so the fallback is never needed there,
   * and a snapshot that survived an import would be stale by construction.
   */
  _teamSnapshot?: Record<string, { name: string; role: string }>;
  /**
   * The cost inputs this project was costed with (v0.39.0). See `CostSnapshot`.
   * Populated ONLY on the Firestore read path (`docToProject`), and only when
   * the stored value validates — so a domain `Project` carries a usable
   * snapshot or none, and no read site needs a defensive check.
   *
   * ⚠️ NOTHING WRITES ONE AT v0.39.0; the writer is v0.40.0.
   */
  _costSnapshot?: CostSnapshot;
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
