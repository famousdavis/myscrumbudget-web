// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { ProjectMetrics, TrafficLightThresholds, TrafficLightStatus } from '@/types/domain';

export const DEFAULT_THRESHOLDS: TrafficLightThresholds = {
  amberPercent: 5,
  redPercent: 15,
  violetPercent: 20,
};

/**
 * Determine traffic-light status from project metrics.
 *
 * Uses variancePercent (positive = over budget):
 *   - Red:    variancePercent > redPercent
 *   - Amber:  amberPercent < variancePercent ≤ redPercent
 *   - Green:  -violetPercent ≤ variancePercent ≤ amberPercent (on or near budget)
 *   - Violet: variancePercent < -violetPercent (significantly under budget)
 */
export function getTrafficLightStatus(
  metrics: ProjectMetrics,
  thresholds: TrafficLightThresholds,
): TrafficLightStatus {
  const vp = metrics.variancePercent;
  // Order is safe: positive vp satisfies only red/amber checks; negative vp
  // can only satisfy the violet check. The two halves are mutually exclusive.
  if (vp > thresholds.redPercent) return 'red';
  if (vp > thresholds.amberPercent) return 'amber';
  if (vp < -thresholds.violetPercent) return 'violet';
  return 'green';
}

/**
 * Get display properties for a traffic-light status.
 * Returns color classes (with dark variants), a Unicode indicator,
 * and a text label for accessibility.
 */
export function getTrafficLightDisplay(status: TrafficLightStatus): {
  color: string;
  indicator: string;
  label: string;
} {
  switch (status) {
    case 'green':
      return {
        color: 'text-green-600 dark:text-green-400',
        indicator: '\u25CF',
        label: 'On Track',
      };
    case 'amber':
      return {
        color: 'text-amber-500 dark:text-amber-400',
        indicator: '\u25CF',
        label: 'At Risk',
      };
    case 'red':
      return {
        color: 'text-red-600 dark:text-red-400',
        indicator: '\u25CF',
        label: 'Over Budget',
      };
    case 'violet':
      return {
        color: 'text-violet-600 dark:text-violet-400',
        indicator: '\u25CF',
        label: 'Under Budget',
      };
  }
}
