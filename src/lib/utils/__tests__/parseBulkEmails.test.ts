// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { parseBulkEmails } from '../parseBulkEmails';

describe('parseBulkEmails', () => {
  it('returns single valid email', () => {
    expect(parseBulkEmails('a@b.com')).toEqual({ valid: ['a@b.com'], invalid: [] });
  });

  it('returns empty arrays for empty input', () => {
    expect(parseBulkEmails('')).toEqual({ valid: [], invalid: [] });
  });

  it('partitions mixed valid + invalid', () => {
    const r = parseBulkEmails('a@b.com notanemail c@d.com');
    expect(r.valid).toEqual(['a@b.com', 'c@d.com']);
    expect(r.invalid).toEqual(['notanemail']);
  });

  it('handles all-invalid input', () => {
    const r = parseBulkEmails('foo bar baz');
    expect(r.valid).toEqual([]);
    expect(r.invalid).toEqual(['foo', 'bar', 'baz']);
  });

  it('splits on commas', () => {
    expect(parseBulkEmails('a@b.com,c@d.com').valid).toEqual(['a@b.com', 'c@d.com']);
  });

  it('splits on semicolons', () => {
    expect(parseBulkEmails('a@b.com;c@d.com').valid).toEqual(['a@b.com', 'c@d.com']);
  });

  it('splits on newlines', () => {
    expect(parseBulkEmails('a@b.com\nc@d.com').valid).toEqual(['a@b.com', 'c@d.com']);
  });

  it('splits on mixed delimiters', () => {
    const r = parseBulkEmails('a@b.com, c@d.com;e@f.com\ng@h.com');
    expect(r.valid).toEqual(['a@b.com', 'c@d.com', 'e@f.com', 'g@h.com']);
  });

  it('dedupes case-insensitively', () => {
    const r = parseBulkEmails('A@B.com a@b.com A@B.COM');
    expect(r.valid).toEqual(['A@B.com']); // first occurrence wins; case preserved
    expect(r.invalid).toEqual([]);
  });

  it('does not include empty tokens from trailing/repeated delimiters', () => {
    const r = parseBulkEmails(' a@b.com,, ; ;c@d.com ');
    expect(r.valid).toEqual(['a@b.com', 'c@d.com']);
    expect(r.invalid).toEqual([]);
  });
});

describe('parseBulkEmails — token length cap', () => {
  // The cap exists to bound a quadratic in EMAIL_RE. These pin the BEHAVIOUR it
  // implies, which is a real partition change: a structurally-valid token longer
  // than the cap used to be returned as VALID.
  const MAX = 320;

  it('accepts an address at the RFC 5321 maximum (254 chars)', () => {
    // Positive control. 64-char local part + @ + 189-char domain = 254.
    const local = 'a'.repeat(64);
    const domain = `${'b'.repeat(61)}.${'c'.repeat(61)}.${'d'.repeat(61)}.com`;
    const addr = `${local}@${domain}`;
    expect(addr).toHaveLength(254);
    const { valid, invalid } = parseBulkEmails(addr);
    expect(valid).toEqual([addr]);
    expect(invalid).toEqual([]);
  });

  it('accepts a token at exactly the cap and rejects one character more', () => {
    // Exact-boundary twins: without these, `>` could become `>=` unnoticed.
    const at = `${'a'.repeat(MAX - 12)}@example.com`;
    const over = `${'a'.repeat(MAX - 11)}@example.com`;
    expect(at).toHaveLength(MAX);
    expect(over).toHaveLength(MAX + 1);
    expect(parseBulkEmails(at).valid).toEqual([at]);
    expect(parseBulkEmails(over).valid).toEqual([]);
    expect(parseBulkEmails(over).invalid).toEqual([over]);
  });

  it('routes an over-cap token to invalid rather than DROPPING it', () => {
    // The load-bearing half. On a paste-a-list surface a silently discarded
    // address is a collaborator who is never invited, with nothing on screen.
    const over = `${'a'.repeat(400)}@example.com`;
    const { valid, invalid } = parseBulkEmails(`good@example.com, ${over}, other@example.com`);
    expect(valid).toEqual(['good@example.com', 'other@example.com']);
    expect(invalid).toEqual([over]);
    // Nothing vanishes: every input token is accounted for in one partition.
    expect(valid.length + invalid.length).toBe(3);
  });

  it('rejects the adversarial shape without paying for it', () => {
    // 'a@' + 'a.'xN + '@' — a dot-rich run with a TRAILING @. Unbounded this is
    // ~1.1 s at 64 KB; the cap rejects it on length before EMAIL_RE ever runs.
    const attack = `a@${'a.'.repeat(32000)}@`;
    const started = performance.now();
    const { valid, invalid } = parseBulkEmails(attack);
    const elapsed = performance.now() - started;
    expect(valid).toEqual([]);
    expect(invalid).toEqual([attack]);
    // Generous bound: the point is orders of magnitude, not a stopwatch.
    expect(elapsed).toBeLessThan(100);
  });
});

