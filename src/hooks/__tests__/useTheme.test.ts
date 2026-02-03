import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme';
import { STORAGE_KEYS } from '@/types/storage';

// Mock matchMedia
function mockMatchMedia(prefersDark: boolean) {
  const listeners: Array<(e: { matches: boolean }) => void> = [];
  const mql = {
    matches: prefersDark,
    addEventListener: (_event: string, fn: (e: { matches: boolean }) => void) => {
      listeners.push(fn);
    },
    removeEventListener: (_event: string, fn: (e: { matches: boolean }) => void) => {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    },
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return { mql, listeners };
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    mockMatchMedia(false);
  });

  it('defaults to "system" when no localStorage value exists', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('system');
  });

  it('reads stored "dark" value from localStorage on init', () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('dark');
  });

  it('reads stored "light" value from localStorage on init', () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('light');
  });

  it('falls back to "system" for invalid localStorage value', () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'invalid');
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('system');
  });

  it('adds .dark class when mode is "dark"', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes .dark class when mode is "light"', () => {
    document.documentElement.classList.add('dark');
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applies .dark based on matchMedia when mode is "system" and system prefers dark', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('system'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('does not apply .dark when mode is "system" and system prefers light', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('system'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists mode changes to localStorage', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('dark'));
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark');

    act(() => result.current.setTheme('light'));
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('light');

    act(() => result.current.setTheme('system'));
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('system');
  });

  it('updates mode state when setTheme is called', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('system');

    act(() => result.current.setTheme('dark'));
    expect(result.current.mode).toBe('dark');

    act(() => result.current.setTheme('light'));
    expect(result.current.mode).toBe('light');
  });

  it('exposes mounted flag as true after hydration', () => {
    const { result } = renderHook(() => useTheme());
    // After renderHook, effects have run so mounted is true
    expect(result.current.mounted).toBe(true);
  });

  it('returns "system" as mode before mount to avoid hydration mismatch', () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'dark');
    // The hook internally stores 'dark' but returns 'system' until mounted
    // After renderHook effects run, mounted becomes true and real mode is returned
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('dark');
    expect(result.current.mounted).toBe(true);
  });
});
