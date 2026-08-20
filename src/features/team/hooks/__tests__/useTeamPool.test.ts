// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { addToastGlobal } from '@/components/Toast';

// Seam is the provider hook — see the note in useSettings.test.ts.
const { repo } = vi.hoisted(() => ({
  repo: {
    getTeamPool: vi.fn(),
    saveTeamPool: vi.fn().mockResolvedValue(undefined),
    getProjects: vi.fn().mockResolvedValue([]),
  },
}));
// ⚠️ Returned value must be REFERENTIALLY STABLE — `reload` is memoised on
// `repository`, so a fresh object per call re-fetches without bound.
vi.mock('@/components/RepositoryProvider', () => {
  const value = { repository: repo, mode: 'local' as const, isCloud: false, switchMode: vi.fn() };
  return { useRepository: () => value };
});
vi.mock('@/components/Toast', () => ({ addToastGlobal: vi.fn() }));

const DEFAULT_POOL = [
  { id: 'pm-1', name: 'Alice', role: 'Developer' },
];

function projectAssigning(poolMemberId: string) {
  return {
    id: 'p-1',
    name: 'Test',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    activeReforecastId: 'rf-1',
    reforecasts: [
      {
        id: 'rf-1',
        name: 'Baseline',
        createdAt: '2026-01-01T00:00:00Z',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        reforecastDate: '2026-01-01',
        assignments: [{ id: 'a-1', poolMemberId }],
        allocations: [],
        productivityWindows: [],
        actualCost: 0,
        baselineBudget: 0,
      },
    ],
  };
}

vi.mock('@/lib/storage/fingerprint', () => ({
  ensureOriginRef: vi.fn(),
  appendToChangeLog: vi.fn(),
}));

import { useTeamPool } from '../useTeamPool';

describe('useTeamPool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.getTeamPool).mockResolvedValue(DEFAULT_POOL);
    vi.mocked(repo.getProjects).mockResolvedValue([]);
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
    expect(() => act(() => { void result.current.flush(); })).not.toThrow();
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

  describe('archive / unarchive', () => {
    it('archivePoolMember sets archived: true on the matching member', async () => {
      const { result } = renderHook(() => useTeamPool());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.archivePoolMember('pm-1');
      });

      expect(result.current.pool[0].archived).toBe(true);
    });

    it('unarchivePoolMember strips the archived field entirely', async () => {
      vi.mocked(repo.getTeamPool).mockResolvedValue([
        { id: 'pm-1', name: 'Alice', role: 'Developer', archived: true },
      ]);
      const { result } = renderHook(() => useTeamPool());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.unarchivePoolMember('pm-1');
      });

      expect('archived' in result.current.pool[0]).toBe(false);
    });
  });

  describe('deletePoolMember', () => {
    it('returns { ok: true } for an unassigned active member', async () => {
      const { result } = renderHook(() => useTeamPool());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let deleteResult: Awaited<ReturnType<typeof result.current.deletePoolMember>> | undefined;
      await act(async () => {
        deleteResult = await result.current.deletePoolMember('pm-1');
      });

      expect(deleteResult).toEqual({ ok: true });
      expect(result.current.pool).toHaveLength(0);
    });

    it('returns { ok: true } for an unassigned archived member', async () => {
      vi.mocked(repo.getTeamPool).mockResolvedValue([
        { id: 'pm-1', name: 'Alice', role: 'Developer', archived: true },
      ]);
      const { result } = renderHook(() => useTeamPool());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let deleteResult: Awaited<ReturnType<typeof result.current.deletePoolMember>> | undefined;
      await act(async () => {
        deleteResult = await result.current.deletePoolMember('pm-1');
      });

      expect(deleteResult).toEqual({ ok: true });
    });

    it('returns { ok: false, canArchive: true } for an assigned active member', async () => {
      vi.mocked(repo.getProjects).mockResolvedValue([projectAssigning('pm-1')]);
      const { result } = renderHook(() => useTeamPool());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let deleteResult: Awaited<ReturnType<typeof result.current.deletePoolMember>> | undefined;
      await act(async () => {
        deleteResult = await result.current.deletePoolMember('pm-1');
      });

      expect(deleteResult?.ok).toBe(false);
      expect(deleteResult?.canArchive).toBe(true);
      expect(deleteResult?.reason).toContain('Archive this member instead');
      expect(result.current.pool).toHaveLength(1); // not removed
    });

    it('returns { ok: false, canArchive: false } for an assigned archived member', async () => {
      vi.mocked(repo.getTeamPool).mockResolvedValue([
        { id: 'pm-1', name: 'Alice', role: 'Developer', archived: true },
      ]);
      vi.mocked(repo.getProjects).mockResolvedValue([projectAssigning('pm-1')]);
      const { result } = renderHook(() => useTeamPool());
      await waitFor(() => expect(result.current.loading).toBe(false));

      let deleteResult: Awaited<ReturnType<typeof result.current.deletePoolMember>> | undefined;
      await act(async () => {
        deleteResult = await result.current.deletePoolMember('pm-1');
      });

      expect(deleteResult?.ok).toBe(false);
      expect(deleteResult?.canArchive).toBe(false);
    });
  });

  describe('reload error handling', () => {
    it('toasts and sets loading=false when getTeamPool rejects with network error', async () => {
      vi.mocked(repo.getTeamPool).mockRejectedValueOnce(new Error('network failure'));
      const { result } = renderHook(() => useTeamPool());
      await act(async () => {});
      expect(result.current.loading).toBe(false);
      expect(vi.mocked(addToastGlobal)).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load'),
        'error',
      );
    });

    it('does NOT toast on permission-denied (avoids double-toast with listener)', async () => {
      vi.mocked(repo.getTeamPool).mockRejectedValueOnce({ code: 'permission-denied' });
      const { result } = renderHook(() => useTeamPool());
      await act(async () => {});
      expect(result.current.loading).toBe(false);
      expect(vi.mocked(addToastGlobal)).not.toHaveBeenCalled();
    });
  });
});
