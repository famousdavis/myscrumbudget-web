// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Settings } from '@/types/domain';
import { repo } from '@/lib/storage/repo';
import { addToastGlobal } from '@/components/Toast';

vi.mock('@/lib/storage/repo', () => ({
  repo: {
    getSettings: vi.fn().mockResolvedValue({
      discountRateAnnual: 0.08,
      laborRates: [{ role: 'Developer', hourlyRate: 100 }],
      holidays: [],
      trafficLightThresholds: { amberPercent: 5, redPercent: 10, violetPercent: 20 },
    }),
    saveSettings: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('@/components/Toast', () => ({ addToastGlobal: vi.fn() }));

import { useSettings } from '../useSettings';

const expectedSettings: Settings = {
  discountRateAnnual: 0.08,
  laborRates: [{ role: 'Developer', hourlyRate: 100 }],
  holidays: [],
  trafficLightThresholds: { amberPercent: 5, redPercent: 10, violetPercent: 20 },
};

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading true initially', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.loading).toBe(true);
    expect(result.current.settings).toBeNull();
  });

  it('loads settings from repo', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings).toEqual(expectedSettings);
  });

  it('exposes a flush function', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.flush).toBe('function');
  });

  it('flush does not throw when called with no pending save', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(() => act(() => { void result.current.flush(); })).not.toThrow();
  });

  it('updateSettings updates state and triggers debounced save', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateSettings((prev) => ({
        ...prev,
        discountRateAnnual: 0.1,
      }));
    });

    expect(result.current.settings?.discountRateAnnual).toBe(0.1);
  });

  describe('reload error handling', () => {
    it('toasts and sets loading=false when getSettings rejects with network error', async () => {
      vi.mocked(repo.getSettings).mockRejectedValueOnce(new Error('network failure'));
      const { result } = renderHook(() => useSettings());
      await act(async () => {});
      expect(result.current.loading).toBe(false);
      expect(vi.mocked(addToastGlobal)).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load'),
        'error',
      );
    });

    it('does NOT toast on permission-denied (avoids double-toast with listener)', async () => {
      vi.mocked(repo.getSettings).mockRejectedValueOnce({ code: 'permission-denied' });
      const { result } = renderHook(() => useSettings());
      await act(async () => {});
      expect(result.current.loading).toBe(false);
      expect(vi.mocked(addToastGlobal)).not.toHaveBeenCalled();
    });
  });
});
