// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Deep validation utilities for imported data
 * Validates nested structure to prevent silent data corruption
 */

// Type predicates below (isValidSettings, isValidProjectArray,
// isValidPoolMemberArray) correspond to the three top-level localStorage
// keys. Deep-validation functions further up the file intentionally accept
// `unknown` — they are the "is this imported JSON structurally valid" pass
// for the import flow and never claim the input IS the target type.
import type { Settings, Project, PoolMember } from '@/types/domain';
import { REFORECAST_NOTES_MAX_LENGTH } from '@/lib/constants';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function isString(val: unknown): val is string {
  return typeof val === 'string';
}

function isNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

function isNonNegativeNumber(val: unknown): val is number {
  return isNumber(val) && val >= 0;
}

function isValidAllocation(val: unknown): boolean {
  return isNumber(val) && val >= 0 && val <= 1;
}

function isValidDateString(val: unknown): boolean {
  if (!isString(val)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  // Verify the date is semantically valid (rejects e.g. 9999-99-99)
  const [y, m, d] = val.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function isValidMonthString(val: unknown): boolean {
  if (!isString(val)) return false;
  // YYYY-MM format
  return /^\d{4}-\d{2}$/.test(val);
}

function validateLaborRate(rate: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(rate)) {
    errors.push(`${path}: expected object`);
    return errors;
  }
  if (!isString(rate.role) || !rate.role.trim()) {
    errors.push(`${path}.role: expected non-empty string`);
  }
  if (!isNumber(rate.hourlyRate) || rate.hourlyRate < 0) {
    errors.push(`${path}.hourlyRate: expected non-negative number`);
  }
  return errors;
}

function validateHoliday(holiday: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(holiday)) {
    errors.push(`${path}: expected object`);
    return errors;
  }
  if (!isString(holiday.id)) {
    errors.push(`${path}.id: expected string`);
  }
  if (!isString(holiday.name) || !holiday.name.trim()) {
    errors.push(`${path}.name: expected non-empty string`);
  }
  if (!isValidDateString(holiday.startDate)) {
    errors.push(`${path}.startDate: expected YYYY-MM-DD date string`);
  }
  if (!isValidDateString(holiday.endDate)) {
    errors.push(`${path}.endDate: expected YYYY-MM-DD date string`);
  }
  return errors;
}

function validateSettings(settings: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(settings)) {
    errors.push(`${path}: expected object`);
    return errors;
  }

  if (!isNumber(settings.discountRateAnnual) || settings.discountRateAnnual < 0 || settings.discountRateAnnual > 1) {
    errors.push(`${path}.discountRateAnnual: expected number between 0 and 1`);
  }

  if (!Array.isArray(settings.laborRates)) {
    errors.push(`${path}.laborRates: expected array`);
  } else {
    settings.laborRates.forEach((rate, i) => {
      errors.push(...validateLaborRate(rate, `${path}.laborRates[${i}]`));
    });
  }

  if (!Array.isArray(settings.holidays)) {
    errors.push(`${path}.holidays: expected array`);
  } else {
    settings.holidays.forEach((holiday, i) => {
      errors.push(...validateHoliday(holiday, `${path}.holidays[${i}]`));
    });
  }

  if (!isObject(settings.trafficLightThresholds)) {
    errors.push(`${path}.trafficLightThresholds: expected object`);
  } else {
    const thresholds = settings.trafficLightThresholds;
    if (!isNonNegativeNumber(thresholds.amberPercent)) {
      errors.push(`${path}.trafficLightThresholds.amberPercent: expected non-negative number`);
    }
    if (!isNonNegativeNumber(thresholds.redPercent)) {
      errors.push(`${path}.trafficLightThresholds.redPercent: expected non-negative number`);
    }
    if (!isNonNegativeNumber(thresholds.violetPercent)) {
      errors.push(`${path}.trafficLightThresholds.violetPercent: expected non-negative number`);
    }
  }

  return errors;
}

function validatePoolMember(member: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(member)) {
    errors.push(`${path}: expected object`);
    return errors;
  }
  if (!isString(member.id)) {
    errors.push(`${path}.id: expected string`);
  }
  if (!isString(member.name) || !member.name.trim()) {
    errors.push(`${path}.name: expected non-empty string`);
  }
  if (!isString(member.role)) {
    errors.push(`${path}.role: expected string`);
  }
  if (member.archived !== undefined && typeof member.archived !== 'boolean') {
    errors.push(`${path}.archived: expected boolean`);
  }
  return errors;
}

function validateAssignment(assignment: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(assignment)) {
    errors.push(`${path}: expected object`);
    return errors;
  }
  if (!isString(assignment.id)) {
    errors.push(`${path}.id: expected string`);
  }
  if (!isString(assignment.poolMemberId)) {
    errors.push(`${path}.poolMemberId: expected string`);
  }
  return errors;
}

function validateAllocation(allocation: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(allocation)) {
    errors.push(`${path}: expected object`);
    return errors;
  }
  if (!isString(allocation.memberId)) {
    errors.push(`${path}.memberId: expected string`);
  }
  if (!isValidMonthString(allocation.month)) {
    errors.push(`${path}.month: expected YYYY-MM month string`);
  }
  if (!isValidAllocation(allocation.allocation)) {
    errors.push(`${path}.allocation: expected number between 0 and 1`);
  }
  return errors;
}

function validateHistoricalCostEntry(entry: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(entry)) {
    errors.push(`${path}: expected object`);
    return errors;
  }
  if (!isValidMonthString(entry.month)) {
    errors.push(`${path}.month: expected YYYY-MM month string`);
  }
  if (!isNonNegativeNumber(entry.cost)) {
    errors.push(`${path}.cost: expected non-negative number`);
  }
  if (!isNonNegativeNumber(entry.hours)) {
    errors.push(`${path}.hours: expected non-negative number`);
  }
  return errors;
}

function validateProductivityWindow(window: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(window)) {
    errors.push(`${path}: expected object`);
    return errors;
  }
  if (!isString(window.id)) {
    errors.push(`${path}.id: expected string`);
  }
  if (!isValidDateString(window.startDate)) {
    errors.push(`${path}.startDate: expected YYYY-MM-DD date string`);
  }
  if (!isValidDateString(window.endDate)) {
    errors.push(`${path}.endDate: expected YYYY-MM-DD date string`);
  }
  if (!isNumber(window.factor) || window.factor < 0 || window.factor > 1) {
    errors.push(`${path}.factor: expected number between 0 and 1`);
  }
  return errors;
}

function validateReforecast(reforecast: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(reforecast)) {
    errors.push(`${path}: expected object`);
    return errors;
  }
  if (!isString(reforecast.id)) {
    errors.push(`${path}.id: expected string`);
  }
  if (!isString(reforecast.name) || !reforecast.name.trim()) {
    errors.push(`${path}.name: expected non-empty string`);
  }
  if (!isString(reforecast.createdAt)) {
    errors.push(`${path}.createdAt: expected string`);
  }
  if (!isValidMonthString(reforecast.startDate)) {
    errors.push(`${path}.startDate: expected YYYY-MM month string`);
  }
  if (!isNonNegativeNumber(reforecast.actualCost)) {
    errors.push(`${path}.actualCost: expected non-negative number`);
  }
  if (!isNonNegativeNumber(reforecast.baselineBudget)) {
    errors.push(`${path}.baselineBudget: expected non-negative number`);
  }
  if (!isValidDateString(reforecast.reforecastDate)) {
    errors.push(`${path}.reforecastDate: expected YYYY-MM-DD date string`);
  }
  if (reforecast.actualsThroughDate !== undefined) {
    if (!isValidDateString(reforecast.actualsThroughDate)) {
      errors.push(`${path}.actualsThroughDate: expected YYYY-MM-DD date string`);
    }
  }
  if (reforecast.notes !== undefined) {
    if (!isString(reforecast.notes)) {
      errors.push(`${path}.notes: expected string`);
    } else if (reforecast.notes.length > REFORECAST_NOTES_MAX_LENGTH) {
      errors.push(`${path}.notes: exceeds max length of ${REFORECAST_NOTES_MAX_LENGTH} characters`);
    }
  }

  if (!Array.isArray(reforecast.allocations)) {
    errors.push(`${path}.allocations: expected array`);
  } else {
    reforecast.allocations.forEach((alloc, i) => {
      errors.push(...validateAllocation(alloc, `${path}.allocations[${i}]`));
    });
  }

  if (!Array.isArray(reforecast.productivityWindows)) {
    errors.push(`${path}.productivityWindows: expected array`);
  } else {
    reforecast.productivityWindows.forEach((win, i) => {
      errors.push(...validateProductivityWindow(win, `${path}.productivityWindows[${i}]`));
    });
  }

  if (!Array.isArray(reforecast.assignments)) {
    errors.push(`${path}.assignments: expected array`);
  } else {
    reforecast.assignments.forEach((a, i) => {
      errors.push(...validateAssignment(a, `${path}.assignments[${i}]`));
    });
  }

  if (reforecast.historicalCosts !== undefined && reforecast.historicalCosts !== null) {
    if (!Array.isArray(reforecast.historicalCosts)) {
      errors.push(`${path}.historicalCosts: expected array`);
    } else {
      reforecast.historicalCosts.forEach((entry, i) => {
        errors.push(...validateHistoricalCostEntry(entry, `${path}.historicalCosts[${i}]`));
      });
    }
  }

  return errors;
}

function validateProject(project: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(project)) {
    errors.push(`${path}: expected object`);
    return errors;
  }
  if (!isString(project.id)) {
    errors.push(`${path}.id: expected string`);
  }
  if (!isString(project.name) || !project.name.trim()) {
    errors.push(`${path}.name: expected non-empty string`);
  }
  if (!isValidDateString(project.startDate)) {
    errors.push(`${path}.startDate: expected YYYY-MM-DD date string`);
  }
  if (!isValidDateString(project.endDate)) {
    errors.push(`${path}.endDate: expected YYYY-MM-DD date string`);
  }
  if (!isString(project.activeReforecastId)) {
    errors.push(`${path}.activeReforecastId: expected string`);
  }

  if (!Array.isArray(project.reforecasts)) {
    errors.push(`${path}.reforecasts: expected array`);
  } else if (project.reforecasts.length === 0) {
    errors.push(`${path}.reforecasts: expected at least one reforecast`);
  } else {
    project.reforecasts.forEach((rf, i) => {
      errors.push(...validateReforecast(rf, `${path}.reforecasts[${i}]`));
    });
  }

  return errors;
}

/**
 * Validates the full AppState structure after migration
 * Returns validation errors if any nested structure is malformed
 */
export function validateAppState(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(data)) {
    return { valid: false, errors: ['Root: expected object'] };
  }

  if (!isString(data.version)) {
    errors.push('version: expected string');
  }

  errors.push(...validateSettings(data.settings, 'settings'));

  if (!Array.isArray(data.teamPool)) {
    errors.push('teamPool: expected array');
  } else {
    data.teamPool.forEach((member, i) => {
      errors.push(...validatePoolMember(member, `teamPool[${i}]`));
    });
  }

  if (!Array.isArray(data.projects)) {
    errors.push('projects: expected array');
  } else {
    data.projects.forEach((project, i) => {
      errors.push(...validateProject(project, `projects[${i}]`));
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Lenient type guard for Settings (localStorage reads)
 * Only checks basic shape - allows missing optional fields for backwards compatibility
 */
export function isValidSettings(val: unknown): val is Settings {
  if (!isObject(val)) return false;
  // Only check required structural elements, not all fields
  // This allows older data without trafficLightThresholds to pass
  if (typeof val.discountRateAnnual !== 'number') return false;
  if (!Array.isArray(val.laborRates)) return false;
  return true;
}

/**
 * Lenient type guard for Project array (localStorage reads)
 * Only checks that it's an array of objects with basic project shape
 */
export function isValidProjectArray(val: unknown): val is Project[] {
  if (!Array.isArray(val)) return false;
  // Only check basic shape - allows partial data
  return val.every((p) => {
    if (!isObject(p)) return false;
    if (!isString(p.id)) return false;
    if (!isString(p.name)) return false;
    return true;
  });
}

/**
 * Lenient type guard for PoolMember array (localStorage reads)
 * Only checks basic shape
 */
export function isValidPoolMemberArray(val: unknown): val is PoolMember[] {
  if (!Array.isArray(val)) return false;
  return val.every((m) => {
    if (!isObject(m)) return false;
    if (!isString(m.id)) return false;
    if (!isString(m.name)) return false;
    return true;
  });
}
