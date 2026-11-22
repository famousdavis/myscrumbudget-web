// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * The sidebar's MyScrumBudget™ is drawn as a gradient in MyScrumBudget's favicon
 * green, #16a34a (HDR26, v0.44.12), and every point of it stays readable on the
 * sidebar behind it, in both themes.
 *
 * ⚠️ jsdom has no paint, so nothing here is measured from a render. The end
 * colours are read from `Sidebar.tsx`'s source; the sidebar's background from
 * the `<nav>`'s classes, resolved through the installed Tailwind's own
 * `theme.css`; the fallback colours from `globals.css`. The contrast is computed
 * here from the WCAG 2.x definition. The rendered page was measured in Chrome
 * when this was written: the first opaque background behind the title is the
 * `<nav>`, at 1,024 and 800 px, in both themes.
 *
 * The bar is 4.5 : 1 at every point of each ramp: the title is 18 px bold
 * (`text-lg font-bold`) at every width, which is not large text (that needs
 * 18.66 px bold). The light ramp clears the bar by hundredths and the dark ramp
 * sits exactly on it (4.506), on purpose. So the backgrounds and the ends are
 * pinned below: a change to any of them has to come through here.
 *
 * The colour maths is the HDR26 plan's Appendix A, typed. It is copied, not
 * shared.
 */
const SIDEBAR = join(process.cwd(), 'src', 'components', 'Sidebar.tsx');
const GLOBALS_CSS = join(process.cwd(), 'src', 'app', 'globals.css');
const THEME_CSS = join(process.cwd(), 'node_modules', 'tailwindcss', 'theme.css');

const BAR = 4.5;
/** The sidebar's background in each theme, measured in Chrome (`getComputedStyle`, read through a canvas). */
const PREMISE = { light: '#fafafa', dark: '#09090b' } as const;
/** The approved ends (HDR26 plan §2), light end first. A change to any of them goes back to the owner with a proof. */
const ENDS = { light: ['#10843b', '#00471b'], dark: ['#62c679', '#008b3b'] } as const;
/** The page's own near-black and near-white, `--foreground` in `globals.css`: what the title showed before HDR26. */
const FOREGROUND = { light: '#171717', dark: '#ededed' } as const;
/** "MyScrumBudget": one word, so one gradient span. The ™ stays outside it. */
const GRADIENT_SPANS = 1;

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

/** A colour as Tailwind's theme.css writes it: `#rgb`, `#rrggbb`, or `oklch(L% C H)` with H possibly `none`. */
function parseCssColor(value: string): string {
  const v = value.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(v);
  if (m) return '#' + Array.from(m[1]!).map((c) => c + c).join('').toLowerCase();
  m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return '#' + m[1]!.toLowerCase();
  m = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+|none)\s*\)$/i.exec(v);
  if (m) return fromOklab(lab([Number(m[1]) / 100, Number(m[2]), m[3] === 'none' ? 0 : Number(m[3])]));
  throw new Error('unreadable color: ' + v);
}

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

const source = () => readFileSync(SIDEBAR, 'utf8');
const classesOf = (raw: string) => raw.split(/\s+/).filter(Boolean);

/** Every `const NAME = '…'` (or "…") in the file, so a `className={NAME}` can be resolved to its classes. */
function stringConstants(text: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const m of Array.from(text.matchAll(/\bconst\s+([A-Za-z_]\w*)\s*=\s*(?:'([^']*)'|"([^"]*)")/g))) {
    found.set(m[1]!, m[2] ?? m[3]!);
  }
  return found;
}

/**
 * The title: the sidebar's first `<Link …>` up to its closing tag. It must hold
 * the favicon `<img>`: that is the second, independent route to the same
 * element, so a reader that wandered to another link fails here.
 */
function titleLink(text: string): string {
  const start = text.indexOf('<Link');
  const end = text.indexOf('</Link>', start);
  if (start === -1 || end === -1) throw new Error('Sidebar.tsx: no title link');
  const link = text.slice(start, end);
  if (!link.includes('/spert-favicon-myscrumbudget.png')) throw new Error('Sidebar.tsx: the first link has no favicon');
  return link;
}

/** Every `className` in a slice of JSX: `"…"`, `'…'` or `{NAME}`, resolved. An unresolvable name fails loudly. */
function classNames(jsx: string, constants: Map<string, string>): string[][] {
  return Array.from(jsx.matchAll(/className=(?:"([^"]*)"|'([^']*)'|\{(\w+)\})/g)).map((m) => {
    const raw = m[1] ?? m[2] ?? constants.get(m[3]!);
    if (raw === undefined) throw new Error(`Sidebar.tsx: className={${m[3]}} is not a string constant`);
    return classesOf(raw);
  });
}

interface GradientSpan {
  classes: string[];
  text: string;
}

/**
 * Every element in the title whose classes clip a background to its text,
 * found by `bg-clip-text` in its classes rather than by the constant's name, so
 * an element given its own literal is counted too.
 */
function gradientSpans(text: string): GradientSpan[] {
  const constants = stringConstants(text);
  const spans: GradientSpan[] = [];
  const pattern = /<(\w+)\s+className=(?:"([^"]*)"|'([^']*)'|\{(\w+)\})\s*>([^<]*)<\/\1>/g;
  for (const m of Array.from(titleLink(text).matchAll(pattern))) {
    const raw = m[2] ?? m[3] ?? constants.get(m[4]!);
    if (raw === undefined) throw new Error(`Sidebar.tsx: className={${m[4]}} is not a string constant`);
    const classes = classesOf(raw);
    if (classes.includes('bg-clip-text')) spans.push({ classes, text: m[5]! });
  }
  // Every className in the title that clips to text must be one of the spans above: an element with other
  // attributes, or with children, would otherwise escape the census.
  const clipping = classNames(titleLink(text), constants).filter((c) => c.includes('bg-clip-text'));
  if (clipping.length !== spans.length) {
    throw new Error(`Sidebar.tsx: ${clipping.length} classNames clip to text, ${spans.length} read as gradient spans`);
  }
  return spans;
}

/** The one class with this exact variant and utility, e.g. `dark:` + `from-` → `#62c679`. Exactly one, or it fails. */
function endColor(classes: string[], variant: '' | 'dark:', utility: 'from' | 'to'): string {
  const pattern = new RegExp(`^${variant}${utility}-\\[(#[0-9a-f]{6})\\]$`, 'i');
  const hits = classes.map((c) => pattern.exec(c)?.[1]).filter((h): h is string => h !== undefined);
  if (hits.length !== 1) throw new Error(`${variant}${utility}-[#…]: found ${hits.length}, expected exactly 1`);
  return hits[0]!.toLowerCase();
}

/**
 * The gradient spans, refusing any count but the expected one, so that no row
 * below can pass by looping over nothing.
 */
function censused(text: string): GradientSpan[] {
  const spans = gradientSpans(text);
  if (spans.length !== GRADIENT_SPANS) throw new Error(`Sidebar.tsx: ${spans.length} gradient spans, expected ${GRADIENT_SPANS}`);
  return spans;
}

const endsOf = (classes: string[]) => ({
  light: [endColor(classes, '', 'from'), endColor(classes, '', 'to')],
  dark: [endColor(classes, 'dark:', 'from'), endColor(classes, 'dark:', 'to')],
});

/**
 * A class list's one colour class for a variant: `bg-zinc-50` → `zinc-50` for
 * `bg-`, `dark:bg-zinc-950` → `zinc-950`. Only colour shapes count, so a class
 * like `text-lg` is never read as a colour.
 */
function colorToken(classes: string[], head: string): string {
  const shape = new RegExp(`^${head}(?:white|black|[a-z]+-\\d{2,3})$`);
  const hits = classes.filter((c) => shape.test(c)).map((c) => c.slice(head.length));
  if (hits.length !== 1) throw new Error(`${head}…: found ${hits.length}, expected exactly 1`);
  return hits[0]!;
}

/** A Tailwind colour token's value in the installed theme.css (`zinc-50` → `oklch(98.5% 0 0)`), as #rrggbb. */
function themeColor(token: string): string {
  const css = readFileSync(THEME_CSS, 'utf8');
  const m = new RegExp(`--color-${token}:\\s*([^;]+);`).exec(css);
  if (!m) throw new Error(`theme.css: no --color-${token}`);
  return parseCssColor(m[1]!);
}

/** The sidebar `<nav>`'s classes. Its className is a template literal, so the `${…}` part is read as text. */
function navClasses(text: string): string[] {
  const m = /<nav\s+className=\{`([^`]*)`\}/.exec(text);
  if (!m) throw new Error('Sidebar.tsx: no <nav> with a template-literal className');
  return classesOf(m[1]!);
}

/** `--foreground` in a top-level `:root` or `:root.dark` block of globals.css (not the indented print override). */
function foreground(selector: ':root' | ':root.dark'): string {
  const css = readFileSync(GLOBALS_CSS, 'utf8');
  const escaped = selector.replace('.', '\\.');
  const blocks = Array.from(css.matchAll(new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, 'gm')));
  if (blocks.length !== 1) throw new Error(`globals.css: ${blocks.length} top-level ${selector} blocks, expected 1`);
  const m = /--foreground:\s*([^;]+);/.exec(blocks[0]![1]!);
  if (!m) throw new Error(`globals.css: no --foreground in ${selector}`);
  return parseCssColor(m[1]!);
}

/** What the gradient string may carry (R5): the gradient, its `dark:` ends, and the two fallbacks. Nothing else. */
const ALLOWED = [
  /^bg-gradient-to-r$/,
  /^(?:dark:)?(?:from|to)-\[#[0-9a-f]{6}\]$/i,
  /^bg-clip-text$/,
  /^text-transparent$/,
  /^(?:print|contrast-more):bg-none$/,
  /^(?:print|contrast-more|dark:contrast-more):text-\[#[0-9a-f]{6}\]$/i,
];

// ---- The guard -----------------------------------------------------------------------------------

describe("the sidebar's MyScrumBudget™: a gradient in MyScrumBudget's green, readable in both themes (HDR26)", () => {
  describe('instrument self-checks', () => {
    it('the contrast formula: #767676 on white is 4.54 : 1', () => {
      expect(trunc(contrast('#767676', '#ffffff'))).toBe('4.54');
    });

    it("the OKLCH steps rebuild the suite's old blue gradient from #0070f3, with its hue turns", () => {
      // As Appendix A writes it. Algebraically this is a round trip of #0099ff and #0051cc through OKLCH and
      // the gamut fit, so it checks those conversions, not the steps themselves.
      const [p, g1, g2] = ['#0070f3', '#0099ff', '#0051cc'].map(toLch) as [Triple, Triple, Triple];
      const stepOf = (g: Triple): Triple => [g[0] - p[0], g[1] / p[1], g[2] - p[2]];
      const withTurn = (fav: string, d: Triple) => {
        const [lk, c, h] = toLch(fav);
        return fromLch([lk + d[0], c * d[1], h + d[2]]);
      };
      expect(withTurn('#0070f3', stepOf(g1))).toBe('#0099ff');
      expect(withTurn('#0070f3', stepOf(g2))).toBe('#0051cc');
    });

    it("parseCssColor reads Tailwind's #fff, 'none'-hue and 4.2.x forms, and refuses what it cannot read", () => {
      expect(parseCssColor('#fff')).toBe('#ffffff');
      expect(parseCssColor('oklch(98.5% 0 none)')).toBe('#fafafa');
      expect(parseCssColor('oklch(98.5% 0 0)')).toBe('#fafafa');
      expect(parseCssColor('oklch(27.8% 0.033 256.848)')).toBe('#1e2939');
      expect(() => parseCssColor('rgb(1, 2, 3)')).toThrow(/unreadable/);
    });

    it('the ramp sampler fails a known-bad: the old blue gradient is under 3 : 1 here', () => {
      // Vacuity control: a sampler that always passed would pass every row below.
      expect(trunc(weakest('#0099ff', '#0051cc', '#ffffff', 'oklab'))).toBe('2.99');
      expect(trunc(weakest('#0099ff', '#0051cc', PREMISE.light, 'oklab'))).toBe('2.87');
      expect(trunc(weakest('#0099ff', '#0051cc', PREMISE.dark, 'oklab'))).toBe('2.88');
    });
  });

  it('the title has exactly one gradient span, holding the word MyScrumBudget and nothing else', () => {
    // Must-find, and the census: a reader that found nothing would pass every row below.
    const spans = gradientSpans(source());
    expect(spans.map((s) => s.text)).toEqual(['MyScrumBudget']);
    expect(spans).toHaveLength(GRADIENT_SPANS);
  });

  it('keeps the wrapper: the gradient span and the unchanged ™ sit together inside one span after the favicon', () => {
    // The link is `flex gap-2`. Without the wrapper, the <sup> becomes a flex item and an 8 px gap opens
    // before "TM", and the ™ loses its raised position. The ™'s own classes are pinned too (R3).
    const link = titleLink(source());
    const afterImg = link.slice(link.indexOf('/>', link.indexOf('<img')) + 2);
    const body = afterImg.replace(/>\s+</g, '><').trim();
    expect(body).toMatch(
      /^<span><span className=\{\w+\}>MyScrumBudget<\/span><sup className="text-\[7px\] font-normal text-zinc-400 dark:text-zinc-500">\s*TM\s*<\/sup><\/span>$/,
    );
  });

  it('every gradient span carries the approved end colours, light end first (D5)', () => {
    for (const span of censused(source())) expect(endsOf(span.classes), span.text).toEqual(ENDS);
  });

  it('the gradient string carries only the gradient and its fallbacks: no size, weight or other class (R5)', () => {
    for (const span of censused(source())) {
      const stray = span.classes.filter((c) => !ALLOWED.some((re) => re.test(c)));
      expect(stray, `${span.text}: classes outside the gradient string's list`).toEqual([]);
      expect(span.classes).toEqual(expect.arrayContaining(['bg-gradient-to-r', 'bg-clip-text', 'text-transparent']));
    }
  });

  it("the sidebar's background resolves, through the installed Tailwind, to the pinned premise in each theme", () => {
    const nav = navClasses(source());
    expect(themeColor(colorToken(nav, 'bg-'))).toBe(PREMISE.light);
    expect(themeColor(colorToken(nav, 'dark:bg-'))).toBe(PREMISE.dark);
  });

  it('nothing between the sidebar and the title paints a ground of its own or fades it', () => {
    // The <nav> is the title's ground only while nothing inside it, down to the title, has a background; and a
    // hover fade would sink a ramp that sits on the bar.
    const text = source();
    const nav = text.indexOf('<nav');
    const between = text.slice(text.indexOf('>', text.indexOf('`}', nav)) + 1, text.indexOf('<img', nav));
    const classes = classNames(between, stringConstants(text)).flat();
    expect(classes.length, 'the reader found the classes between the <nav> and the title').toBeGreaterThan(0);
    const stray = classes.filter((c) => /(?:^|:)(?:bg-|opacity-)/.test(c) || c.startsWith('hover:'));
    expect(stray).toEqual([]);
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`${theme}: every point of the ramp meets ${BAR} : 1 on the sidebar, in Oklab and in sRGB`, () => {
      for (const span of censused(source())) {
        const [from, to] = endsOf(span.classes)[theme] as [string, string];
        for (const space of ['oklab', 'srgb'] as const) {
          const w = weakest(from, to, PREMISE[theme], space);
          expect(w, `${span.text} ${theme} ${from} → ${to} on ${PREMISE[theme]} (${space}): ${trunc(w)}`)
            .toBeGreaterThanOrEqual(BAR);
        }
      }
    });
  }

  it("the fallback colours are the page's own foreground in globals.css: #171717 and #ededed", () => {
    expect(foreground(':root')).toBe(FOREGROUND.light);
    expect(foreground(':root.dark')).toBe(FOREGROUND.dark);
  });

  it('falls back to that solid foreground in print and under prefers-contrast: more (D10)', () => {
    const [nearBlack, nearWhite] = [foreground(':root'), foreground(':root.dark')];
    for (const span of censused(source())) {
      expect(span.classes, span.text).toEqual(
        expect.arrayContaining([
          'print:bg-none',
          `print:text-[${nearBlack}]`,
          'contrast-more:bg-none',
          `contrast-more:text-[${nearBlack}]`,
          `dark:contrast-more:text-[${nearWhite}]`,
        ]),
      );
    }
  });

  it('the increased-contrast colours meet the bar on the sidebar too', () => {
    expect(contrast(foreground(':root'), PREMISE.light)).toBeGreaterThanOrEqual(BAR);
    expect(contrast(foreground(':root.dark'), PREMISE.dark)).toBeGreaterThanOrEqual(BAR);
  });
});
