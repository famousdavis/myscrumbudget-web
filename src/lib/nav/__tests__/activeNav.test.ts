// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The frame's two path rules (FRAME26, v0.45.0), as decision tables: which navigation item names the current page
 * (contract §3), and which screens cap their body (exception X4).
 */
import { describe, it, expect } from 'vitest';
import { activeNavHref, bodyCapped } from '../activeNav';

describe('activeNavHref', () => {
  it.each([
    ['/', '/'],
    ['/projects/new', '/'],
    ['/projects/abc123', '/'],
    ['/projects/abc123/edit', '/'],
    ['/team', '/team'],
    ['/settings', '/settings'],
    ['/about', '/about'],
    ['/changelog', null],
    ['/projects', null],
    ['/teams', null],
    ['/settingsx', null],
    ['/no-such-page', null],
    ['', null],
  ] as const)('%s → %s', (path, expected) => {
    expect(activeNavHref(path)).toBe(expected);
  });

  it('a null pathname marks nothing', () => {
    expect(activeNavHref(null)).toBeNull();
  });
});

describe('bodyCapped', () => {
  it.each([
    ['/settings', true],
    ['/about', true],
    ['/changelog', true],
    ['/', false],
    ['/team', false],
    ['/projects/new', false],
    ['/projects/abc123', false],
    ['/projects/abc123/edit', false],
    ['/no-such-page', false],
    ['/aboutx', false],
  ] as const)('%s → %s', (path, expected) => {
    expect(bodyCapped(path)).toBe(expected);
  });

  it('a null pathname is not capped', () => {
    expect(bodyCapped(null)).toBe(false);
  });
});
