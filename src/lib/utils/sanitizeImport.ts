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
} from '@/types/domain';

// Per-entity allowlists. Keep alphabetical-within-group for review ease.

const LABOR_RATE_FIELDS: ReadonlyArray<keyof LaborRate> = [
  'role', 'hourlyRate',
];

const HOLIDAY_FIELDS: ReadonlyArray<keyof Holiday> = [
  'id', 'name', 'startDate', 'endDate',
];

const TRAFFIC_LIGHT_FIELDS: ReadonlyArray<keyof TrafficLightThresholds> = [
  'amberPercent', 'redPercent', 'violetPercent',
];

const SETTINGS_FIELDS: ReadonlyArray<keyof Settings> = [
  'discountRateAnnual', 'laborRates', 'holidays', 'trafficLightThresholds',
];

const POOL_MEMBER_FIELDS: ReadonlyArray<keyof PoolMember> = [
  'id', 'name', 'role', 'archived',
];

const ASSIGNMENT_FIELDS: ReadonlyArray<keyof ProjectAssignment> = [
  'id', 'poolMemberId',
];

const ALLOCATION_FIELDS: ReadonlyArray<keyof MonthlyAllocation> = [
  'memberId', 'month', 'allocation',
];

const PRODUCTIVITY_WINDOW_FIELDS: ReadonlyArray<keyof ProductivityWindow> = [
  'id', 'startDate', 'endDate', 'factor',
];

const HISTORICAL_COST_FIELDS: ReadonlyArray<keyof HistoricalCostEntry> = [
  'month', 'cost', 'hours',
];

const REFORECAST_FIELDS: ReadonlyArray<keyof Reforecast> = [
  'id', 'name', 'createdAt',
  'startDate', 'endDate', 'reforecastDate',
  'allocations', 'assignments', 'productivityWindows',
  'actualCost', 'baselineBudget',
  'actualsThroughDate', 'notes', 'historicalCosts',
];

const PROJECT_FIELDS: ReadonlyArray<keyof Project> = [
  'id', 'name', 'startDate', 'endDate',
  'reforecasts', 'activeReforecastId',
];

const APP_STATE_FIELDS: ReadonlyArray<keyof AppState> = [
  'version', 'msbExportKind', 'settings', 'teamPool', 'projects',
  '_originRef', '_storageRef', '_changeLog',
  '_exportedBy', '_exportedById',
];

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
