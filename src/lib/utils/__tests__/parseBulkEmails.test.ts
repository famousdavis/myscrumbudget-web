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
