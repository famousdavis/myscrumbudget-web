// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The © year across a year boundary (FRAME26 Y1, v0.47.0). The page is prerendered at build time, so its HTML carries
 * the build's year; a visitor's browser may be in a later one. Here "the server" renders with the clock in 2026 and
 * "the browser" hydrates in 2027, the state every page is in from 1 January until the next deploy.
 *
 * Two controls come first, so the third test's silence means something:
 *   1. the footer's old form, `{new Date().getFullYear()}` rendered plainly, DOES report a hydration mismatch here;
 *   2. `suppressHydrationWarning` alone silences it but keeps the server's year on screen (React does not patch a
 *      suppressed text mismatch), which is why CopyrightYear swaps the span's key after hydrating.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { CopyrightYear } from '../CopyrightYear';

// React's act() without Testing Library: say this is an act environment, or React logs a notice that would be counted
// as a console error below and hide whether hydration itself logged one.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
afterEach(() => {
  for (const r of roots) act(() => r.unmount());
  roots = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const at = (year: number) => vi.setSystemTime(new Date(year, 0, 1, 9, 0, 0));

/** Render `node` in `serverYear`, hydrate it in `clientYear`; return the text shown and every mismatch React reported. */
async function buildThenVisit(node: React.ReactElement, serverYear: number, clientYear: number) {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  at(serverYear);
  const html = renderToString(node);
  at(clientYear);
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  const mismatches: unknown[] = [];
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => {
    roots.push(hydrateRoot(container, node, { onRecoverableError: (e) => mismatches.push(e) }));
  });
  return { html, text: container.textContent, mismatches, consoleErrors: errors.mock.calls.length };
}

function PlainYear() {
  return <span>{new Date().getFullYear()}</span>;
}
function SuppressedOnly() {
  return <span suppressHydrationWarning>{new Date().getFullYear()}</span>;
}

describe('the © year across a year boundary (build in 2026, visit in 2027)', () => {
  it('control 1: the old plain form reports a hydration mismatch', async () => {
    const r = await buildThenVisit(<p>© <PlainYear /></p>, 2026, 2027);
    expect(r.html).toContain('2026');
    expect(r.mismatches.length).toBeGreaterThan(0);
  });

  it('control 2: suppressHydrationWarning alone reports nothing, and leaves the BUILD\'s year on screen', async () => {
    const r = await buildThenVisit(<p>© <SuppressedOnly /></p>, 2026, 2027);
    expect(r.mismatches).toEqual([]);
    expect(r.text).toBe('© 2026');
  });

  it('CopyrightYear: the prerendered HTML carries the build\'s year; the browser shows its own, with no mismatch and no console error', async () => {
    const r = await buildThenVisit(<p>© <CopyrightYear /></p>, 2026, 2027);
    expect(r.html).toContain('2026');
    expect(r.mismatches).toEqual([]);
    expect(r.consoleErrors).toBe(0);
    expect(r.text).toBe('© 2027');
  });

  it('CopyrightYear in the same year: no mismatch, the same year', async () => {
    const r = await buildThenVisit(<p>© <CopyrightYear /></p>, 2026, 2026);
    expect(r.mismatches).toEqual([]);
    expect(r.text).toBe('© 2026');
  });
});
