// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * The brand row's MyScrumBudget™ is drawn as a gradient in MyScrumBudget's favicon green, #16a34a (HDR26, v0.44.12),
 * and every point of it stays readable on the page ground behind it, in both themes.
 *
 * ⚠️ RE-PINNED ON PURPOSE AT v0.45.0 (FRAME26). This guard was `Sidebar.title-gradient.test.ts`, whose premise was the
 * sidebar's ground (`#fafafa` / `#09090b`) and a 4.5 bar for an 18 px title. The sidebar went; the title now sits in
 * the SPERT® Suite frame's brand row, drawn by the frame's `.sf-grad` from `--app-grad-light` / `--app-grad-dark`
 * (`globals.css`), on the frame's page ground (`--sf-page`: `#ffffff` / `#101828`, read from the vendored
 * `spert-frame.css`), at 24 px bold (`.sf-title`), which is large text, so the bar is 3 : 1. The ends did NOT change.
 * Measured weakest points (41 samples, floored): light 4.78 on #ffffff, dark 4.01 on #101828 (4.0194; the contract
 * rounds it to 4.02). Its fallbacks are the frame's: under `prefers-contrast: more` the title is solid in the frame's
 * heading colour (`#333333` / `#e2e8f0`), and in print solid black.
 *
 * ⚠️ jsdom has no paint, so nothing here is measured from a render: the ends are read from `globals.css`, the ground,
 * the title's size and the fallbacks from the vendored stylesheet, the markup from `AppHeader.tsx`. The rendered page
 * was measured in Chrome by frame-check (`contrast.title`).
 *
 * The colour maths is the HDR26 plan's Appendix A, typed. It is copied, not shared.
 */
const HEADER = join(process.cwd(), 'src', 'components', 'AppHeader.tsx');
const GLOBALS_CSS = join(process.cwd(), 'src', 'app', 'globals.css');
const FRAME_CSS = join(process.cwd(), 'src', 'styles', 'spert-frame.css');

/** 24 px bold is large text (WCAG: 18.66 px bold), so every point of each ramp needs 3 : 1. */
const BAR = 3;
/** The frame's page ground in each theme, `--sf-page` in the vendored stylesheet (contract §5). */
const PREMISE = { light: '#ffffff', dark: '#101828' } as const;
/** The approved ends (HDR26 plan §2), light end first. Unchanged by the frame. */
const ENDS = { light: ['#10843b', '#00471b'], dark: ['#62c679', '#008b3b'] } as const;
/** The weakest point of each ramp on its ground, floored to 2 dp, in both interpolations (they agree here). */
const WEAKEST = { light: '4.78', dark: '4.01' } as const;

// ---- Appendix A (HDR26 plan v6), typed -----------------------------------------------------------

type Triple = [number, number, number];

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const delin = (v: number) =>
  Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)));
const rgb = (h: string): Triple => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as Triple;
const hex = (a: number[]) => '#' + a.map((v) => v.toString(16).padStart(2, '0')).join('');
const luminance = (h: string) => {
  const [r, g, b] = rgb(h).map(lin) as Triple;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** A contrast ratio to two decimals, truncated: never rounded up across a bar. */
const trunc = (n: number) => (Math.floor(n * 100) / 100).toFixed(2);

const toOklab = (h: string): Triple => {
  const [r, g, b] = rgb(h).map(lin) as Triple;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const linFromOklab = ([lk, a, b]: Triple): Triple => {
  const l = (lk + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lk - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lk - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};
const fromOklab = (lab: Triple) => hex(linFromOklab(lab).map(delin));
const toLch = (h: string): Triple => {
  const [lk, a, b] = toOklab(h);
  return [lk, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
};
const lab = ([lk, c, h]: Triple): Triple => [lk, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
const inGamut = (lch: Triple) => linFromOklab(lab(lch)).every((v) => v >= -1e-6 && v <= 1 + 1e-6);
/** Fit to sRGB by cutting chroma at fixed lightness and hue; never by clamping channels, which turns the hue. */
const fromLch = ([lk, c, h]: Triple) => {
  let fit = c;
  if (!inGamut([lk, c, h])) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut([lk, mid, h])) lo = mid;
      else hi = mid;
    }
    fit = lo;
  }
  return fromOklab(lab([lk, fit, h]));
};

/**
 * The weakest contrast along a ramp, 41 samples. `oklab` is how Tailwind 4's
 * `bg-gradient-to-r` interpolates (`to right in oklab`); `srgb` is a plain
 * gradient's. Both are checked, so a change of interpolation cannot pass.
 */
function weakest(e1: string, e2: string, ground: string, space: 'oklab' | 'srgb'): number {
  let min = Infinity;
  const [a, b] = [toOklab(e1), toOklab(e2)];
  const [p, q] = [rgb(e1), rgb(e2)];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const c =
      space === 'oklab'
        ? fromOklab(a.map((v, k) => v + (b[k]! - v) * t) as Triple)
        : hex(p.map((v, k) => Math.round(v + (q[k]! - v) * t)));
    min = Math.min(min, contrast(c, ground));
  }
  return min;
}

// ---- Reading the source --------------------------------------------------------------------------

const header = () => readFileSync(HEADER, 'utf8');
const globalsCss = () => readFileSync(GLOBALS_CSS, 'utf8');
const frameCss = () => readFileSync(FRAME_CSS, 'utf8');

/** `--app-grad-light` / `--app-grad-dark` in globals.css: exactly one declaration each, two stops, in Oklab. */
function rampEnds(theme: 'light' | 'dark'): [string, string] {
  const name = `--app-grad-${theme}`;
  const hits = Array.from(globalsCss().matchAll(new RegExp(`${name}:\\s*([^;]+);`, 'g')));
  if (hits.length !== 1) throw new Error(`globals.css: ${hits.length} ${name} declarations, expected 1`);
  const m = /^linear-gradient\(to right in oklab,\s*(#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)$/i.exec(hits[0]![1]!.trim());
  if (!m) throw new Error(`globals.css: ${name} is not a two-stop "to right in oklab" gradient: ${hits[0]![1]}`);
  return [m[1]!.toLowerCase(), m[2]!.toLowerCase()];
}

/** A custom property's value in the vendored stylesheet's `:root {…}` (light) or `:root.dark, …{…}` (dark) block. */
function frameToken(theme: 'light' | 'dark', name: string): string {
  const css = frameCss();
  const block = theme === 'light'
    ? /^:root\s*\{([^}]*)\}/m.exec(css)
    : /^:root\.dark,\s*:root\[data-theme="dark"\]\s*\{([^}]*)\}/m.exec(css);
  if (!block) throw new Error(`spert-frame.css: no ${theme} token block`);
  const m = new RegExp(`${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(block[1]!);
  if (!m) throw new Error(`spert-frame.css: no ${name} in the ${theme} block`);
  return m[1]!.toLowerCase();
}

/** One rule's body in the vendored stylesheet, by its exact selector at the start of a line. */
function frameRule(selector: string, css = frameCss()): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`^\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  if (!m) throw new Error(`spert-frame.css: no rule "${selector}"`);
  return m[1]!;
}

/** The title: the brand `<Link …>` up to its closing tag, which must hold the favicon (a second route to the element). */
function brandLink(text: string): string {
  const start = text.indexOf('<Link href="/" className="sf-brand"');
  const end = text.indexOf('</Link>', start);
  if (start === -1 || end === -1) throw new Error('AppHeader.tsx: no brand link');
  const link = text.slice(start, end);
  if (!link.includes('/spert-favicon-myscrumbudget.png')) throw new Error('AppHeader.tsx: the brand link has no favicon');
  return link;
}

/** Every `.sf-grad` element in the brand, with its text. Counted by class, so an element given it any other way counts. */
function gradientSpans(text: string): string[] {
  const link = brandLink(text);
  const spans = Array.from(link.matchAll(/<span className="sf-grad">([^<]*)<\/span>/g)).map((m) => m[1]!);
  const mentions = (link.match(/\bsf-grad\b/g) ?? []).length;
  if (mentions !== spans.length) throw new Error(`AppHeader.tsx: ${mentions} sf-grad mentions, ${spans.length} read as spans`);
  return spans;
}

// ---- The guard -----------------------------------------------------------------------------------

describe("the brand row's MyScrumBudget™: a gradient in MyScrumBudget's green, readable in both themes (HDR26, on the frame)", () => {
  describe('instrument self-checks', () => {
    it('the contrast formula: #767676 on white is 4.54 : 1', () => {
      expect(trunc(contrast('#767676', '#ffffff'))).toBe('4.54');
    });

    it("the OKLCH steps rebuild the suite's old blue gradient from #0070f3, with its hue turns", () => {
      // As Appendix A writes it: a round trip of #0099ff and #0051cc through OKLCH and the gamut fit.
      const [p, g1, g2] = ['#0070f3', '#0099ff', '#0051cc'].map(toLch) as [Triple, Triple, Triple];
      const stepOf = (g: Triple): Triple => [g[0] - p[0], g[1] / p[1], g[2] - p[2]];
      const withTurn = (fav: string, d: Triple) => {
        const [lk, c, h] = toLch(fav);
        return fromLch([lk + d[0], c * d[1], h + d[2]]);
      };
      expect(withTurn('#0070f3', stepOf(g1))).toBe('#0099ff');
      expect(withTurn('#0070f3', stepOf(g2))).toBe('#0051cc');
    });

    it('the ramp sampler fails a known-bad: a pale green ramp is under 3 : 1 on white', () => {
      // Vacuity control: a sampler that always passed would pass every row below.
      expect(weakest('#62c679', '#008b3b', '#ffffff', 'oklab')).toBeLessThan(BAR);
      expect(trunc(weakest('#62c679', '#008b3b', '#ffffff', 'oklab'))).toBe('2.12'); // the dark ramp, misplaced on white
    });

    it('the readers find what they read (must-find)', () => {
      expect(rampEnds('light')).toHaveLength(2);
      expect(frameToken('light', '--sf-page')).toMatch(/^#[0-9a-f]{6}$/);
      expect(frameRule('.sf-title')).toMatch(/font:/);
      expect(gradientSpans(header()).length).toBeGreaterThan(0);
    });
  });

  it('the title has exactly one gradient span, holding the word MyScrumBudget and nothing else; no TITLE_GRADIENT', () => {
    expect(gradientSpans(header())).toEqual(['MyScrumBudget']);
    expect(header()).not.toMatch(/TITLE_GRADIENT|bg-gradient-to-r|bg-clip-text/);
  });

  it('the ™ is the frame\'s muted mark, right after the gradient word and outside it', () => {
    const link = brandLink(header()).replace(/>\s+</g, '><');
    expect(link).toMatch(
      /<span className="sf-title" data-sf="title"><span className="sf-grad">MyScrumBudget<\/span><span className="sf-mark sf-mark--tm">™<\/span><\/span>/,
    );
  });

  it('the ramps in globals.css are the approved ends, light end first (D5)', () => {
    expect({ light: rampEnds('light'), dark: rampEnds('dark') }).toEqual(ENDS);
  });

  it("the frame's .sf-grad draws them: --app-grad-light, and --app-grad-dark under the dark keying", () => {
    expect(frameRule('.sf-grad')).toMatch(/background-image:\s*var\(--app-grad-light\)/);
    expect(frameCss()).toMatch(/:root\.dark \.sf-grad, :root\[data-theme="dark"\] \.sf-grad \{ background-image: var\(--app-grad-dark\); \}/);
  });

  it("the ground premise: the frame's --sf-page, #ffffff and #101828, which .sf-app and .sf-bar paint", () => {
    expect(frameToken('light', '--sf-page')).toBe(PREMISE.light);
    expect(frameToken('dark', '--sf-page')).toBe(PREMISE.dark);
    expect(frameRule('.sf-app')).toMatch(/background:\s*var\(--sf-page\)/);
    expect(frameRule('.sf-bar')).toMatch(/background:\s*var\(--sf-page\)/);
  });

  it("the size premise: .sf-title is 700 / 24 px, large text, so the bar is 3 : 1", () => {
    const m = /font:\s*(\d+)\s+(\d+)px/.exec(frameRule('.sf-title'));
    expect(m && [Number(m[1]), Number(m[2])]).toEqual([700, 24]);
    expect(Number(m![2]) >= 18.66 && Number(m![1]) >= 700).toBe(true);
  });

  it('nothing between the brand link and the title paints a ground of its own, fades or hovers', () => {
    const link = brandLink(header());
    const classes = Array.from(link.matchAll(/className="([^"]*)"/g)).flatMap((m) => m[1]!.split(/\s+/));
    expect(classes.length, 'the reader found the classes in the brand').toBeGreaterThan(0);
    const stray = classes.filter((c) => /(?:^|:)(?:bg-|opacity-)/.test(c) || c.startsWith('hover:'));
    expect(stray).toEqual([]);
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`${theme}: every point of the ramp meets ${BAR} : 1 on the frame's ground, in Oklab and in sRGB (weakest ${WEAKEST[theme]})`, () => {
      const [from, to] = rampEnds(theme);
      const ground = frameToken(theme, '--sf-page');
      for (const space of ['oklab', 'srgb'] as const) {
        const w = weakest(from, to, ground, space);
        expect(w, `${theme} ${from} → ${to} on ${ground} (${space}): ${trunc(w)}`).toBeGreaterThanOrEqual(BAR);
        expect(trunc(w), `${theme} (${space}) weakest point`).toBe(WEAKEST[theme]);
      }
    });
  }

  it("falls back to the frame's solid heading colour under prefers-contrast: more, and to black in print (D10)", () => {
    const css = frameCss();
    const more = /@media \(prefers-contrast: more\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    const print = /@media print \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(frameRule('.sf-grad', more)).toMatch(/background-image:\s*none !important;[\s\S]*color:\s*var\(--sf-heading\) !important/);
    expect(frameRule('.sf-grad', print)).toMatch(/background-image:\s*none !important;[\s\S]*color:\s*#000 !important/);
  });

  it("the fallback heading colour meets the bar on both grounds: #333333 12.63, #e2e8f0 14.39", () => {
    expect(trunc(contrast(frameToken('light', '--sf-heading'), PREMISE.light))).toBe('12.63');
    expect(trunc(contrast(frameToken('dark', '--sf-heading'), PREMISE.dark))).toBe('14.39');
  });

  it("the ™ (.sf-mark, the muted text colour) meets 4.5 : 1 on both grounds: 4.83 and 6.82", () => {
    expect(frameRule('.sf-mark')).toMatch(/color:\s*var\(--sf-text-muted\)/);
    expect(trunc(contrast(frameToken('light', '--sf-text-muted'), PREMISE.light))).toBe('4.83');
    expect(trunc(contrast(frameToken('dark', '--sf-text-muted'), PREMISE.dark))).toBe('6.82');
  });
});
