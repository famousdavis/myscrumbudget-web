import { describe, it, expect } from 'vitest';
import { getTrafficLightStatus, getTrafficLightDisplay, DEFAULT_THRESHOLDS } from '../trafficLight';
import type { ProjectMetrics, TrafficLightThresholds } from '@/types/domain';

function makeMetrics(variancePercent: number): ProjectMetrics {
  return {
    etc: 0,
    eac: 0,
    variance: 0,
    variancePercent,
    budgetRatio: 0,
    weeklyBurnRate: 0,
    npv: 0,
    totalHours: 0,
    monthlyData: [],
  };
}

describe('getTrafficLightStatus', () => {
  const thresholds = DEFAULT_THRESHOLDS; // { amberPercent: 5, redPercent: 15 }

  it('returns green when under budget (negative variance%)', () => {
    expect(getTrafficLightStatus(makeMetrics(-10), thresholds)).toBe('green');
  });

  it('returns green when on budget (0%)', () => {
    expect(getTrafficLightStatus(makeMetrics(0), thresholds)).toBe('green');
  });

  it('returns green at exactly the amber threshold', () => {
    expect(getTrafficLightStatus(makeMetrics(5), thresholds)).toBe('green');
  });

  it('returns amber just above the amber threshold', () => {
    expect(getTrafficLightStatus(makeMetrics(5.1), thresholds)).toBe('amber');
  });

  it('returns amber at exactly the red threshold', () => {
    expect(getTrafficLightStatus(makeMetrics(15), thresholds)).toBe('amber');
  });

  it('returns red just above the red threshold', () => {
    expect(getTrafficLightStatus(makeMetrics(15.1), thresholds)).toBe('red');
  });

  it('returns red for large over-budget', () => {
    expect(getTrafficLightStatus(makeMetrics(50), thresholds)).toBe('red');
  });

  it('respects custom thresholds', () => {
    const custom: TrafficLightThresholds = { amberPercent: 10, redPercent: 25 };
    expect(getTrafficLightStatus(makeMetrics(8), custom)).toBe('green');
    expect(getTrafficLightStatus(makeMetrics(12), custom)).toBe('amber');
    expect(getTrafficLightStatus(makeMetrics(30), custom)).toBe('red');
  });

  it('handles zero amber threshold (any positive variance is amber or red)', () => {
    const zeroAmber: TrafficLightThresholds = { amberPercent: 0, redPercent: 10 };
    expect(getTrafficLightStatus(makeMetrics(0), zeroAmber)).toBe('green');
    expect(getTrafficLightStatus(makeMetrics(0.1), zeroAmber)).toBe('amber');
    expect(getTrafficLightStatus(makeMetrics(10.1), zeroAmber)).toBe('red');
  });

  it('handles equal amber and red thresholds (no amber band)', () => {
    const equal: TrafficLightThresholds = { amberPercent: 10, redPercent: 10 };
    expect(getTrafficLightStatus(makeMetrics(10), equal)).toBe('green');
    expect(getTrafficLightStatus(makeMetrics(10.1), equal)).toBe('red');
  });
});

describe('getTrafficLightDisplay', () => {
  it('returns green display properties', () => {
    const d = getTrafficLightDisplay('green');
    expect(d.label).toBe('On Track');
    expect(d.color).toContain('green');
    expect(d.indicator).toBe('\u25CF');
  });

  it('returns amber display properties', () => {
    const d = getTrafficLightDisplay('amber');
    expect(d.label).toBe('At Risk');
    expect(d.color).toContain('amber');
    expect(d.indicator).toBe('\u25CF');
  });

  it('returns red display properties', () => {
    const d = getTrafficLightDisplay('red');
    expect(d.label).toBe('Over Budget');
    expect(d.color).toContain('red');
    expect(d.indicator).toBe('\u25CF');
  });
});

describe('DEFAULT_THRESHOLDS', () => {
  it('has expected default values', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({
      amberPercent: 5,
      redPercent: 15,
    });
  });
});
