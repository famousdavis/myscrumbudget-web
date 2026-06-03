// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import {
  PROJECT_COLOR_OPTIONS,
  PROJECT_COLOR_KEYS,
  getProjectTileTint,
  isProjectColor,
} from '../projectColors';

describe('project color palette', () => {
  it('avoids the traffic-light status hues', () => {
    const forbidden = ['red', 'amber', 'green', 'violet'];
    for (const key of PROJECT_COLOR_KEYS) {
      expect(forbidden).not.toContain(key);
    }
  });

  it('every option has a tile tint and a swatch fill', () => {
    for (const opt of PROJECT_COLOR_OPTIONS) {
      expect(opt.tile).toBeTruthy();
      expect(opt.swatch).toBeTruthy();
      expect(opt.label).toBeTruthy();
    }
  });

  it('getProjectTileTint returns the matching tile class', () => {
    expect(getProjectTileTint('blue')).toBe('bg-blue-50 dark:bg-blue-950/40');
  });

  it('getProjectTileTint returns empty string for absent/unknown keys', () => {
    expect(getProjectTileTint(undefined)).toBe('');
    expect(getProjectTileTint('chartreuse')).toBe('');
  });

  it('isProjectColor accepts known keys and rejects others', () => {
    expect(isProjectColor('teal')).toBe(true);
    expect(isProjectColor('red')).toBe(false);
    expect(isProjectColor('')).toBe(false);
    expect(isProjectColor(null)).toBe(false);
    expect(isProjectColor(42)).toBe(false);
  });
});
