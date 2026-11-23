// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Tests only (FRAME26, v0.45.0): reads the frame's colour tokens from the VENDORED stylesheet, so a contrast test
 * measures the values the app ships rather than numbers typed into the test, and computes WCAG 2.x contrast.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Theme = 'light' | 'dark';

const FRAME_CSS = join(process.cwd(), 'src', 'styles', 'spert-frame.css');
export const frameCss = () => readFileSync(FRAME_CSS, 'utf8');

/** A token's hex in the `:root {…}` (light) or `:root.dark, :root[data-theme="dark"] {…}` (dark) block, or, with
 * `more`, in the `@media (prefers-contrast: more)` overrides (falling back to the base block). */
export function token(theme: Theme, name: string, more = false): string {
  const css = frameCss();
  const find = (scope: string) => {
    const block = theme === 'light'
      ? /:root\s*\{([^}]*)\}/.exec(scope)
      : /:root\.dark,\s*:root\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(scope);
    return block ? new RegExp(`${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(block[1]!)?.[1] : undefined;
  };
  if (more) {
    const media = /@media \(prefers-contrast: more\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    const v = find(media);
    if (v) return v.toLowerCase();
  }
  const v = find(css);
  if (!v) throw new Error(`spert-frame.css: no ${name} for ${theme}`);
  return v.toLowerCase();
}

/** One rule's body, by its exact selector at the start of a line. */
export function rule(selector: string, css = frameCss()): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`^\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  if (!m) throw new Error(`spert-frame.css: no rule "${selector}"`);
  return m[1]!;
}

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(Number.parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
export const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** A ratio to two decimals, truncated: never rounded up across a bar. */
export const trunc = (n: number) => (Math.floor(n * 100) / 100).toFixed(2);
