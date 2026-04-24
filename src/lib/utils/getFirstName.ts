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

/**
 * Normalize a Firebase `displayName` to natural reading order.
 * Microsoft/Azure AD frequently returns "Last, First MI" — rewrite to
 * "First MI Last". Any value without a comma is returned unchanged.
 * Empty or missing input returns ''.
 */
export function normalizeDisplayName(
  displayName: string | null | undefined,
): string {
  const dn = (displayName ?? '').trim();
  if (!dn) return '';
  const commaIdx = dn.indexOf(',');
  if (commaIdx === -1) return dn;
  const last = dn.slice(0, commaIdx).trim();
  const firstAndMiddle = dn.slice(commaIdx + 1).trim();
  if (!last || !firstAndMiddle) return dn;
  return `${firstAndMiddle} ${last}`;
}
