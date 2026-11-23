// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Footer links in dark mode (FRAME26 stage 0, MSB-1). Every footer link and the
 * "Keyboard shortcuts" button were `text-blue-600 hover:text-blue-700` with no
 * dark variant: on the dark footer (#101828) that measured 3.38 : 1 at rest and
 * 2.60 : 1 on hover, against a 4.5 bar. With `dark:text-blue-400
 * dark:hover:text-blue-300` it measures 6.73 and 9.79 (Chrome, computed colours).
 *
 * jsdom applies no CSS, so the class pair is what is pinned. Classes are
 * compared as WHOLE tokens: `dark:hover:text-blue-300` contains `text-blue-300`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Footer } from '../Footer';

vi.mock('next/link', () => ({
  default: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}));

const REQUIRED = ['text-blue-600', 'hover:text-blue-700', 'dark:text-blue-400', 'dark:hover:text-blue-300'];

describe('Footer: link colours', () => {
  it('has exactly six controls: five links and the Keyboard shortcuts button', () => {
    const { container } = render(<Footer />);
    const controls = container.querySelectorAll('footer a, footer button');
    expect(controls).toHaveLength(6);
  });

  it('every control carries the light AND dark colour pair', () => {
    const { container } = render(<Footer />);
    for (const el of container.querySelectorAll('footer a, footer button')) {
      const tokens = el.className.split(/\s+/);
      for (const t of REQUIRED) {
        expect(tokens, `"${el.textContent?.trim()}" lacks ${t}`).toContain(t);
      }
    }
  });
});
