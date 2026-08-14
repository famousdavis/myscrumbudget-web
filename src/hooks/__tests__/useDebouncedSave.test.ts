// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedSave } from '../useDebouncedSave';

describe('useDebouncedSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call saveFn immediately', () => {
    const saveFn = vi.fn();
    const { result } = renderHook(() => useDebouncedSave(saveFn));

    act(() => result.current.save('hello'));
    expect(saveFn).not.toHaveBeenCalled();
  });

  it('calls saveFn after debounce delay', () => {
    const saveFn = vi.fn();
    const { result } = renderHook(() => useDebouncedSave(saveFn));

    act(() => result.current.save('hello'));
    act(() => { vi.advanceTimersByTime(500); });

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith('hello');
  });

  it('debounces rapid calls — only last value is saved', () => {
    const saveFn = vi.fn();
    const { result } = renderHook(() => useDebouncedSave(saveFn));

    act(() => result.current.save('a'));
    act(() => { vi.advanceTimersByTime(200); });
    act(() => result.current.save('b'));
    act(() => { vi.advanceTimersByTime(200); });
    act(() => result.current.save('c'));
    act(() => { vi.advanceTimersByTime(500); });

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith('c');
  });

  it('flush() immediately persists pending value', () => {
    const saveFn = vi.fn();
    const { result } = renderHook(() => useDebouncedSave(saveFn));

    act(() => result.current.save('urgent'));
    act(() => { void result.current.flush(); });

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith('urgent');
  });

  it('flush() does nothing when no pending value', () => {
    const saveFn = vi.fn();
    const { result } = renderHook(() => useDebouncedSave(saveFn));

    act(() => { void result.current.flush(); });
    expect(saveFn).not.toHaveBeenCalled();
  });

  it('flush() cancels the pending timer', () => {
    const saveFn = vi.fn();
    const { result } = renderHook(() => useDebouncedSave(saveFn));

    act(() => result.current.save('data'));
    act(() => { void result.current.flush(); });
    act(() => { vi.advanceTimersByTime(500); });

    // Should only have been called once (by flush), not twice
    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  it('works with complex objects', () => {
    const saveFn = vi.fn();
    const { result } = renderHook(() => useDebouncedSave<{ name: string; count: number }>(saveFn));

    const obj = { name: 'test', count: 42 };
    act(() => result.current.save(obj));
    act(() => { vi.advanceTimersByTime(500); });

    expect(saveFn).toHaveBeenCalledWith(obj);
  });

  it('flush() swallows a rejected saveFn promise without an unhandled rejection', async () => {
    // Real timers — we need the microtask queue to actually drain so the
    // .catch() handler fires. Fake timers would leave the rejection pending.
    vi.useRealTimers();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const saveFn = vi.fn(() => Promise.reject(new Error('save boom')) as unknown as void);

    const { result } = renderHook(() => useDebouncedSave<string>(saveFn));

    act(() => result.current.save('data'));
    act(() => { void result.current.flush(); });

    // Drain microtasks so the .catch() inside flush() runs.
    await Promise.resolve();
    await Promise.resolve();

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[useDebouncedSave] flush failed:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  /* ── L9: the debounced save's failure log must not carry the payload ──
   *
   * v0.28.2 added this guarantee and, until v0.36.4, the line it guards had
   * never executed: the surrounding debounce ran 149 times in the suite while
   * this catch ran zero times — in a file reporting 84.8% coverage. The file's
   * own number argued that something had checked it. Nothing had.
   *
   * The assertion is deliberately about ABSENCE of the payload rather than the
   * exact call shape. The property worth protecting is "a Project / Settings /
   * TeamPool payload containing member emails or UIDs never reaches the
   * console", not "console.error was called with two arguments".
   */
  it('save failure logs the error WITHOUT the payload (no PII in console)', async () => {
    vi.useRealTimers();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const saveFn = vi.fn().mockRejectedValue(new Error('firestore unavailable'));
    const { result } = renderHook(() =>
      useDebouncedSave<{ email: string }>(saveFn),
    );

    // A payload carrying exactly the kind of value the guard exists to keep out.
    const SECRET = 'member@example.com';
    act(() => result.current.save({ email: SECRET }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });

    expect(saveFn).toHaveBeenCalledWith({ email: SECRET });
    expect(consoleSpy).toHaveBeenCalled();

    // No logged argument, at any depth, may contain the payload.
    const logged = consoleSpy.mock.calls.flat();
    const serialised = logged
      .map((a) => (a instanceof Error ? a.message : JSON.stringify(a) ?? String(a)))
      .join(' ');
    expect(serialised).not.toContain(SECRET);
    expect(serialised).toContain('firestore unavailable');

    consoleSpy.mockRestore();
  });

  describe('registry integration', () => {
    it('flush registered with registry is called by flushAll()', async () => {
      vi.useRealTimers();
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useDebouncedSave<string>(saveFn));
      act(() => result.current.save('pending'));
      const { flushAll } = await import('@/lib/storage/pendingSaveRegistry');
      await act(async () => { await flushAll(); });
      expect(saveFn).toHaveBeenCalledWith('pending');
    });
  });
});
