// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Firestore collection names for MyScrumBudget.
 * Shared across firestoreRepo, useCloudSync, and sharing modules.
 */
export const PROJECTS_COL = 'myscrumbudget_projects';
export const SETTINGS_COL = 'myscrumbudget_settings';
export const PROFILES_COL = 'myscrumbudget_profiles';

/**
 * Suite-wide collections (shared across all SPERT apps).
 * Used by the bulk invitation system.
 */
export const SUITE_PROFILES_COL    = 'spertsuite_profiles';
export const SUITE_INVITATIONS_COL = 'spertsuite_invitations';
