import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/lib/storage/repo', () => ({
  repo: {
    getTeamPool: vi.fn().mockResolvedValue([
      { id: 'pm-1', name: 'Alice', role: 'Developer' },
    ]),
    saveTeamPool: vi.fn().mockResolvedValue(undefined),
    getProjects: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/lib/storage/fingerprint', () => ({
  ensureOriginRef: vi.fn(),
  appendToChangeLog: vi.fn(),
}));

import { useTeamPool } from '../useTeamPool';

describe('useTeamPool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading true initially', () => {
    const { result } = renderHook(() => useTeamPool());
    expect(result.current.loading).toBe(true);
    expect(result.current.pool).toEqual([]);
  });

  it('loads pool from repo', async () => {
    const { result } = renderHook(() => useTeamPool());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pool).toEqual([
      { id: 'pm-1', name: 'Alice', role: 'Developer' },
    ]);
  });

  it('exposes a flush function', async () => {
    const { result } = renderHook(() => useTeamPool());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.flush).toBe('function');
  });

  it('flush does not throw when called with no pending save', async () => {
    const { result } = renderHook(() => useTeamPool());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(() => act(() => result.current.flush())).not.toThrow();
  });

  it('addPoolMember adds to pool state', async () => {
    const { result } = renderHook(() => useTeamPool());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.addPoolMember('Bob', 'Designer');
    });

    expect(result.current.pool).toHaveLength(2);
    expect(result.current.pool[1].name).toBe('Bob');
    expect(result.current.pool[1].role).toBe('Designer');
  });
});
