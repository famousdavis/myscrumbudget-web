// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The FRAME26 clean-up's MyScrumBudget items (v0.46.0), each pinned where a unit test can see it. jsdom applies no
// Tailwind, so these pin the CLASS TOKENS and check the ratios of the palette values they stand for, as Chrome paints
// them (measured on production 2026-11-26: zinc-400 #9f9fa9, zinc-500 #71717b, red-700 #c10007). The seat's probes
// measure the same items in a browser.
//   M1 small muted text reaches 4.5:1 · M4 the report's footer prints · M5 About's subtitle · M6 the invitation's error
//   line · E the crash screen

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import GlobalError from '../global-error';
import { APP_TAGLINE } from '@/lib/constants';

const read = (...p: string[]) => readFileSync(join(process.cwd(), 'src', ...p), 'utf8');
const lum = (h: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)]; return Math.floor(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };
const PALETTE: Record<string, string> = { 'zinc-400': '#9f9fa9', 'zinc-500': '#71717b', 'red-700': '#c10007', 'red-400': '#ff6467' };
const WHITE = '#ffffff', DARK = '#101828';

describe('M1: the small muted lines reach 4.5:1 in both themes', () => {
  const SITES: [string, string[], RegExp][] = [
    ["Team's 12 px line", ['features', 'team', 'components', 'PoolMemberTable.tsx'], /<p className="([^"]*)">\s*Use the form above/],
    ['"Project not found." (project page)', ['app', 'projects', '[id]', 'page.tsx'], /<p className="([^"]*)">Project not found\.<\/p>/],
    ['"Project not found." (edit page)', ['app', 'projects', '[id]', 'edit', 'page.tsx'], /<p className="([^"]*)">Project not found\.<\/p>/],
    // "About's disclaimer" left this list at v0.47.0 (FRAME26 pass 3): About's text takes the frame's colours, with no
    // utility class of its own, and the warranty is the GPL's §15 (src/app/about/__tests__/page.test.tsx).
  ];
  it.each(SITES)('%s', (_name, path, re) => {
    const m = re.exec(read(...path));
    expect(m, 'the site is there').not.toBeNull();
    const tokens = m![1]!.split(/\s+/);
    const light = tokens.find((t) => /^text-zinc-\d+$/.test(t))!.replace('text-', '');
    const dark = tokens.find((t) => /^dark:text-zinc-\d+$/.test(t))?.replace('dark:text-', '');
    expect(dark, 'it has a dark colour of its own').toBeDefined();
    expect(ratio(PALETTE[light]!, WHITE), `light ${light}`).toBeGreaterThanOrEqual(4.5);
    expect(ratio(PALETTE[dark!]!, DARK), `dark ${dark}`).toBeGreaterThanOrEqual(4.5);
  });

  // v0.47.0 (FRAME26 pass 3): About's three "TM" sups are gone. Every mark on the page is the frame's .sf-mark glyph,
  // in the frame's muted colour; the rendered page is held by src/app/about/__tests__/page.test.tsx.
  it("About has no <sup> and no letters TM: its marks are the frame's", () => {
    const about = read('app', 'about', 'page.tsx');
    expect(about).toMatch(/<span className="sf-mark sf-mark--tm">™<\/span>/); // must-find: the reader sees the marks
    expect(about).not.toMatch(/<sup\b/);
    expect(about).not.toMatch(/>TM</);
  });
});

// Same kind as M1, in files this release already touches (Orch-FRAME-2's rule for extra finds): the "Back to Projects"
// link under "Project not found." had no dark colour, blue-600 on #101828 (3.38:1 measured). blue-400 is 6.72:1.
describe('the "Back to Projects" link under "Project not found." has a dark colour', () => {
  it.each([
    ['project page', ['app', 'projects', '[id]', 'page.tsx']],
    ['edit page', ['app', 'projects', '[id]', 'edit', 'page.tsx']],
  ])('%s', (_name, path) => {
    const m = /Project not found\.<\/p>\s*<Link[^>]*?className="([^"]*)"[^>]*>\s*Back to Projects/.exec(read(...path));
    expect(m, 'the link is there').not.toBeNull();
    expect(m![1]!.split(/\s+/)).toEqual(expect.arrayContaining(['text-blue-600', 'dark:text-blue-400']));
  });
});

describe("M4: the printed report keeps its own footer; the frame's footer still does not print", () => {
  const print = /@media print\s*\{([\s\S]*?)\n\}/.exec(read('app', 'globals.css'))![1]!.replace(/\/\*[\s\S]*?\*\//g, '');
  it('the print block hides the frame footer by its class, never bare `footer`', () => {
    const hide = /([^{}]+)\{\s*display:\s*none\s*!important;?\s*\}/.exec(print)![1]!.split(',').map((s) => s.trim());
    expect(hide).toContain('.sf-footer');
    expect(hide).not.toContain('footer');
    expect(print).not.toMatch(/(^|[\s,])footer\s*[,{]/);
  });
  it("PrintableReport's <footer> and the frame's are the only two, and the frame's carries .sf-footer", () => {
    expect(read('components', 'Footer.tsx')).toMatch(/<footer className="sf-footer"/);
    expect(read('components', 'PrintableReport.tsx')).toMatch(/<footer className="mt-6/);
  });
});

// v0.47.0 (FRAME26 pass 3): the line under About's title is gone (contract §3 About page: the page sits directly below
// the heading row). The tagline's wording is now held by the brand row and by the page's meta description
// (src/app/__tests__/frame-about.test.ts, M1).
describe("M5: About has no line under its title; the tagline keeps its wording", () => {
  it('the heading row is followed directly by the About page, and the old wording is gone', () => {
    const about = read('app', 'about', 'page.tsx');
    expect(about).toMatch(/<\/HeadingRow>\s*<div className="sf-about" data-sf="about">/);
    expect(about).not.toContain('APP_TAGLINE');
    expect(about).not.toContain('Scrum project budget forecasting tool');
    expect(APP_TAGLINE).toBe('Project budget forecasting for any project type');
  });
});

describe("M6: the invitation's sign-in error line reaches 4.5:1 on the info ground", () => {
  it('red-700 on #eff6ff, red-400 on #162456', () => {
    expect(read('components', 'InvitationBanner.tsx')).toContain('<p className="text-sm text-red-700 dark:text-red-400">{signInError}</p>');
    expect(ratio(PALETTE['red-700']!, '#eff6ff')).toBeGreaterThanOrEqual(4.5);
    expect(ratio(PALETTE['red-400']!, '#162456')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('E: the outermost crash screen', () => {
  afterEach(() => localStorage.clear());
  const err = Object.assign(new Error('a secret value from the data'), { digest: 'x' });

  it.each([
    ['light', 'light', false],
    ['dark', 'dark', true],
  ] as const)('%s: its own <html>, the theme from msb:theme, the words, Reload, and no error text', (_t, stored, dark) => {
    localStorage.setItem('msb:theme', stored);
    const html = renderToStaticMarkup(<GlobalError error={err} />);
    expect(html.startsWith('<html')).toBe(true);
    expect(/<html[^>]*class="dark"/.test(html)).toBe(dark);
    expect(html).toContain(dark ? 'background:#101828' : 'background:#ffffff');
    expect(html).toContain('<h1');
    expect(html).toContain('Something went wrong</h1>');
    expect(html).toContain('MyScrumBudget<span class="sf-mark sf-mark--tm">™</span> could not display this page. Reload to try');
    expect(html).toMatch(/<button[^>]*>Reload<\/button>/);
    expect(html).not.toContain('secret');
  });

  it('takes the page ground and text from the frame', () => {
    const html = renderToStaticMarkup(<GlobalError error={err} />);
    expect(html).toContain('background:var(--sf-page)');
    expect(html).toContain('color:var(--sf-text)');
    expect(read('app', 'global-error.tsx')).toMatch(/^import '\.\/globals\.css';$/m);
  });
});
