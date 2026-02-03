'use client';

import { useState, useEffect } from 'react';

/**
 * Detect whether dark mode is active by reading the `.dark` class on <html>.
 * The `useTheme` hook is authoritative for toggling the class; this hook
 * is a read-only observer used by SVG charts (which can't use Tailwind's
 * `dark:` variant on inline attributes).
 */
export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    function check() {
      setIsDark(document.documentElement.classList.contains('dark'));
    }

    check();

    // Watch for class changes on <html> (toggled by useTheme)
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return isDark;
}
