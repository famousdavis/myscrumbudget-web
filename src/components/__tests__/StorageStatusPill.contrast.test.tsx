// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The storage chip's colours (FRAME26 stage 0, MSB-2 and MSB-6), measured in
 * Chrome on the page ground (#ffffff light, #0a0a0a dark):
 * - "Local only" was `text-gray-400`, 2.60 : 1 on white. Now
 *   `text-gray-500 dark:text-gray-400`: 4.84 light, 7.61 dark.
 * - "Sign in" was a fixed #0070f3, 4.35 : 1 on the dark ground. Now
 *   `dark:text-[#51a2ff]`, 7.51; light stays #0070f3 (4.55).
 * - The lock stroke was a fixed #9CA3AF, 2.54 : 1 on white. In the
 *   signed-in-local chip it is the only sign of the storage mode, so it needs
 *   3 : 1 (WCAG 1.4.11). It now draws in currentColor from the muted classes.
 *
 * jsdom applies no CSS, so classes are pinned, compared as WHOLE tokens.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

let mockUser: { displayName: string; email: string } | null = null;
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ user: mockUser }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

import { StorageStatusPill } from '../StorageStatusPill';

const tokens = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

function lockOf(button: HTMLElement) {
  const svg = button.querySelector('svg');
  if (!svg) throw new Error('no lock icon rendered');
  return svg;
}

describe('StorageStatusPill colours', () => {
  beforeEach(() => {
    mockUser = null;
    localStorage.clear();
  });

  it('"Local only" is gray-500 in light and gray-400 in dark, never a bare gray-400', () => {
    render(<StorageStatusPill onOpen={() => {}} />);
    const t = tokens(screen.getByText('Local only'));
    expect(t).toContain('text-gray-500');
    expect(t).toContain('dark:text-gray-400');
    expect(t, 'a bare text-gray-400 is 2.60 : 1 on white').not.toContain('text-gray-400');
  });

  it('"Sign in" keeps #0070f3 in light and takes #51a2ff in dark, with no inline colour', () => {
    render(<StorageStatusPill onOpen={() => {}} />);
    const el = screen.getByText('Sign in');
    const t = tokens(el);
    expect(t).toContain('text-[#0070f3]');
    expect(t, '#0070f3 is 4.35 : 1 on the dark ground').toContain('dark:text-[#51a2ff]');
    expect(el.style.color, 'an inline colour would override the dark class').toBe('');
  });

  it('the signed-out lock draws in currentColor from the muted classes', () => {
    render(<StorageStatusPill onOpen={() => {}} />);
    const svg = lockOf(screen.getByRole('button', { name: 'Open cloud storage settings' }));
    expect(tokens(svg)).toEqual(expect.arrayContaining(['text-gray-500', 'dark:text-gray-400']));
    for (const shape of svg.querySelectorAll('rect, path')) {
      expect(shape.getAttribute('stroke'), '#9CA3AF is 2.54 : 1 on white').toBe('currentColor');
    }
  });

  it('the signed-in-local lock, the only sign of the mode there, does too', () => {
    mockUser = { displayName: 'Ada Lovelace', email: 'ada@example.com' };
    render(<StorageStatusPill onOpen={() => {}} />);
    const button = screen.getByRole('button', { name: /in local mode/ });
    const svg = lockOf(button);
    expect(tokens(svg)).toEqual(expect.arrayContaining(['text-gray-500', 'dark:text-gray-400']));
    for (const shape of svg.querySelectorAll('rect, path')) {
      expect(shape.getAttribute('stroke')).toBe('currentColor');
    }
  });
});
