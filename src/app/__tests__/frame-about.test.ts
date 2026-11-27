// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * FRAME26 pass 3's MyScrumBudget leftovers (v0.47.0), pinned where a unit test can see them; the browser measures the
 * same items on the local build (frame-check and the seat's probes).
 *   M1 the page's meta description is the brand row's tagline · M2 the changelog's date line reaches 4.5:1
 * The About page itself is held by src/app/about/__tests__/page.test.tsx, and the © year by CopyrightYear's tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { APP_TAGLINE } from '@/lib/constants';

vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: '--font-geist-sans' }),
  Geist_Mono: () => ({ variable: '--font-geist-mono' }),
}));

const read = (...p: string[]) => readFileSync(join(process.cwd(), 'src', ...p), 'utf8');
const lum = (h: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)]; return Math.floor(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };
// Tailwind 4's zinc, as Chrome paints it (canvas-resolved from its lab() values), and the frame's page ground.
const ZINC: Record<string, string> = { 'zinc-400': '#9f9fa9', 'zinc-500': '#71717b' };
const WHITE = '#ffffff', DARK = '#101828';

describe('M1: the page description is the brand row\'s tagline', () => {
  it('metadata.description is APP_TAGLINE, "Project budget forecasting for any project type"', async () => {
    const { metadata } = await import('../layout');
    expect(metadata.description).toBe(APP_TAGLINE);
    expect(metadata.description).toBe('Project budget forecasting for any project type');
  });
});

describe('M2: the changelog\'s date line reaches 4.5:1 in both themes', () => {
  it('the date span is text-zinc-500 dark:text-zinc-400: 4.82 and 6.76 on the page ground', () => {
    const m = /<span className="([^"]*)">\s*\{formatDateLong\(entry\.date\)\}/.exec(read('app', 'changelog', 'page.tsx'));
    expect(m, 'the date line is there').not.toBeNull();
    const tokens = m![1]!.split(/\s+/);
    const light = tokens.find((t) => /^text-zinc-\d+$/.test(t))!.replace('text-', '');
    const dark = tokens.find((t) => /^dark:text-zinc-\d+$/.test(t))!.replace('dark:text-', '');
    expect([light, dark]).toEqual(['zinc-500', 'zinc-400']);
    expect(ratio(ZINC[light]!, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(ZINC[dark]!, DARK)).toBeGreaterThanOrEqual(4.5);
  });
});
