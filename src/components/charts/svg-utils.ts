/**
 * Pure utility functions for SVG chart math.
 * No React dependencies — easily testable.
 */

/* Shared chart layout constants */
export const CHART_WIDTH = 700;
export const CHART_HEIGHT = 240;
export const MARGIN = { top: 16, right: 16, bottom: 40, left: 60 };
export const PLOT_W = CHART_WIDTH - MARGIN.left - MARGIN.right;
export const PLOT_H = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

/** Returns a mapping function from domain → range (linear interpolation). */
export function createLinearScale(
  domain: [number, number],
  range: [number, number],
): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const domainSpan = d1 - d0;
  if (domainSpan === 0) return () => (r0 + r1) / 2;
  const scale = (r1 - r0) / domainSpan;
  return (value: number) => r0 + (value - d0) * scale;
}

/**
 * Compute "nice" tick values for an axis.
 * Returns evenly spaced values that are multiples of a round number.
 */
export function computeNiceTicks(
  min: number,
  max: number,
  targetCount = 5,
): number[] {
  if (min === max) return [min];
  if (targetCount < 2) targetCount = 2;

  const range = max - min;
  const rawStep = range / targetCount;

  // Find a "nice" step: 1, 2, 5, 10, 20, 50, ...
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let niceStep: number;
  if (residual <= 1.5) niceStep = magnitude;
  else if (residual <= 3.5) niceStep = 2 * magnitude;
  else if (residual <= 7.5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;

  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;

  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + niceStep * 0.01; v += niceStep) {
    ticks.push(Math.round(v * 1e10) / 1e10); // avoid fp drift
  }
  return ticks;
}

/**
 * Format a numeric value for axis labels.
 * $0 → "$0", $1,500 → "$1.5K", $1,200,000 → "$1.2M"
 */
export function formatAxisValue(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs === 0) return '$0';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  return `${sign}$${abs}`;
}
