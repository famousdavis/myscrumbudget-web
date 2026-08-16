// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Shape shared with the legacy single-email path, so a token rejected here is
// rejected there too. (That path's own `EMAIL_RE` in sharing.ts was deleted in
// v0.28.2 along with the unbounded profiles query; this is now the only copy.)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Longest token `parseBulkEmails` will run `EMAIL_RE` against.
 *
 * ⚠️ WHY 320 AND NOT 254. RFC 5321's practical maximum for a whole address is
 * 254 characters (RFC 3696 erratum 1690); 320 is the looser 64 local + 1 `@` +
 * 255 domain figure. The looser bound is deliberate — the cap must not reject an
 * address that ANY reading of the spec calls legal, and 66 characters of
 * headroom costs nothing measurable (below). Do NOT "tighten" this to 254: that
 * would start rejecting edge-case-legal addresses to save 0.01 ms.
 *
 * ⚠️ WHY A CAP AT ALL — AND THE TRIGGER, WITHOUT WHICH YOU WILL MEASURE THIS AS
 * LINEAR AND DELETE THE GUARD. `EMAIL_RE` is quadratic on one specific shape: a
 * dot-rich run followed by a TRAILING `@`. The tail can only fail when `$`
 * fails, and that requires a later `@` — the one character the class `[^\s@]`
 * excludes — so the engine backtracks across every split point.
 *
 *   measured 2026-08-16, Node 24:
 *     'a@' + 'a.'x32000 + '@'   (64 KB, WITH the trailing @)   1117 ms
 *     'a@' + 'a.'x32000         (64 KB, WITHOUT it)               0.02 ms
 *                                                        ~14,000x apart
 *
 * ⚠️ Drop the trailing `@` and you WILL measure linear on every obvious
 * adversarial shape — long local part, all dots, plain long string — and
 * conclude this cap is unnecessary. It is not. At the cap the worst case is
 * 0.0358 ms per distinct token, ~31,000x below the unbounded figure above.
 *
 * ⚠️ THE CAP IS PER TOKEN, INSIDE THE LOOP — never on `raw.length` before the
 * split. The cost is per token: 64 KB of short tokens is fine; ONE 64 KB token
 * is 1.1 s. A `raw.length` guard looks correct, passes any test written against
 * total input size, and leaves the failure mode wide open.
 */
const MAX_TOKEN_LENGTH = 320;

/**
 * Splits a bulk-input string on whitespace, commas, and semicolons,
 * trims each token, and partitions into valid and invalid emails.
 *
 * Returns BOTH arrays — never `string[]` alone. Callers need invalid
 * tokens for "invalid-format" chips (Lesson 42).
 *
 * An over-length token is partitioned as INVALID, never dropped. This is a
 * paste-a-list-of-collaborators surface: a silently discarded address is a
 * collaborator who is never invited, with nothing on screen to say so. As
 * `invalid` it renders an amber "Invalid" chip and the textarea keeps its
 * contents for correction.
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
    if (token.length > MAX_TOKEN_LENGTH) {
      // Rejected WITHOUT running EMAIL_RE — that call is the quadratic one.
      invalid.push(token);
    } else if (EMAIL_RE.test(token)) {
      valid.push(token);
    } else {
      invalid.push(token);
    }
  }

  return { valid, invalid };
}
