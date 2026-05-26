// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Project } from '@/types/domain';

const mocks = vi.hoisted(() => ({
  cancelByKey: vi.fn(),
  getProjects: vi.fn<[], Promise<Project[]>>().mockResolvedValue([]),
  deleteProject: vi.fn<[string], Promise<void>>().mockResolvedValue(undefined),
  appendToChangeLog: vi.fn(),
  ensureOriginRef: vi.fn(),
  addToastGlobal: vi.fn(),
}));

vi.mock('@/lib/storage/pendingSaveRegistry', () => ({
  cancelByKey: mocks.cancelByKey,
  register: vi.fn(() => () => {}),
}));
vi.mock('@/lib/storage/repo', () => ({
  repo: {
    getProjects: mocks.getProjects,
    deleteProject: mocks.deleteProject,
    createProject: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('@/lib/storage/fingerprint', () => ({
  appendToChangeLog: mocks.appendToChangeLog,
  ensureOriginRef: mocks.ensureOriginRef,
}));
vi.mock('@/lib/firebase/cloudSyncBus', () => ({
  cloudSyncBus: { subscribe: vi.fn(() => () => {}), emit: vi.fn() },
}));
vi.mock('@/lib/utils/reforecast', () => ({
  createBaselineReforecast: vi.fn(() => ({
    id: 'rf-0', name: 'Baseline', createdAt: '', startDate: '',
    endDate: '', reforecastDate: '', allocations: [], assignments: [],
    productivityWindows: [], actualCost: 0, baselineBudget: 0,
  })),
}));
vi.mock('@/lib/utils/id', () => ({ generateId: vi.fn(() => 'new-id') }));
vi.mock('@/components/Toast', () => ({ addToastGlobal: mocks.addToastGlobal }));

import { useProjects } from '../useProjects';

const makeProject = (id: string): Project => ({
  id, name: `Project ${id}`, startDate: '2026-01-01', endDate: '2026-12-31',
  reforecasts: [], activeReforecastId: null,
});

describe('useProjects', () => {
  beforeEach(() => {
    mocks.cancelByKey.mockReset();
    mocks.deleteProject.mockReset().mockResolvedValue(undefined);
    mocks.getProjects.mockResolvedValue([]);
    mocks.addToastGlobal.mockReset();
  });

  describe('deleteProject', () => {
    it('calls cancelByKey(id) BEFORE repo.deleteProject(id)', async () => {
      const order: string[] = [];
      mocks.cancelByKey.mockImplementation(() => { order.push('cancelByKey'); });
      mocks.deleteProject.mockImplementation(async () => { order.push('deleteProject'); });
      const { result } = renderHook(() => useProjects());
      await act(async () => { await result.current.deleteProject('proj-123'); });
      expect(order.indexOf('cancelByKey')).toBeLessThan(order.indexOf('deleteProject'));
      expect(mocks.cancelByKey).toHaveBeenCalledWith('proj-123');
    });
  });

  describe('reload error handling', () => {
    it('sets projects to [] on permission-denied and does NOT toast', async () => {
      // Pre-load a project so the assertion is non-trivial (drops from 1 to 0)
      mocks.getProjects.mockResolvedValueOnce([makeProject('p1')]);
      const { result } = renderHook(() => useProjects());
      await act(async () => {});
      expect(result.current.projects).toHaveLength(1);

      mocks.getProjects.mockRejectedValueOnce({ code: 'permission-denied' });
      mocks.deleteProject.mockResolvedValueOnce(undefined);
      await act(async () => { await result.current.deleteProject('p1'); });

      expect(result.current.projects).toEqual([]);
      expect(mocks.addToastGlobal).not.toHaveBeenCalled();
    });

    it('toasts on network error and does NOT clear projects', async () => {
      mocks.getProjects.mockResolvedValueOnce([makeProject('p1')]);
      const { result } = renderHook(() => useProjects());
      await act(async () => {});
      expect(result.current.projects).toHaveLength(1);

      mocks.getProjects.mockRejectedValueOnce(new Error('Network unavailable'));
      mocks.deleteProject.mockResolvedValueOnce(undefined);
      await act(async () => { await result.current.deleteProject('p1'); });

      expect(mocks.addToastGlobal).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load'),
        'error',
      );
      // Projects must NOT be cleared on generic network errors
      expect(result.current.projects).toHaveLength(1);
    });
  });
});
