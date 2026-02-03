import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber, formatPercentValue, formatDateSlash, formatDateLong, formatDateMedium } from '../format';

describe('formatCurrency', () => {
  it('formats positive integers without cents by default', () => {
    expect(formatCurrency(1000)).toBe('$1,000');
    expect(formatCurrency(1234567)).toBe('$1,234,567');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('rounds to whole dollars by default', () => {
    expect(formatCurrency(1234.56)).toBe('$1,235');
    expect(formatCurrency(1234.4)).toBe('$1,234');
  });

  it('shows cents when showCents is true', () => {
    expect(formatCurrency(1234.56, true)).toBe('$1,234.56');
    expect(formatCurrency(1000, true)).toBe('$1,000.00');
  });

  it('formats negative values', () => {
    expect(formatCurrency(-500)).toBe('-$500');
  });

  it('formats large values with comma separators', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000');
  });
});

describe('formatNumber', () => {
  it('formats with zero decimals by default', () => {
    expect(formatNumber(1234.567)).toBe('1,235');
    expect(formatNumber(1000)).toBe('1,000');
  });

  it('formats with specified decimal places', () => {
    expect(formatNumber(1234.5, 2)).toBe('1,234.50');
    expect(formatNumber(1234.567, 1)).toBe('1,234.6');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('formats negative numbers', () => {
    expect(formatNumber(-1234)).toBe('-1,234');
  });
});

describe('formatPercentValue', () => {
  it('formats a positive percentage with 1 decimal by default', () => {
    expect(formatPercentValue(10.5)).toBe('10.5%');
  });

  it('formats zero', () => {
    expect(formatPercentValue(0)).toBe('0.0%');
  });

  it('formats negative percentages', () => {
    expect(formatPercentValue(-3.2)).toBe('-3.2%');
  });

  it('respects custom decimal places', () => {
    expect(formatPercentValue(10.567, 2)).toBe('10.57%');
    expect(formatPercentValue(10.567, 0)).toBe('11%');
  });

  it('does NOT multiply by 100 (unlike a ratio-to-percent formatter)', () => {
    // 50 → "50.0%", NOT "5000.0%"
    expect(formatPercentValue(50)).toBe('50.0%');
  });
});

/* ── Date formatting ─────────────────────────────────────────────── */

describe('formatDateSlash', () => {
  it('formats YYYY-MM-DD as MM/DD/YYYY', () => {
    expect(formatDateSlash('2026-01-15')).toBe('01/15/2026');
    expect(formatDateSlash('2026-12-25')).toBe('12/25/2026');
  });
});

describe('formatDateLong', () => {
  it('formats as full long date (e.g. "January 15, 2026")', () => {
    expect(formatDateLong('2026-01-15')).toBe('January 15, 2026');
    expect(formatDateLong('2026-12-25')).toBe('December 25, 2026');
  });
});

describe('formatDateMedium', () => {
  it('formats as medium date (e.g. "Jan 15, 2026")', () => {
    expect(formatDateMedium('2026-01-15')).toBe('Jan 15, 2026');
    expect(formatDateMedium('2026-12-25')).toBe('Dec 25, 2026');
  });
});
