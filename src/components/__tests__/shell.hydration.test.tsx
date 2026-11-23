// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The frame renders on the server, and hydrates without a mismatch, in the two states nothing else exercises
 * (FRAME26, v0.45.0, open point 1):
 *
 *   - a CLOUD user's boot: `msb:storageMode` = "cloud" and Firebase available, so auth is still resolving;
 *   - an INVITATION landing: an invite token in sessionStorage.
 *
 * Both used to be safe only because the whole provider stack and every frame part that reads them sat inside the old
 * `MigrationGuard`, which rendered nothing on the server and on the first client render. `RepositoryProvider`'s
 * `useState(() => getStorageMode())` and `useInvitationLanding`'s `useState(() => sessionStorage…)` read storage the
 * server does not have (the v0.36.2 `FirstRunBanner` React #418 class). The frame moved the providers to the root, so
 * this pins that what reads them is still gated and that the rest of the frame really is on the server.
 *
 * jsdom has a `window` during `renderToString`, so "the server" is simulated: storage reads return nothing while the
 * server HTML is rendered, then the real values while the client hydrates. The first test is the positive control: it
 * proves the harness sees a mismatch when there is one, so the others' silence means something.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';

const server = vi.hoisted(() => ({ phase: false }));
const auth = vi.hoisted(() => ({ state: { user: null, loading: true } }));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => auth.state }));
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: () => {}, replace: () => {} }) }));
vi.mock('next/link', () => ({
  default: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}));

import { Shell } from './shellTestHarness';
import { INVITE_SESSION_KEY } from '@/hooks/useInvitationLanding';

const realGetItem = Storage.prototype.getItem;
let roots: Root[] = [];

beforeEach(() => {
  auth.state = { user: null, loading: true };
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('msb:storageMode', 'cloud');
  sessionStorage.setItem(INVITE_SESSION_KEY, 'tok-123');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
    return server.phase ? null : realGetItem.call(this, key);
  });
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  for (const r of roots) act(() => r.unmount());
  roots = [];
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

/** Server-render `node` with storage hidden, then hydrate it with storage back; return the HTML and the mismatches. */
async function serverThenHydrate(node: React.ReactElement) {
  server.phase = true;
  const html = renderToString(node);
  server.phase = false;
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  const mismatches: unknown[] = [];
  await act(async () => {
    roots.push(hydrateRoot(container, node, { onRecoverableError: (e) => mismatches.push(e) }));
  });
  return { html, container, mismatches };
}

/** Reads storage during render, as the two lazy states do: the shape this file exists to keep out of hydration. */
function ReadsStorageInRender() {
  const [v] = useState(() => (typeof window === 'undefined' ? null : localStorage.getItem('msb:storageMode')));
  return <span>{v ?? 'none'}</span>;
}

describe('the frame on the server, and hydrating', () => {
  it('positive control: the harness reports a mismatch when a component reads storage during render', async () => {
    const { mismatches } = await serverThenHydrate(<ReadsStorageInRender />);
    expect(mismatches.length).toBeGreaterThan(0);
  });

  it('hydrates without a mismatch for a cloud user mid-auth who arrived by an invitation link', async () => {
    const { mismatches } = await serverThenHydrate(<Shell><p>page</p></Shell>);
    expect(mismatches).toEqual([]);
  });

  it('hydrates without a mismatch for a LOCAL user who arrived by an invitation link (a new user\'s usual landing)', async () => {
    // Local mode: the repository gate is open on both sides, so only MigrationGuard keeps the banner's lazy
    // `pre_auth` (read from sessionStorage in the browser, `idle` on the server) out of the first render.
    auth.state.loading = false;
    localStorage.setItem('msb:storageMode', 'local');
    const { mismatches, container } = await serverThenHydrate(<Shell><p>page</p></Shell>);
    expect(mismatches).toEqual([]);
    // And the banner does arrive once migration has run: the gate delays it, it does not lose it.
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  it('the server HTML holds the frame (brand, chip, navigation, footer) and an empty main', async () => {
    const { html } = await serverThenHydrate(<Shell><p>page</p></Shell>);
    for (const hook of ['skip', 'brand', 'theme', 'chip', 'nav', 'notices', 'footer']) expect(html, hook).toContain(`data-sf="${hook}"`);
    expect(html).toContain('Local only');
    expect(html).toMatch(/<main[^>]*><\/main>/);
  });

  it('after hydration, the cloud user still sees no page and no invitation while auth resolves; the frame stays', async () => {
    const { container } = await serverThenHydrate(<Shell><p>page</p></Shell>);
    expect(container.querySelector('[data-sf="brand"]')).not.toBeNull();
    expect(container.querySelector('main')!.textContent).toBe('');
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
