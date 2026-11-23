// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The framed 404 (FRAME26, v0.45.0). Until then Next's default `/_not-found` drew an `h1` "404" in a box as tall as the
 * window; inside the frame's `main` it had no heading row. Now: the frame's heading row "Page not found", one line, and
 * a link back to Projects. No navigation item is current on it (`AppNav.frame.test.tsx`, `/no-such-page`).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import NotFound from '../not-found';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

describe('the framed 404', () => {
  it('is a heading row "Page not found", a line, and a link back to Projects', () => {
    const { container } = render(<NotFound />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Page not found');
    expect(h1.parentElement!.getAttribute('data-sf')).toBe('headrow');
    // The heading row is a top-level element (a direct child of main once rendered in the frame).
    expect(container.firstElementChild).toBe(h1.parentElement);
    expect(screen.getByText("There's no page at this address.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Projects' }).getAttribute('href')).toBe('/');
    expect(container.querySelector('[style]')).toBeNull(); // no 100vh box
  });
});
