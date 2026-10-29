// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/Toast';
import {
  useCloudLoadNotice, isWindowClamped, describeCloudLoadNotice,
} from '../useCloudLoadNotice';
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

describe('useCloudLoadNotice (v0.44.6)', () => {
  it('knows when a window runs past the 100 years the app calculates', () => {
    expect(isWindowClamped(rf('2026-01-01', '2125-12-31'))).toBe(false); // exactly 1,200 months
    expect(isWindowClamped(rf('2026-01-01', '2126-01-31'))).toBe(true);
    expect(isWindowClamped(rf('2026-01-01', 12345 as unknown as string))).toBe(false);
    expect(isWindowClamped(undefined)).toBe(false);
  });

  it('names the project and never a value', () => {
    expect(describeCloudLoadNotice('Apollo', true, false)).toBe(
      'Some data in "Apollo" could not be read and was left out. The rest of the project loaded normally.',
    );
    expect(describeCloudLoadNotice('Apollo', false, true)).toContain('"Apollo" covers more than 100 years');
    expect(describeCloudLoadNotice('Apollo', false, false)).toBeNull();
  });

  it('tells the user once when the read path set something aside in the project they opened', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    noteCloudLoadIssue('p1', 'reforecast-not-an-object');
    const r = rf('2026-01-01', '2026-12-31');
    const { rerender } = renderHook(({ p }) => useCloudLoadNotice(p, r), {
      wrapper, initialProps: { p: project(r) },
    });
    expect(screen.getByText(/Some data in "Apollo" could not be read/)).toBeInTheDocument();
    noteCloudLoadIssue('p1', 'reforecast-not-an-object'); // a reload notes it again
    rerender({ p: { ...project(r) } });
    expect(screen.getAllByText(/Some data in "Apollo"/)).toHaveLength(1);
  });

  it('says nothing for a project with nothing set aside and a normal window', () => {
    const r = rf('2026-01-01', '2026-12-31');
    renderHook(() => useCloudLoadNotice(project(r), r), { wrapper });
    expect(screen.queryByText(/Apollo/)).not.toBeInTheDocument();
  });
});
