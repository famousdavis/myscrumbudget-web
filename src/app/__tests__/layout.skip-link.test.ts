// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The skip link is hidden at rest (FRAME26 stage 0, MSB-3). It sits at `top-2`
 * (8 px) and was moved up by `-translate-y-full`, its own height, so 8 px of it
 * showed on every screen (its box ran from y = -28 to +8 in Chrome). It now
 * moves up by its height plus 1rem: at rest its box ends at y = -8, and one Tab
 * still brings it fully into view (`focus:translate-y-0`).
 *
 * jsdom has no layout, so this reads the class string from `layout.tsx`; the
 * geometry was measured in Chrome over CDP.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const LAYOUT = readFileSync(join(process.cwd(), 'src', 'app', 'layout.tsx'), 'utf8');

function skipLinkTokens(): string[] {
  const m = LAYOUT.match(/<a\s+href="#main-content"\s+className="([^"]+)"/);
  if (!m) throw new Error('the skip link was not found in layout.tsx');
  return m[1].split(/\s+/);
}

describe('layout: the skip link', () => {
  it('targets #main-content, and main carries that id', () => {
    expect(skipLinkTokens().length).toBeGreaterThan(0);
    expect(LAYOUT).toMatch(/<main id="main-content"/);
  });

  it('is pushed up by its height PLUS the 8 px it starts down, so none of it shows at rest', () => {
    const t = skipLinkTokens();
    expect(t).toContain('top-2');
    expect(t, 'top-2 needs more than its own height to hide').toContain('-translate-y-[calc(100%+1rem)]');
    expect(t, '-translate-y-full alone leaves an 8 px sliver').not.toContain('-translate-y-full');
  });

  it('comes fully into view on focus', () => {
    expect(skipLinkTokens()).toContain('focus:translate-y-0');
  });
});
