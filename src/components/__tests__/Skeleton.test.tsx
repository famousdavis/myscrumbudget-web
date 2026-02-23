import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
