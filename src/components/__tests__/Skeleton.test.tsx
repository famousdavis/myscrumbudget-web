// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton, SkeletonProjectCard, SkeletonProjectDetail } from '../Skeleton';

describe('Skeleton', () => {
  it('renders with default classes', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild!;
    expect(el.classList.contains('animate-pulse')).toBe(true);
    expect(el.classList.contains('rounded')).toBe(true);
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="h-8 w-32" />);
    const el = container.firstElementChild!;
    expect(el.classList.contains('h-8')).toBe(true);
    expect(el.classList.contains('w-32')).toBe(true);
  });
});

describe('SkeletonProjectCard', () => {
  it('renders without error', () => {
    const { container } = render(<SkeletonProjectCard />);
    expect(container.firstElementChild).toBeDefined();
  });

  it('has aria-hidden skeleton elements', () => {
    const { container } = render(<SkeletonProjectCard />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('SkeletonProjectDetail', () => {
  it('renders without error', () => {
    const { container } = render(<SkeletonProjectDetail />);
    expect(container.firstElementChild).toBeDefined();
  });

  it('has aria-hidden skeleton elements', () => {
    const { container } = render(<SkeletonProjectDetail />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders metric card placeholders', () => {
    const { container } = render(<SkeletonProjectDetail />);
    // Should have 5 metric card placeholders
    const cards = container.querySelectorAll('.rounded-lg.border');
    expect(cards.length).toBe(5);
  });

  // FRAME26 clean-up M3 (v0.46.0): the page's real heading row ("Project") is above the placeholder, so it draws no
  // title bar of its own, and its first block is the metric grid, with no top margin (the page's .sf-below gives 16 px).
  it('draws no title bar: its first block is the metric grid, with no margin of its own', () => {
    const { container } = render(<SkeletonProjectDetail />);
    const first = container.firstElementChild!.firstElementChild!;
    expect(first.classList.contains('grid')).toBe(true);
    expect(Array.from(first.classList).some((c) => /^mt-/.test(c))).toBe(false);
    expect(container.querySelector('.h-8')).toBeNull();
  });
});
