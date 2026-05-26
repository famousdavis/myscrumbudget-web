// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  register, cancelAll, flushAll,
  registerKeyed, cancelByKey,
} from '../pendingSaveRegistry';

function makeInstance() {
  const cancel = vi.fn();
  const flush = vi.fn<[], Promise<void>>().mockResolvedValue(undefined);
  const unregister = register(cancel, flush);
  return { cancel, flush, unregister };
}

describe('pendingSaveRegistry', () => {
  beforeEach(() => { cancelAll(); void flushAll(); });

  describe('cancelAll', () => {
    it('invokes a registered cancel callback', () => {
      const { cancel } = makeInstance();
      cancelAll();
      expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('unregister removes both cancel and flush', () => {
      const { cancel, flush, unregister } = makeInstance();
      unregister();
      cancelAll(); void flushAll();
      expect(cancel).not.toHaveBeenCalled();
      expect(flush).not.toHaveBeenCalled();
    });

    it('invokes every registered cancel callback once', () => {
      const a = makeInstance(); const b = makeInstance(); const c = makeInstance();
      cancelAll();
      expect(a.cancel).toHaveBeenCalledTimes(1);
      expect(b.cancel).toHaveBeenCalledTimes(1);
      expect(c.cancel).toHaveBeenCalledTimes(1);
    });

    it('double-unregister is safe', () => {
      const { cancel, unregister } = makeInstance();
      unregister();
      expect(() => unregister()).not.toThrow();
      cancelAll();
      expect(cancel).not.toHaveBeenCalled();
    });

    it('callbacks remain registered across multiple cancelAll calls', () => {
      const { cancel } = makeInstance();
      cancelAll(); cancelAll();
      expect(cancel).toHaveBeenCalledTimes(2);
    });
  });

  describe('flushAll', () => {
    it('invokes every registered flush callback', async () => {
      const a = makeInstance(); const b = makeInstance();
      await flushAll();
      expect(a.flush).toHaveBeenCalledTimes(1);
      expect(b.flush).toHaveBeenCalledTimes(1);
    });

    it('resolves even when one flush rejects', async () => {
      const good = makeInstance();
      const bad = makeInstance();
      bad.flush.mockRejectedValueOnce(new Error('network'));
      await expect(flushAll()).resolves.toBeUndefined();
      expect(good.flush).toHaveBeenCalledTimes(1);
    });

    it('unregister removes flush from flushAll', async () => {
      const { flush, unregister } = makeInstance();
      unregister();
      await flushAll();
      expect(flush).not.toHaveBeenCalled();
    });
  });

  describe('registerKeyed / cancelByKey', () => {
    const cleanups: Array<() => void> = [];
    afterEach(() => { cleanups.forEach((fn) => fn()); cleanups.length = 0; });

    it('cancelByKey invokes only callbacks for the matching key', () => {
      const cancelA = vi.fn(); const cancelB = vi.fn();
      cleanups.push(registerKeyed('proj-A', cancelA));
      cleanups.push(registerKeyed('proj-B', cancelB));
      cancelByKey('proj-A');
      expect(cancelA).toHaveBeenCalledTimes(1);
      expect(cancelB).not.toHaveBeenCalled();
    });

    it('unregister removes only the specific keyed callback', () => {
      const cancel1 = vi.fn(); const cancel2 = vi.fn();
      const unregister1 = registerKeyed('proj-X', cancel1);
      cleanups.push(registerKeyed('proj-X', cancel2));
      unregister1();
      cancelByKey('proj-X');
      expect(cancel1).not.toHaveBeenCalled();
      expect(cancel2).toHaveBeenCalledTimes(1);
    });

    it('cancelByKey is a no-op for an unknown key', () => {
      expect(() => cancelByKey('nonexistent')).not.toThrow();
    });
  });
});
