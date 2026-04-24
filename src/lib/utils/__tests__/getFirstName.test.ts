// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { getFirstName, normalizeDisplayName } from '../getFirstName';

describe('getFirstName', () => {
  it('extracts first name from "Last, First" (Microsoft SSO)', () => {
    expect(getFirstName('Smith, Jane', 'jane@example.com')).toBe('Jane');
  });

  it('extracts first name from "First Last" (Google)', () => {
    expect(getFirstName('Jane Smith', 'jane@example.com')).toBe('Jane');
  });

  it('handles single-name displayName', () => {
    expect(getFirstName('Jane', 'jane@example.com')).toBe('Jane');
  });

  it('falls back to email when displayName is empty', () => {
    expect(getFirstName('', 'jane@example.com')).toBe('jane@example.com');
  });

  it('falls back to email when displayName is null', () => {
    expect(getFirstName(null, 'jane@example.com')).toBe('jane@example.com');
  });

  it('falls back to email when displayName is undefined', () => {
    expect(getFirstName(undefined, 'jane@example.com')).toBe('jane@example.com');
  });

  it('returns empty string when both inputs are null', () => {
    expect(getFirstName(null, null)).toBe('');
  });

  it('returns empty string when both inputs are undefined', () => {
    expect(getFirstName(undefined, undefined)).toBe('');
  });

  it('handles "Last, First Middle" by returning only First', () => {
    expect(getFirstName('Smith, Jane Middle', 'jane@x')).toBe('Jane');
  });

  it('trims whitespace around the first-of-comma segment', () => {
    expect(getFirstName('Smith,  Jane', 'jane@x')).toBe('Jane');
  });
});

describe('normalizeDisplayName', () => {
  it('rewrites "Last, First MI" to "First MI Last"', () => {
    expect(normalizeDisplayName('Davis, William W')).toBe('William W Davis');
  });

  it('rewrites "Last, First" to "First Last"', () => {
    expect(normalizeDisplayName('Smith, Jane')).toBe('Jane Smith');
  });

  it('passes through Google-style "First Last" unchanged', () => {
    expect(normalizeDisplayName('Jane Smith')).toBe('Jane Smith');
  });

  it('passes through single-name displayName unchanged', () => {
    expect(normalizeDisplayName('Jane')).toBe('Jane');
  });

  it('returns empty string for null input', () => {
    expect(normalizeDisplayName(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(normalizeDisplayName(undefined)).toBe('');
  });

  it('returns empty string for empty string input', () => {
    expect(normalizeDisplayName('')).toBe('');
  });

  it('trims whitespace around each segment', () => {
    expect(normalizeDisplayName('Davis ,  William W')).toBe('William W Davis');
  });

  it('returns the original value when last or first segment is empty', () => {
    expect(normalizeDisplayName(', William')).toBe(', William');
    expect(normalizeDisplayName('Davis,')).toBe('Davis,');
  });
});
