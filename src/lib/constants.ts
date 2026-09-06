// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

export const APP_VERSION = '0.37.24';
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

/**
 * Deep link from the Dashboard's Getting Started step 1 to the Settings Labor
 * Rate Table (v0.37.16). `RateTable` reads the param on arrival, opens itself,
 * and marks step 1 reviewed.
 *
 * ⚠️ THE HREF IS BUILT FROM THE OTHER TWO SO THE PRODUCER AND THE CONSUMER
 * CANNOT DRIFT. The Dashboard writes the link and `RateTable` parses it; before
 * v0.37.16 the link was a bare `/settings` and the step could never complete, so
 * a silent disagreement between the two halves reproduces exactly that defect
 * with nothing on screen to say so. They live here — a leaf module — rather than
 * being exported from `RateTable`, so the Dashboard route does not pull that
 * component into its bundle for a string.
 */
export const SETTINGS_SECTION_PARAM = 'section';
export const RATES_SECTION_VALUE = 'rates';
export const RATES_DEEP_LINK = `/settings?${SETTINGS_SECTION_PARAM}=${RATES_SECTION_VALUE}`;

// Resource Plan Excel I/O
export const RESOURCE_PLAN_SHEET_NAME = 'Resource Plan';
export const RESOURCE_PLAN_META_SHEET_NAME = '_msb_meta';
export const UNKNOWN_ROLE = 'Unknown';
