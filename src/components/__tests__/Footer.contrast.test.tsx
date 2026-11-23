// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The footer on the frame (FRAME26, v0.45.0). REWRITTEN: until v0.44.14 this pinned stage 0's colour pairs
 * (`text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300`, MSB-1) on every link. The frame
 * replaces them with its own `--sf-link` and hover underline (`.sf-footer a`), and the stylesheet is unlayered, so a
 * colour utility left on a link would only be dead weight. This pins the frame's shape and measures its tokens.
 *
 * jsdom applies no CSS, so the tokens are read from the vendored stylesheet and their contrast computed here.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Footer } from '../Footer';
import { contrast, rule, token, trunc } from '@/styles/__tests__/frameTokens.testkit';

vi.mock('next/link', () => ({
  default: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}));

const controls = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('footer a, footer button')];

describe('Footer: the frame footer', () => {
  it('has exactly six controls: five links and the Keyboard shortcuts button, wording unchanged', () => {
    const { container } = render(<Footer />);
    expect(controls(container).map((e) => e.textContent?.trim())).toEqual([
      expect.stringMatching(/^Version \d+\.\d+\.\d+$/),
      'Keyboard shortcuts',
      'SPERT® Suite',
      'Terms of Service',
      'Privacy Policy',
      'License',
    ]);
  });

  it('is footer.sf-footer > .sf-col > two lines, with its hook', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer')!;
    expect(footer.className).toBe('sf-footer');
    expect(footer.getAttribute('data-sf')).toBe('footer');
    const col = footer.firstElementChild as HTMLElement;
    expect(col.className).toBe('sf-col');
    expect(col.children).toHaveLength(2);
  });

  it('no link carries a class or a style of its own; the button is .sf-link (the frame colours both)', () => {
    const { container } = render(<Footer />);
    for (const el of controls(container)) {
      expect(el.getAttribute('style'), el.textContent ?? '').toBeNull();
      if (el.tagName === 'A') expect(el.getAttribute('class'), el.textContent ?? '').toBeNull();
      else expect(el.className).toBe('sf-link');
    }
  });

  it('the stylesheet colours the links with --sf-link and underlines them on hover', () => {
    expect(rule('.sf-footer a, .sf-footer .sf-link')).toMatch(/color:\s*var\(--sf-link\)/);
    expect(rule('.sf-footer a:hover, .sf-footer .sf-link:hover')).toMatch(/text-decoration:\s*underline/);
  });

  it('--sf-link meets 4.5 : 1 on the page ground in both themes, and under more contrast (5.24 / 6.72 truncated; the contract rounds them to 5.25 / 6.73)', () => {
    for (const more of [false, true]) {
      const light = contrast(token('light', '--sf-link', more), token('light', '--sf-page', more));
      const dark = contrast(token('dark', '--sf-link', more), token('dark', '--sf-page', more));
      expect(light).toBeGreaterThanOrEqual(4.5);
      expect(dark).toBeGreaterThanOrEqual(4.5);
      if (!more) expect([trunc(light), trunc(dark)]).toEqual(['5.24', '6.72']);
    }
  });
});
