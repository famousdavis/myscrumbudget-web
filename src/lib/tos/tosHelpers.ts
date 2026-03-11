// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { TOS_VERSION, TOS_STORAGE_KEY } from './tosConstants';

/**
 * Read the accepted ToS version from localStorage.
 * Returns null if missing or on SSR.
 */
export function getTosAcceptedVersion(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOS_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Write the accepted ToS version to localStorage.
 */
export function setTosAcceptedVersion(version: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOS_STORAGE_KEY, version);
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * Returns true if the stored ToS version matches the current TOS_VERSION.
 */
export function isTosAccepted(): boolean {
  return getTosAcceptedVersion() === TOS_VERSION;
}
