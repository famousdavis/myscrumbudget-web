// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The account chip on the frame's `.sf-chip` (FRAME26, v0.45.0). REWRITTEN from `StorageStatusPill.contrast.test.tsx`,
 * which pinned stage 0's classes (`text-gray-500 dark:text-gray-400` on "Local only", `text-[#0070f3]
 * dark:text-[#51a2ff]` on "Sign in", v0.44.14) — exactly what the frame's tokens replace. This pins:
 *   - the three states on `.sf-chip > .sf-chip-state + .sf-chip-act`, their names unchanged;
 *   - no colour set inline or by a utility on the chip or its segments, except the avatar's fill and the signed-in
 *     name (the stylesheet is unlayered and would win anyway);
 *   - the stylesheet's mapping (state → muted, act → link, hover → --sf-hover) and the contrast of each pair, at rest
 *     and on the hover ground, in both themes, with more contrast too: text 4.5, icons 3 (WCAG 1.4.3 / 1.4.11).
 * Values are truncated to 2 dp; the contract rounds the same pairs (4.84 / 6.82, 5.25 / 6.73, 4.63 / 5.64, 5.02 /
 * 5.56). jsdom applies no CSS, so the tokens are read from the vendored stylesheet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { contrast, rule, token, trunc, type Theme } from '@/styles/__tests__/frameTokens.testkit';

let mockUser: { displayName: string; email: string } | null = null;
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ user: mockUser }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

import { StorageStatusPill } from '../StorageStatusPill';

const THEMES: Theme[] = ['light', 'dark'];

function chip() {
  return screen.getByRole('button');
}
const seg = (b: HTMLElement, cls: string) => {
  const el = b.querySelector<HTMLElement>(`:scope > .${cls}`);
  if (!el) throw new Error(`no .${cls}`);
  return el;
};

beforeEach(() => {
  mockUser = null;
  localStorage.clear();
});

describe('StorageStatusPill: the three states on .sf-chip', () => {
  it('signed out: "Local only" + "Sign in", named "Open cloud storage settings"', () => {
    render(<StorageStatusPill onOpen={() => {}} />);
    const b = chip();
    expect(b.className).toBe('sf-chip');
    expect(b.getAttribute('data-sf')).toBe('chip');
    expect(b.getAttribute('aria-label')).toBe('Open cloud storage settings');
    expect(seg(b, 'sf-chip-state').textContent).toBe('Local only');
    expect(seg(b, 'sf-chip-act').textContent).toBe('Sign in');
  });

  it('signed in, local: name and a 22 px avatar, the lock in the act segment, the old name kept', () => {
    mockUser = { displayName: 'Ada Lovelace', email: 'ada@example.com' };
    localStorage.setItem('msb:storageMode', 'local');
    render(<StorageStatusPill onOpen={() => {}} />);
    const b = chip();
    expect(b.getAttribute('aria-label')).toBe('Signed in as Ada in local mode. Open cloud storage settings.');
    expect(seg(b, 'sf-chip-state').textContent).toBe('AAda');
    const avatar = seg(b, 'sf-chip-state').firstElementChild as HTMLElement;
    expect(avatar.className.split(/\s+/)).toEqual(expect.arrayContaining(['h-[22px]', 'w-[22px]']));
    expect(seg(b, 'sf-chip-act').querySelector('svg rect')).not.toBeNull();
  });

  it('signed in, cloud: the cloud in the act segment, the old name kept', () => {
    mockUser = { displayName: 'Ada Lovelace', email: 'ada@example.com' };
    localStorage.setItem('msb:storageMode', 'cloud');
    render(<StorageStatusPill onOpen={() => {}} />);
    const b = chip();
    expect(b.getAttribute('aria-label')).toBe('Signed in as Ada. Open cloud storage settings.');
    const icon = seg(b, 'sf-chip-act').querySelector('svg path')!;
    expect(icon.getAttribute('fill')).toBe('currentColor');
  });
});

describe('StorageStatusPill: colours come from the frame, not from this file', () => {
  it('no inline style or colour utility on the chip, its segments or "Local only"; the avatar alone has an inline fill', () => {
    for (const user of [null, { displayName: 'Ada Lovelace', email: 'a@x.com' }]) {
      mockUser = user;
      const { unmount } = render(<StorageStatusPill onOpen={() => {}} />);
      const b = chip();
      const styled = [...b.querySelectorAll<HTMLElement>('[style]')];
      expect(b.getAttribute('style')).toBeNull();
      expect(styled.map((e) => e.getAttribute('style'))).toEqual(user ? ['background-color: rgb(0, 112, 243);'] : []);
      for (const el of [b, seg(b, 'sf-chip-state'), seg(b, 'sf-chip-act')]) {
        expect(el.className.split(/\s+/).filter((c) => /(?:^|:)(?:text|bg|border)-/.test(c)), el.className).toEqual([]);
      }
      if (!user) expect(seg(b, 'sf-chip-state').lastElementChild!.getAttribute('class')).toBeNull();
      unmount();
    }
  });

  it('the signed-out lock draws in currentColor, inheriting the state segment', () => {
    render(<StorageStatusPill onOpen={() => {}} />);
    const svg = seg(chip(), 'sf-chip-state').querySelector('svg')!;
    expect(svg.getAttribute('class')).toBeNull();
    expect([...svg.querySelectorAll('[stroke]')].map((e) => e.getAttribute('stroke'))).toEqual(['currentColor', 'currentColor']);
  });

  it('the stylesheet maps state → muted, act → link, hover → --sf-hover', () => {
    expect(rule('.sf-chip-state')).toMatch(/color:\s*var\(--sf-text-muted\)/);
    expect(rule('.sf-chip-act')).toMatch(/color:\s*var\(--sf-link\)/);
    expect(rule('.sf-chip:hover')).toMatch(/background:\s*var\(--sf-hover\)/);
  });
});

describe('StorageStatusPill: contrast of the frame tokens it wears', () => {
  const EXPECTED = {
    light: { muted: ['4.83', '4.62'], link: ['5.24', '5.01'] },
    dark: { muted: ['6.82', '5.63'], link: ['6.72', '5.56'] },
  } as const;

  for (const theme of THEMES) {
    it(`${theme}: "Local only" and "Sign in" at rest and on hover`, () => {
      const page = token(theme, '--sf-page');
      const hover = token(theme, '--sf-hover');
      const muted = token(theme, '--sf-text-muted');
      const link = token(theme, '--sf-link');
      expect([trunc(contrast(muted, page)), trunc(contrast(muted, hover))]).toEqual(EXPECTED[theme].muted);
      expect([trunc(contrast(link, page)), trunc(contrast(link, hover))]).toEqual(EXPECTED[theme].link);
    });

    it(`${theme}, more contrast: every chip text ≥ 4.5 at rest and on hover (so every icon ≥ 3)`, () => {
      for (const fg of ['--sf-text-muted', '--sf-link']) {
        for (const bg of ['--sf-page', '--sf-hover']) {
          expect(contrast(token(theme, fg, true), token(theme, bg, true)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }

  it('the signed-in-local lock (gray-500 / gray-400) meets 3 : 1 on both grounds, at rest and on hover', () => {
    mockUser = { displayName: 'Ada Lovelace', email: 'a@x.com' };
    render(<StorageStatusPill onOpen={() => {}} />);
    const svg = seg(chip(), 'sf-chip-act').querySelector('svg')!;
    expect(svg.getAttribute('class')).toBe('text-gray-500 dark:text-gray-400');
    // gray-500 is the frame's light muted #6a7282 and gray-400 its dark muted #99a1af (Tailwind 4).
    for (const [fg, theme] of [['#6a7282', 'light'], ['#99a1af', 'dark']] as const) {
      expect(contrast(fg, token(theme, '--sf-page'))).toBeGreaterThanOrEqual(3);
      expect(contrast(fg, token(theme, '--sf-hover'))).toBeGreaterThanOrEqual(3);
    }
  });
});
