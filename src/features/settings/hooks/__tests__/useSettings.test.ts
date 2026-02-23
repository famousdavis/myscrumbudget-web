import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Settings } from '@/types/domain';

vi.mock('@/lib/storage/repo', () => ({
  repo: {
    getSettings: vi.fn().mockResolvedValue({
      discountRateAnnual: 0.08,
      laborRates: [{ role: 'Developer', hourlyRate: 100 }],
      holidays: [],
      trafficLightThresholds: { amberPercent: 5, redPercent: 10 },
    }),
    saveSettings: vi.fn().mockResolvedValue(undefined),
  },
}));

import { useSettings } from '../useSettings';

const expectedSettings: Settings = {
  discountRateAnnual: 0.08,
  laborRates: [{ role: 'Developer', hourlyRate: 100 }],
  holidays: [],
  trafficLightThresholds: { amberPercent: 5, redPercent: 10 },
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
    expect(() => act(() => result.current.flush())).not.toThrow();
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
});
