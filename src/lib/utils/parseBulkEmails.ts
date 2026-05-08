// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Same shape used by sharing.ts EMAIL_RE — kept consistent so a token rejected
// here is also rejected by the legacy single-email path.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Splits a bulk-input string on whitespace, commas, and semicolons,
 * trims each token, and partitions into valid and invalid emails.
 *
 * Returns BOTH arrays — never `string[]` alone. Callers need invalid
 * tokens for "invalid-format" chips (Lesson 42).
 */
export function parseBulkEmails(raw: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  // Split on whitespace, commas, semicolons. Filter empty tokens.
  const tokens = raw.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean);

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (seen.has(lower)) continue; // dedupe — case-insensitive
    seen.add(lower);
    if (EMAIL_RE.test(token)) {
      valid.push(token);
    } else {
      invalid.push(token);
    }
  }

  return { valid, invalid };
}
