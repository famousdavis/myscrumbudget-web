// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The frame's theme button (FRAME26, v0.45.0), which replaced the three-way Light / Dark / System switch. It cycles
 * System → Light → Dark → System (contract §2) and writes the SAME stored values as before (`msb:theme`), so nobody's
 * choice is lost. Its icon carries state, so it draws in `currentColor` (the frame's muted colour) with no fixed fill and
 * no opacity (WCAG 1.4.11).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeToggle } from '../ThemeToggle';
import { rule } from '@/styles/__tests__/frameTokens.testkit';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => document.documentElement.classList.remove('dark'));

const button = () => screen.getByRole('button');

describe('ThemeToggle: the frame theme button', () => {
  it('is one .sf-theme button with its hook, no radiogroup', () => {
    render(<ThemeToggle />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(button().className).toBe('sf-theme');
    expect(button().getAttribute('data-sf')).toBe('theme');
    expect(button().getAttribute('type')).toBe('button');
  });

  it('cycles System → Light → Dark → System, writing msb:theme, with the name saying the theme and the next one', () => {
    render(<ThemeToggle />);
    expect(button().getAttribute('aria-label')).toBe('Theme: System. Switch to Light');
    const steps: [string, string, boolean][] = [
      ['light', 'Theme: Light. Switch to Dark', false],
      ['dark', 'Theme: Dark. Switch to System', true],
      ['system', 'Theme: System. Switch to Light', false],
    ];
    for (const [stored, name, dark] of steps) {
      act(() => fireEvent.click(button()));
      expect(localStorage.getItem('msb:theme')).toBe(stored);
      expect(button().getAttribute('aria-label')).toBe(name);
      expect(button().getAttribute('title')).toBe(name.split('.')[0]);
      expect(document.documentElement.classList.contains('dark')).toBe(dark);
    }
  });

  it('starts from the stored theme once mounted', () => {
    localStorage.setItem('msb:theme', 'dark');
    render(<ThemeToggle />);
    expect(button().getAttribute('aria-label')).toBe('Theme: Dark. Switch to System');
  });

  it('renders the System state on the server whatever is stored, so hydration agrees', () => {
    localStorage.setItem('msb:theme', 'dark');
    const html = renderToStaticMarkup(<ThemeToggle />);
    expect(html).toContain('aria-label="Theme: System. Switch to Light"');
  });

  it('draws its icon in currentColor: no fixed fill or stroke, no opacity, no colour class', () => {
    for (const stored of ['light', 'dark', 'system']) {
      localStorage.setItem('msb:theme', stored);
      const { unmount } = render(<ThemeToggle />);
      const svg = button().querySelector('svg')!;
      expect(svg.getAttribute('fill')).toBe('currentColor');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      const painted = [svg, ...svg.querySelectorAll('*')].flatMap((e) => ['fill', 'stroke', 'opacity', 'class'].map((a) => e.getAttribute(a)));
      expect(painted.filter((v) => v !== null && v !== 'currentColor')).toEqual([]);
      unmount();
    }
    expect(rule('.sf-theme')).toMatch(/color:\s*var\(--sf-text-muted\)/);
    expect(rule('.sf-theme:hover')).toMatch(/color:\s*var\(--sf-text\)/);
  });
});
