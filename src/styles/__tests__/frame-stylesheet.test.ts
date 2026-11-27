// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * The SPERT® Suite app frame's stylesheet (FRAME26, v0.45.0), vendored byte for byte from the canonical copy in
 * spert-suite-docs (`suite/frame/spert-frame.css`). Every adopting app pins the same md5, so a local edit, or a copy
 * that missed a canonical change, fails here, not in a user's window. It is a byte-identical shared artifact, like
 * `scripts/shipgate.mjs`: never edit it in one repo alone.
 *
 * If this fails because the canonical file changed: copy it again (`cp`), check `md5 -q` against the md5 the campaign
 * gives you, and update PINNED in the same commit. Never edit the vendored copy to make this pass.
 */
const PINNED = 'b00d0759ec0a0a4d2db6ba10b16678f0';
const SRC = join(process.cwd(), 'src');
const VENDORED = join(SRC, 'styles', 'spert-frame.css');
const GLOBALS = join(SRC, 'app', 'globals.css');
/** An import of the stylesheet, in CSS (`@import "…spert-frame.css"`) or in a module (`import '…spert-frame.css'`). */
const IMPORTS_IT = /(?:@import\s+(?:url\()?|import\s+|from\s+)["'][^"']*spert-frame\.css["']/g;

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe('the vendored frame stylesheet', () => {
  it('is byte-identical to the canonical copy whose md5 is pinned here', () => {
    // md5 is the campaign's identifier for the file (every adopting repo pins it, checked with `md5 -q`): a
    // byte-identity check, not a security use.
    const md5 = createHash('md5').update(readFileSync(VENDORED)).digest('hex');
    expect(md5).toBe(PINNED);
  });

  it('declares the version the pin was taken at', () => {
    expect(readFileSync(VENDORED, 'utf8')).toMatch(/--sf-version: "3";/);
  });

  it('is imported exactly once, by globals.css, right after Tailwind, unlayered', () => {
    const css = readFileSync(GLOBALS, 'utf8');
    const imports = Array.from(css.matchAll(IMPORTS_IT)).map((m) => m[0]);
    expect(imports).toEqual(['@import "../styles/spert-frame.css"']);
    // A layer() would put it under Tailwind's utilities, and any utility could then move the frame (contract §9.2).
    const line = css.split('\n').find((l) => l.includes('spert-frame.css') && l.trimStart().startsWith('@import'));
    expect(line).toBe('@import "../styles/spert-frame.css";');
    const tailwind = css.indexOf('@import "tailwindcss";');
    expect(tailwind).toBeGreaterThan(-1);
    expect(tailwind).toBeLessThan(css.indexOf(line!));
  });

  it('is imported by nothing else under src/ (must-find: the reader does see globals.css)', () => {
    const importers = filesUnder(SRC)
      .filter((f) => /\.(?:css|ts|tsx|js|jsx|mjs)$/.test(f) && !f.includes('.test.'))
      .filter((f) => Array.from(readFileSync(f, 'utf8').matchAll(IMPORTS_IT)).length > 0);
    expect(importers).toEqual([GLOBALS]);
  });
});
