// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * v0.44.6 — the user is told when the cloud read path set something aside in
 * the project they opened (a toast), and whenever the figures cover only part
 * of a reforecast window (a notice on the page and a marker on the card, for as
 * long as the figures are shown: MyScrumBudget shows money, so a clamp is never
 * silent).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/Toast';
import { useCloudLoadNotice, describeCloudLoadNotice } from '../useCloudLoadNotice';
import {
  ForecastWindowNotice, ForecastWindowMarker,
} from '@/features/projects/components/ForecastWindowNotice';
import { isWindowClamped } from '@/lib/utils/dates';
import { noteCloudLoadIssue, takeCloudLoadIssues } from '@/lib/storage/cloudLoadGuard';
import type { Project, Reforecast } from '@/types/domain';

function rf(startDate: string, endDate: string): Reforecast {
  return {
    id: 'rf1', name: 'B', createdAt: '', startDate, endDate, reforecastDate: '2026-01-01',
    assignments: [], allocations: [], productivityWindows: [], actualCost: 0, baselineBudget: 0,
  };
}

function project(r: Reforecast): Project {
  return { id: 'p1', name: 'Apollo', startDate: '', endDate: '', reforecasts: [r], activeReforecastId: 'rf1' };
}

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

afterEach(() => {
  takeCloudLoadIssues('p1');
  vi.restoreAllMocks();
});

describe('the clamp is never silent', () => {
  it('knows when a window runs past the 100 years the app calculates', () => {
    expect(isWindowClamped('2026-01-01', '2125-12-31')).toBe(false); // exactly 1,200 months
    expect(isWindowClamped('2026-01-01', '2126-01-31')).toBe(true);
    expect(isWindowClamped('2026-01-01', 12345)).toBe(false);
    expect(isWindowClamped(undefined, undefined)).toBe(false);
  });

  it('the project page notice appears for a clamped window and not otherwise', () => {
    const { rerender } = render(<ForecastWindowNotice reforecast={rf('2026-01-01', '275760-09-13')} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'This reforecast covers more than 100 years. The figures, charts and grid cover only its first 100 years',
    );
    rerender(<ForecastWindowNotice reforecast={rf('2026-01-01', '2125-12-31')} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('the dashboard card marker appears for a clamped window and not otherwise', () => {
    const { rerender } = render(<ForecastWindowMarker reforecast={rf('2026-01-01', '2300-01-01')} />);
    expect(screen.getByText('First 100 years only')).toBeInTheDocument();
    rerender(<ForecastWindowMarker reforecast={rf('2026-01-01', '2030-12-31')} />);
    expect(screen.queryByText('First 100 years only')).not.toBeInTheDocument();
  });
});

describe('useCloudLoadNotice', () => {
  it('names the project and never a value', () => {
    expect(describeCloudLoadNotice('Apollo')).toBe(
      'Some data in "Apollo" could not be read and was left out. The rest of the project loaded normally.',
    );
    expect(describeCloudLoadNotice('')).toContain('"this project"');
  });

  it('tells the user once when the read path set something aside in the project they opened', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    noteCloudLoadIssue('p1', 'reforecast-not-an-object');
    const r = rf('2026-01-01', '2026-12-31');
    const { rerender } = renderHook(({ p }) => useCloudLoadNotice(p), {
      wrapper, initialProps: { p: project(r) },
    });
    expect(screen.getByText(/Some data in "Apollo" could not be read/)).toBeInTheDocument();
    noteCloudLoadIssue('p1', 'reforecast-not-an-object'); // a reload notes it again
    rerender({ p: { ...project(r) } });
    expect(screen.getAllByText(/Some data in "Apollo"/)).toHaveLength(1);
  });

  it('says nothing for a project with nothing set aside', () => {
    const r = rf('2026-01-01', '2026-12-31');
    renderHook(() => useCloudLoadNotice(project(r)), { wrapper });
    expect(screen.queryByText(/Apollo/)).not.toBeInTheDocument();
  });
});
