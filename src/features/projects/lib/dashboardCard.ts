// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Project } from '@/types/domain';
import { generateId } from '@/lib/utils/id';
import { REFORECAST_STALE_DAYS } from '@/lib/constants';

const COPY_SUFFIX_RE = /^(.*) - Copy \(\d+\)$/;
const NAME_MAX_LENGTH = 150; // matches the project-name input maxLength

/**
 * Compute the next "<base> - Copy (N)" name for a clone.
 *
 * - Strips an existing " - Copy (N)" suffix from the source name so cloning a
 *   clone yields "Foo - Copy (2)", not "Foo - Copy (1) - Copy (1)".
 * - Picks the smallest N >= 1 whose resulting name is not already taken
 *   (case-sensitive exact match against `existingNames`).
 * - Clamps to the 150-char project-name limit.
 *
 * Pure — no I/O, no Date/random.
 */
export function nextCopyName(sourceName: string, existingNames: string[]): string {
  const match = COPY_SUFFIX_RE.exec(sourceName);
  const base = (match ? match[1] : sourceName).trim();
  const taken = new Set(existingNames);
  let n = 1;
  let candidate = `${base} - Copy (${n})`;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${base} - Copy (${n})`;
  }
  return candidate.length > NAME_MAX_LENGTH ? candidate.slice(0, NAME_MAX_LENGTH) : candidate;
}

/**
 * Produce a deep clone of a project with a fresh project id and the given name.
 *
 * Internal ids (reforecast / assignment / allocation memberId / productivity
 * window ids) are INTENTIONALLY preserved: they are project-scoped, so duplicating
 * them in a separate project causes no collision, and keeping them preserves the
 * allocation ↔ assignment linkage (allocations key on assignment id) without any
 * re-keying gymnastics. The optional `color` is carried over. `archived` is
 * INTENTIONALLY dropped — a clone of an archived project is always born active;
 * the source project is left untouched. Pure — uses a JSON round-trip for the
 * deep copy (Project is plain JSON: no Dates/functions/Maps).
 */
export function cloneProjectData(source: Project, newName: string): Project {
  const deep = JSON.parse(JSON.stringify(source)) as Project;
  deep.id = generateId();
  deep.name = newName;
  delete deep.archived;
  return deep;
}

/**
 * Whether the most-recent reforecast date is "stale" — older than the threshold
 * (default 30 days) relative to `today`. Both args are YYYY-MM-DD. A
 * future-dated reforecast (date > today) is never stale. Pure.
 */
export function isReforecastStale(
  reforecastDate: string | undefined,
  today: string,
  thresholdDays: number = REFORECAST_STALE_DAYS,
): boolean {
  if (!reforecastDate) return false;
  const rf = Date.parse(`${reforecastDate}T00:00:00`);
  const now = Date.parse(`${today}T00:00:00`);
  if (Number.isNaN(rf) || Number.isNaN(now)) return false;
  const days = Math.floor((now - rf) / 86_400_000);
  return days > thresholdDays;
}

/**
 * Which empty-state branch the Dashboard should render. Pure — no I/O.
 * Separated from the component so the branching logic is unit-testable
 * without mounting the page or mocking its data hooks.
 *
 * - 'onboarding'          → no projects at all (Getting Started checklist)
 * - 'no-visible-projects' → projects exist but all are filtered out (every
 *                           project archived while "Show archived" is off)
 * - 'has-projects'        → render the grid
 */
export function getDashboardEmptyState(
  totalCount: number,
  visibleCount: number,
): 'onboarding' | 'no-visible-projects' | 'has-projects' {
  if (totalCount === 0) return 'onboarding';
  if (visibleCount === 0) return 'no-visible-projects';
  return 'has-projects';
}
