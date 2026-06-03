// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { ProjectColor } from '@/types/domain';

/**
 * Dashboard tile tint palette (v0.33.0).
 *
 * The keys deliberately AVOID the traffic-light status hues
 * (red / amber / green / violet) so a user's personal organizing tint can never
 * be visually mistaken for a project-health indicator.
 *
 * `tile` is the subtle card-background tint (light + dark pair). `swatch` is the
 * solid fill used by the picker dots. All class strings are FULL LITERALS — never
 * build them by interpolation, or Tailwind's compiler will purge them.
 */
export interface ProjectColorOption {
  key: ProjectColor;
  label: string;
  /** Subtle full-card background tint applied to the tile when not drag-highlighted. */
  tile: string;
  /** Solid swatch fill for the picker dot. */
  swatch: string;
}

export const PROJECT_COLOR_OPTIONS: ProjectColorOption[] = [
  { key: 'blue', label: 'Blue', tile: 'bg-blue-50 dark:bg-blue-950/40', swatch: 'bg-blue-500' },
  { key: 'teal', label: 'Teal', tile: 'bg-teal-50 dark:bg-teal-950/40', swatch: 'bg-teal-500' },
  { key: 'slate', label: 'Slate', tile: 'bg-slate-100 dark:bg-slate-700/40', swatch: 'bg-slate-500' },
  { key: 'purple', label: 'Purple', tile: 'bg-purple-50 dark:bg-purple-950/40', swatch: 'bg-purple-500' },
  { key: 'pink', label: 'Pink', tile: 'bg-pink-50 dark:bg-pink-950/40', swatch: 'bg-pink-500' },
];

const TILE_BY_KEY: Record<ProjectColor, string> = PROJECT_COLOR_OPTIONS.reduce(
  (acc, o) => {
    acc[o.key] = o.tile;
    return acc;
  },
  {} as Record<ProjectColor, string>,
);

/**
 * Resolve a stored color key to its tile-tint class string. Returns '' for an
 * absent/unknown key (no tint) so callers can interpolate unconditionally.
 */
export function getProjectTileTint(color: string | undefined): string {
  if (!color) return '';
  return TILE_BY_KEY[color as ProjectColor] ?? '';
}

/** Valid color keys, for validation. */
export const PROJECT_COLOR_KEYS: readonly ProjectColor[] = PROJECT_COLOR_OPTIONS.map((o) => o.key);

export function isProjectColor(val: unknown): val is ProjectColor {
  return typeof val === 'string' && (PROJECT_COLOR_KEYS as readonly string[]).includes(val);
}
