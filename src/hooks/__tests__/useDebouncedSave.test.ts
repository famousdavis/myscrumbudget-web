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
});
