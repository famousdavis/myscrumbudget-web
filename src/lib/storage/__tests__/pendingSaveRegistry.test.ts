// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { register, cancelAll } from '../pendingSaveRegistry';

describe('pendingSaveRegistry', () => {
  beforeEach(() => {
    // Drain any stragglers from prior tests by calling cancelAll until the
    // internal set is effectively inert (the helpers we register here don't
    // re-register themselves, so a single pass is sufficient).
    cancelAll();
  });

  it('invokes a registered callback on cancelAll', () => {
    const cb = vi.fn();
    register(cb);
    cancelAll();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('returns an unregister function that removes the callback', () => {
    const cb = vi.fn();
    const unregister = register(cb);
    unregister();
    cancelAll();
    expect(cb).not.toHaveBeenCalled();
  });

  it('invokes every registered callback exactly once per cancelAll', () => {
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    register(a);
    register(b);
    register(c);
    cancelAll();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
  });

  it('double-unregister is safe (no throw, no side effects)', () => {
    const cb = vi.fn();
    const unregister = register(cb);
    unregister();
    expect(() => unregister()).not.toThrow();
    cancelAll();
    expect(cb).not.toHaveBeenCalled();
  });

  it('callbacks remain registered across multiple cancelAll calls', () => {
    const cb = vi.fn();
    register(cb);
    cancelAll();
    cancelAll();
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
