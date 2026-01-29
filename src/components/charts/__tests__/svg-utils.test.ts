import { describe, it, expect } from 'vitest';
import { createLinearScale, computeNiceTicks, formatAxisValue } from '../svg-utils';

describe('createLinearScale', () => {
  it('maps domain boundaries to range boundaries', () => {
    const scale = createLinearScale([0, 100], [0, 200]);
    expect(scale(0)).toBe(0);
    expect(scale(100)).toBe(200);
  });

  it('interpolates mid-range values', () => {
    const scale = createLinearScale([0, 100], [0, 200]);
    expect(scale(50)).toBe(100);
    expect(scale(25)).toBe(50);
  });

  it('handles inverted ranges (SVG y-axis)', () => {
    const scale = createLinearScale([0, 100], [200, 0]);
    expect(scale(0)).toBe(200);
    expect(scale(100)).toBe(0);
    expect(scale(50)).toBe(100);
  });

  it('handles zero-width domain', () => {
    const scale = createLinearScale([50, 50], [0, 200]);
    expect(scale(50)).toBe(100); // midpoint of range
  });

  it('handles values outside domain', () => {
    const scale = createLinearScale([0, 100], [0, 200]);
    expect(scale(-50)).toBe(-100);
    expect(scale(150)).toBe(300);
  });
});

describe('computeNiceTicks', () => {
  it('returns single tick for equal min/max', () => {
    const ticks = computeNiceTicks(5, 5);
    expect(ticks).toEqual([5]);
  });

  it('produces reasonable number of ticks', () => {
    const ticks = computeNiceTicks(0, 100_000, 5);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeLessThanOrEqual(12);
  });

  it('starts at or below min and ends at or above max', () => {
    const ticks = computeNiceTicks(3, 97, 5);
    expect(ticks[0]).toBeLessThanOrEqual(3);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(97);
  });

  it('produces evenly spaced ticks', () => {
    const ticks = computeNiceTicks(0, 1000, 5);
    if (ticks.length > 1) {
      const step = ticks[1] - ticks[0];
      for (let i = 2; i < ticks.length; i++) {
        expect(ticks[i] - ticks[i - 1]).toBeCloseTo(step, 5);
      }
    }
  });

  it('handles small ranges', () => {
    const ticks = computeNiceTicks(0, 10, 5);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(10);
  });

  it('handles large ranges', () => {
    const ticks = computeNiceTicks(0, 1_500_000, 5);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(1_500_000);
  });
});

describe('formatAxisValue', () => {
  it('formats zero', () => {
    expect(formatAxisValue(0)).toBe('$0');
  });

  it('formats small values without abbreviation', () => {
    expect(formatAxisValue(500)).toBe('$500');
  });

  it('abbreviates thousands', () => {
    expect(formatAxisValue(1_000)).toBe('$1K');
    expect(formatAxisValue(1_500)).toBe('$1.5K');
    expect(formatAxisValue(150_000)).toBe('$150K');
  });

  it('abbreviates millions', () => {
    expect(formatAxisValue(1_000_000)).toBe('$1M');
    expect(formatAxisValue(1_200_000)).toBe('$1.2M');
    expect(formatAxisValue(2_500_000)).toBe('$2.5M');
  });

  it('handles negative values', () => {
    expect(formatAxisValue(-5_000)).toBe('-$5K');
    expect(formatAxisValue(-1_200_000)).toBe('-$1.2M');
  });
});
