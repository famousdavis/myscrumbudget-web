// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Extract a first name from a Firebase `displayName`, with fallback to email.
 * Handles two common formats:
 *   - Microsoft SSO: "Last, First" → "First"
 *   - Google: "First Last" → "First"
 * If displayName is empty or missing, returns the email, or '' if both are absent.
 */
export function getFirstName(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
  const dn = displayName ?? '';
  if (dn.includes(',')) {
    return dn.split(',')[1]?.trim().split(' ')[0] || email || '';
  }
  return dn.split(' ')[0] || email || '';
}
