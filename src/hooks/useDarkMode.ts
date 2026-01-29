'use client';

import { useState, useEffect } from 'react';

/**
 * Detect whether dark mode is active.
 * Checks both Tailwind's `dark` class on <html> and prefers-color-scheme.
 * Needed because SVG inline attributes can't use Tailwind's `dark:` variant.
 */
export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    function check() {
      const htmlDark = document.documentElement.classList.contains('dark');
      const mediaDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(htmlDark || mediaDark);
    }

    check();

    // Watch for class changes on <html> (Tailwind toggling)
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Watch for system preference changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', check);

    return () => {
      observer.disconnect();
      mq.removeEventListener('change', check);
    };
  }, []);

  return isDark;
}
