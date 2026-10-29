// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Reforecast } from '@/types/domain';
import { MAX_FORECAST_MONTHS } from '@/lib/constants';
import { isWindowClamped } from '@/lib/utils/dates';

const YEARS = MAX_FORECAST_MONTHS / 12;

/**
 * Says, for as long as the figures are on screen, that they cover only the
 * first part of a reforecast window longer than the app calculates (v0.44.6).
 * Renders nothing for any other window.
 */
export function ForecastWindowNotice({ reforecast }: { reforecast: Reforecast | null | undefined }) {
  if (!reforecast || !isWindowClamped(reforecast.startDate, reforecast.endDate)) return null;
  return (
    <div role="status" className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      This reforecast covers more than {YEARS} years. The figures, charts and grid cover only its first {YEARS} years; its stored dates and allocations are unchanged.
    </div>
  );
}

/** The dashboard card's short form of the same notice. */
export function ForecastWindowMarker({ reforecast }: { reforecast: Reforecast | null | undefined }) {
  if (!reforecast || !isWindowClamped(reforecast.startDate, reforecast.endDate)) return null;
  return (
    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400" title={`Figures cover only the first ${YEARS} years of this reforecast`}>
      First {YEARS} years only
    </p>
  );
}
