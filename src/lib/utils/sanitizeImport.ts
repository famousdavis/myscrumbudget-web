// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Field-strip pass for imported AppState. Reconstructs every entity in the
 * tree containing ONLY allowlisted keys. Defense-in-depth on top of
 * validateAppState (shape check) and parseImportJson (prototype-pollution
 * reviver) — together they ensure imported JSON cannot smuggle attacker-
 * controlled fields into localStorage or, on cloud-flip, into Firestore.
 *
 * Each entity allowlist mirrors the corresponding interface in
 * src/types/domain.ts. If the domain types gain a field, add it here in
 * the same PR or imports will silently drop the new value.
 *
 * Optional fields are simply absent from the output object when not
 * present on the input — preserving the optional-field semantics expected
 * by downstream code (e.g., reforecast.actualsThroughDate, project.order).
 */

import type {
  AppState,
  Settings,
  TrafficLightThresholds,
  Holiday,
  LaborRate,
  PoolMember,
  Project,
  Reforecast,
  ProjectAssignment,
  MonthlyAllocation,
  ProductivityWindow,
  HistoricalCostEntry,
  CharterBudget,
  RiskProfile,
} from '@/types/domain';

// Per-entity allowlists. Keep alphabetical-within-group for review ease.
//
// ⚠️ Each allowlist is DERIVED from a `Record<keyof T, true>` literal rather
// than written as a bare array, and that is load-bearing — do not "simplify" it
// back. A bare `ReadonlyArray<keyof T>` annotation ERASES the literal union, so
// nothing in the type system notices a missing entry: `Exclude<keyof Project,
// typeof PROJECT_FIELDS[number]>` evaluates to `never` whatever the array
// actually contains. `Record<keyof T, true>` inverts that — every key of the
// interface is REQUIRED, so omitting one is a compile error (TS2741, naming the
// field) caught by the `typecheck` step of the ship gate.
//
// This is not hypothetical. `color` was added to `Project` in v0.33.0 and not to
// PROJECT_FIELDS, so tile colour was silently stripped from every JSON import
// round-trip for 7 releases across 43 days, until v0.34.0 noticed by accident.
// The `Object.keys` call preserves insertion order for these (non-numeric
// string) keys, so the derived arrays are element-for-element what they were.

const LABOR_RATE_FIELD_SET: Record<keyof LaborRate, true> = {
  role: true, hourlyRate: true,
};
const LABOR_RATE_FIELDS = Object.keys(LABOR_RATE_FIELD_SET) as ReadonlyArray<keyof LaborRate>;

const HOLIDAY_FIELD_SET: Record<keyof Holiday, true> = {
  id: true, name: true, startDate: true, endDate: true,
};
const HOLIDAY_FIELDS = Object.keys(HOLIDAY_FIELD_SET) as ReadonlyArray<keyof Holiday>;

const TRAFFIC_LIGHT_FIELD_SET: Record<keyof TrafficLightThresholds, true> = {
  amberPercent: true, redPercent: true, violetPercent: true,
};
const TRAFFIC_LIGHT_FIELDS = Object.keys(
  TRAFFIC_LIGHT_FIELD_SET,
) as ReadonlyArray<keyof TrafficLightThresholds>;

const SETTINGS_FIELD_SET: Record<keyof Settings, true> = {
  discountRateAnnual: true, laborRates: true, holidays: true, trafficLightThresholds: true,
};
const SETTINGS_FIELDS = Object.keys(SETTINGS_FIELD_SET) as ReadonlyArray<keyof Settings>;

const POOL_MEMBER_FIELD_SET: Record<keyof PoolMember, true> = {
  id: true, name: true, role: true, archived: true,
};
const POOL_MEMBER_FIELDS = Object.keys(POOL_MEMBER_FIELD_SET) as ReadonlyArray<keyof PoolMember>;

const ASSIGNMENT_FIELD_SET: Record<keyof ProjectAssignment, true> = {
  id: true, poolMemberId: true,
};
const ASSIGNMENT_FIELDS = Object.keys(
  ASSIGNMENT_FIELD_SET,
) as ReadonlyArray<keyof ProjectAssignment>;

const ALLOCATION_FIELD_SET: Record<keyof MonthlyAllocation, true> = {
  memberId: true, month: true, allocation: true,
};
const ALLOCATION_FIELDS = Object.keys(
  ALLOCATION_FIELD_SET,
) as ReadonlyArray<keyof MonthlyAllocation>;

const PRODUCTIVITY_WINDOW_FIELD_SET: Record<keyof ProductivityWindow, true> = {
  id: true, startDate: true, endDate: true, factor: true,
};
const PRODUCTIVITY_WINDOW_FIELDS = Object.keys(
  PRODUCTIVITY_WINDOW_FIELD_SET,
) as ReadonlyArray<keyof ProductivityWindow>;

const HISTORICAL_COST_FIELD_SET: Record<keyof HistoricalCostEntry, true> = {
  month: true, cost: true, hours: true,
};
const HISTORICAL_COST_FIELDS = Object.keys(
  HISTORICAL_COST_FIELD_SET,
) as ReadonlyArray<keyof HistoricalCostEntry>;

const RISK_PROFILE_FIELD_SET: Record<keyof RiskProfile, true> = {
  projectType: true, requirementsClarity: true, teamExperience: true,
  orgChangeImpact: true, integrationComplexity: true, cvOverride: true,
  optimismUpliftPct: true,
};
const RISK_PROFILE_FIELDS = Object.keys(RISK_PROFILE_FIELD_SET) as ReadonlyArray<keyof RiskProfile>;

const CHARTER_BUDGET_FIELD_SET: Record<keyof CharterBudget, true> = {
  riskProfile: true, distribution: true, targetPercentile: true, etcIsP80Schedule: true,
  derivedCV: true, derivedSigma: true, etcAtCalculation: true, adjustedCostBasis: true,
  charterBudgetAmount: true, medianAmount: true, calculatedAt: true,
};
const CHARTER_BUDGET_FIELDS = Object.keys(
  CHARTER_BUDGET_FIELD_SET,
) as ReadonlyArray<keyof CharterBudget>;

const REFORECAST_FIELD_SET: Record<keyof Reforecast, true> = {
  id: true, name: true, createdAt: true,
  startDate: true, endDate: true, reforecastDate: true,
  allocations: true, assignments: true, productivityWindows: true,
  actualCost: true, baselineBudget: true,
  actualsThroughDate: true, notes: true, historicalCosts: true, charterBudget: true,
};
const REFORECAST_FIELDS = Object.keys(REFORECAST_FIELD_SET) as ReadonlyArray<keyof Reforecast>;

const PROJECT_FIELD_SET: Record<keyof Project, true> = {
  id: true, name: true, startDate: true, endDate: true,
  reforecasts: true, activeReforecastId: true, color: true, archived: true,
};
const PROJECT_FIELDS = Object.keys(PROJECT_FIELD_SET) as ReadonlyArray<keyof Project>;

const APP_STATE_FIELD_SET: Record<keyof AppState, true> = {
  version: true, msbExportKind: true, settings: true, teamPool: true, projects: true,
  _originRef: true, _storageRef: true, _changeLog: true,
  _exportedBy: true, _exportedById: true,
};
const APP_STATE_FIELDS = Object.keys(APP_STATE_FIELD_SET) as ReadonlyArray<keyof AppState>;

/**
 * Construct a clean copy of `src` containing only the keys in `allowlist`.
 * Keys absent from `src` are absent from the result (optional-field semantic
 * preserved). Values are passed through verbatim — caller is responsible
 * for deep-cleaning nested arrays/objects via the per-entity helpers below.
 */
function pickKeys<T extends object, K extends keyof T>(
  src: T,
  allowlist: ReadonlyArray<K>,
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of allowlist) {
    if (Object.prototype.hasOwnProperty.call(src, key)) {
      out[key] = src[key];
    }
  }
  return out;
}

function sanitizeLaborRate(r: LaborRate): LaborRate {
  return pickKeys(r, LABOR_RATE_FIELDS) as LaborRate;
}

function sanitizeHoliday(h: Holiday): Holiday {
  return pickKeys(h, HOLIDAY_FIELDS) as Holiday;
}

function sanitizeTrafficLight(t: TrafficLightThresholds): TrafficLightThresholds {
  return pickKeys(t, TRAFFIC_LIGHT_FIELDS) as TrafficLightThresholds;
}

function sanitizeSettings(s: Settings): Settings {
  const picked = pickKeys(s, SETTINGS_FIELDS);
  return {
    ...picked,
    laborRates: (picked.laborRates ?? []).map(sanitizeLaborRate),
    holidays: (picked.holidays ?? []).map(sanitizeHoliday),
    trafficLightThresholds: sanitizeTrafficLight(picked.trafficLightThresholds),
  } as Settings;
}

function sanitizePoolMember(m: PoolMember): PoolMember {
  return pickKeys(m, POOL_MEMBER_FIELDS) as PoolMember;
}

function sanitizeAssignment(a: ProjectAssignment): ProjectAssignment {
  return pickKeys(a, ASSIGNMENT_FIELDS) as ProjectAssignment;
}

function sanitizeAllocation(a: MonthlyAllocation): MonthlyAllocation {
  return pickKeys(a, ALLOCATION_FIELDS) as MonthlyAllocation;
}

function sanitizeProductivityWindow(w: ProductivityWindow): ProductivityWindow {
  return pickKeys(w, PRODUCTIVITY_WINDOW_FIELDS) as ProductivityWindow;
}

function sanitizeHistoricalCost(h: HistoricalCostEntry): HistoricalCostEntry {
  return pickKeys(h, HISTORICAL_COST_FIELDS) as HistoricalCostEntry;
}

/**
 * Two-stage deep pick: `pickKeys` is shallow, and `charterBudget` nests a
 * `riskProfile` object (7 sub-keys), so the nested object must be picked
 * separately or unknown nested keys would leak through the import strip.
 */
function sanitizeCharterBudget(cb: CharterBudget): CharterBudget {
  const picked = pickKeys(cb, CHARTER_BUDGET_FIELDS);
  return {
    ...picked,
    riskProfile: pickKeys(
      (picked.riskProfile ?? {}) as RiskProfile,
      RISK_PROFILE_FIELDS,
    ),
  } as CharterBudget;
}

function sanitizeReforecast(rf: Reforecast): Reforecast {
  const picked = pickKeys(rf, REFORECAST_FIELDS);
  const out: Reforecast = {
    ...picked,
    allocations: (picked.allocations ?? []).map(sanitizeAllocation),
    assignments: (picked.assignments ?? []).map(sanitizeAssignment),
    productivityWindows: (picked.productivityWindows ?? []).map(sanitizeProductivityWindow),
  } as Reforecast;
  if (picked.historicalCosts !== undefined) {
    out.historicalCosts = picked.historicalCosts.map(sanitizeHistoricalCost);
  }
  if (picked.charterBudget !== undefined) {
    out.charterBudget = sanitizeCharterBudget(picked.charterBudget);
  }
  return out;
}

function sanitizeProject(p: Project): Project {
  const picked = pickKeys(p, PROJECT_FIELDS);
  return {
    ...picked,
    reforecasts: (picked.reforecasts ?? []).map(sanitizeReforecast),
  } as Project;
}

/**
 * Strip every imported entity to its declared field allowlist. Apply AFTER
 * `runMigrations` and `validateAppState` so the call sees a structurally
 * valid AppState; the strip pass guarantees no UNKNOWN fields survive into
 * `repo.importAll` (and therefore into localStorage or Firestore on cloud-
 * flip).
 *
 * Critical: this is the last defense against attacker-injected fields like
 * a top-level `members: { '<victim_uid>': 'owner' }` on a project. Today
 * `firestoreRepo.createProject` and `importAll` already hardcode owner /
 * members from the calling auth context, so this is defense-in-depth on a
 * mitigated surface — but it also blocks pollution of arrays (reforecasts,
 * allocations) where no second guard exists.
 */
export function sanitizeAppState(state: AppState): AppState {
  const picked = pickKeys(state, APP_STATE_FIELDS);
  const out: AppState = {
    ...picked,
    settings: sanitizeSettings(picked.settings),
    teamPool: (picked.teamPool ?? []).map(sanitizePoolMember),
    projects: (picked.projects ?? []).map(sanitizeProject),
  } as AppState;
  return out;
}
