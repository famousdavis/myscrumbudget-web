// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

export const APP_VERSION = '0.37.4';
export const APP_NAME = 'MyScrumBudget';
export const APP_DESCRIPTION = 'Scrum project budget forecasting tool';
export const HOURS_PER_DAY = 8;
export const REFORECAST_NOTES_MAX_LENGTH = 2000;
export const UNDO_STACK_LIMIT = 50;
/**
 * Dashboard project tiles flag the most-recent reforecast date in amber once it
 * is older than this many days (v0.33.0).
 */
export const REFORECAST_STALE_DAYS = 30;

// Resource Plan Excel I/O
export const RESOURCE_PLAN_SHEET_NAME = 'Resource Plan';
export const RESOURCE_PLAN_META_SHEET_NAME = '_msb_meta';
export const UNKNOWN_ROLE = 'Unknown';
