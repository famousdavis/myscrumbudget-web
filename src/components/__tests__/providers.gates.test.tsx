// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The two gates the frame needed (FRAME26, v0.45.0). The providers wrap the whole frame now, and never blank it; what
 * they used to blank is blanked by a gate placed where the old provider stack sat (the page, the invitation banner,
 * the Cloud Storage modal):
 *   - `MigrationGuard` renders nothing until `MigrationProvider` has run the storage migrations — ONCE, however many
 *     guards there are;
 *   - `RepositoryGate` renders nothing while a cloud session's auth is resolving, and is what provides the repository.
 * `RepositoryProvider.test.tsx` holds the gate's derivation; this holds the split.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const auth = vi.hoisted(() => ({ state: { user: null as { uid: string } | null, loading: false } }));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => auth.state }));
vi.mock('@/lib/storage/localStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage/localStorage')>();
  return { ...actual, createLocalStorageRepository: vi.fn(actual.createLocalStorageRepository) };
});

import { MigrationProvider, MigrationGuard } from '../MigrationGuard';
import { RepositoryProvider, RepositoryGate } from '../RepositoryProvider';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';

beforeEach(() => {
  localStorage.clear();
  auth.state = { user: null, loading: false };
  vi.mocked(createLocalStorageRepository).mockClear();
});

describe('MigrationProvider and MigrationGuard', () => {
  it('each guard renders nothing on the first render, then its children once migration has run', async () => {
    render(
      <MigrationProvider>
        <MigrationGuard><span>a</span></MigrationGuard>
        <MigrationGuard><span>b</span></MigrationGuard>
      </MigrationProvider>,
    );
    expect(screen.queryByText('a')).toBeNull();
    expect(screen.queryByText('b')).toBeNull();
    expect(await screen.findByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('runs the migration ONCE for three guards', async () => {
    const before = vi.mocked(createLocalStorageRepository).mock.calls.length;
    render(
      <MigrationProvider>
        <MigrationGuard><span>1</span></MigrationGuard>
        <MigrationGuard><span>2</span></MigrationGuard>
        <MigrationGuard><span>3</span></MigrationGuard>
      </MigrationProvider>,
    );
    await screen.findByText('3');
    expect(vi.mocked(createLocalStorageRepository).mock.calls.length - before).toBe(1);
  });

  it('a guard outside the provider throws rather than rendering unmigrated', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<MigrationGuard><span>x</span></MigrationGuard>)).toThrow(/within MigrationProvider/);
  });
});

describe('RepositoryProvider and RepositoryGate', () => {
  it('the provider never blanks; the gate blanks while a cloud session is resolving, then opens', () => {
    localStorage.setItem('msb:storageMode', 'cloud');
    auth.state = { user: null, loading: true };
    const tree = () => (
      <RepositoryProvider>
        <span>frame</span>
        <RepositoryGate><span>gated</span></RepositoryGate>
      </RepositoryProvider>
    );
    const { rerender } = render(tree());
    expect(screen.getByText('frame')).toBeInTheDocument();
    expect(screen.queryByText('gated')).toBeNull();
    act(() => { auth.state = { user: null, loading: false }; rerender(tree()); });
    expect(screen.getByText('gated')).toBeInTheDocument();
  });

  it('local mode is never gated, even while auth loads', () => {
    auth.state = { user: null, loading: true };
    render(<RepositoryProvider><RepositoryGate><span>gated</span></RepositoryGate></RepositoryProvider>);
    expect(screen.getByText('gated')).toBeInTheDocument();
  });

  it('a gate outside the provider throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<RepositoryGate><span>x</span></RepositoryGate>)).toThrow(/within RepositoryProvider/);
  });
});
