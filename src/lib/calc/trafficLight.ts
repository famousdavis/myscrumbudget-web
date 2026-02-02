import type { ProjectMetrics, TrafficLightThresholds, TrafficLightStatus } from '@/types/domain';

export const DEFAULT_THRESHOLDS: TrafficLightThresholds = {
  amberPercent: 5,
  redPercent: 15,
};

/**
 * Determine traffic-light status from project metrics.
 *
 * Uses variancePercent (positive = over budget):
 *   - Green: variancePercent <= amberPercent
 *   - Amber: variancePercent > amberPercent AND <= redPercent
 *   - Red:   variancePercent > redPercent
 *
 * Projects under budget (negative variancePercent) are always Green.
 */
export function getTrafficLightStatus(
  metrics: ProjectMetrics,
  thresholds: TrafficLightThresholds,
): TrafficLightStatus {
  const vp = metrics.variancePercent;
  if (vp > thresholds.redPercent) return 'red';
  if (vp > thresholds.amberPercent) return 'amber';
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
  }
}
