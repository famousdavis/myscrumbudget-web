// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  flushAll: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  cancelAll: vi.fn(),
  getStorageMode: vi.fn<() => 'local' | 'cloud'>(() => 'local'),
  auth: { currentUser: null as { uid: string } | null },
}));

vi.mock('@/lib/storage/pendingSaveRegistry', () => ({
  flushAll: mocks.flushAll,
  cancelAll: mocks.cancelAll,
}));
vi.mock('@/lib/storage/storageMode', () => ({
  getStorageMode: mocks.getStorageMode,
}));
vi.mock('@/lib/firebase/config', () => ({
  auth: mocks.auth,
}));

import { registerTabCloseFlush } from '../tabCloseFlush';

describe('registerTabCloseFlush', () => {
  beforeEach(() => {
    mocks.flushAll.mockReset().mockResolvedValue(undefined);
    mocks.cancelAll.mockReset();
    mocks.getStorageMode.mockReturnValue('local');
    mocks.auth.currentUser = null;
  });

  it('registers distinct pagehide and beforeunload handlers', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const cleanup = registerTabCloseFlush();
    const calls = addSpy.mock.calls;
    const pageHideHandler = calls.find(([type]) => type === 'pagehide')?.[1];
    const beforeUnloadHandler = calls.find(([type]) => type === 'beforeunload')?.[1];
    expect(pageHideHandler).toBeDefined();
    expect(beforeUnloadHandler).toBeDefined();
    expect(pageHideHandler).not.toBe(beforeUnloadHandler);
    cleanup();
    addSpy.mockRestore();
  });

  it('cleanup removes both listeners', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const cleanup = registerTabCloseFlush();
    cleanup();
    const types = removeSpy.mock.calls.map(([type]) => type);
    expect(types).toContain('pagehide');
    expect(types).toContain('beforeunload');
    removeSpy.mockRestore();
  });

  it('calls flushAll in local mode (no credentials required)', () => {
    mocks.getStorageMode.mockReturnValue('local');
    mocks.auth.currentUser = null;
    const cleanup = registerTabCloseFlush();
    window.dispatchEvent(new Event('pagehide'));
    expect(mocks.flushAll).toHaveBeenCalledTimes(1);
    expect(mocks.cancelAll).not.toHaveBeenCalled();
    cleanup();
  });

  it('calls flushAll in cloud mode with authenticated user', () => {
    mocks.getStorageMode.mockReturnValue('cloud');
    mocks.auth.currentUser = { uid: 'user-123' };
    const cleanup = registerTabCloseFlush();
    window.dispatchEvent(new Event('beforeunload'));
    expect(mocks.flushAll).toHaveBeenCalledTimes(1);
    expect(mocks.cancelAll).not.toHaveBeenCalled();
    cleanup();
  });

  it('calls cancelAll (not flushAll) in cloud mode with no current user', () => {
    mocks.getStorageMode.mockReturnValue('cloud');
    mocks.auth.currentUser = null;
    const cleanup = registerTabCloseFlush();
    window.dispatchEvent(new Event('pagehide'));
    expect(mocks.cancelAll).toHaveBeenCalledTimes(1);
    expect(mocks.flushAll).not.toHaveBeenCalled();
    cleanup();
  });
});
