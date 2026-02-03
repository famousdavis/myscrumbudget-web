'use client';

import { useState, useEffect } from 'react';
import type { ThemeMode } from '@/types/domain';
import { STORAGE_KEYS } from '@/types/storage';

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const val = localStorage.getItem(STORAGE_KEYS.theme);
    if (val === 'light' || val === 'dark' || val === 'system') return val;
  } catch {
    // localStorage may be unavailable
  }
  return 'system';
}

function applyTheme(mode: ThemeMode): void {
  const isDark =
    mode === 'dark' ||
    (mode === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getStoredTheme);
  const [mounted, setMounted] = useState(false);

  // Mark as mounted after hydration
  useEffect(() => setMounted(true), []);

  // Apply theme on mount and when mode changes
  useEffect(() => {
    applyTheme(mode);
    try {
      localStorage.setItem(STORAGE_KEYS.theme, mode);
    } catch {
      // localStorage may be unavailable
    }
  }, [mode]);

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  // Return 'system' before mount to match server-rendered HTML and avoid hydration mismatch
  return { mode: mounted ? mode : 'system', setTheme: setMode, mounted };
}
