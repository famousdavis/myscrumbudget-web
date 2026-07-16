// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Project } from '@/types/domain';

const mocks = vi.hoisted(() => ({
  cancelByKey: vi.fn(),
  getProjects: vi.fn<[], Promise<Project[]>>().mockResolvedValue([]),
  getProject: vi.fn().mockResolvedValue(null),
  saveProject: vi.fn().mockResolvedValue(undefined),
  createProject: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn<[string], Promise<void>>().mockResolvedValue(undefined),
  exportAll: vi.fn(),
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
    getProject: mocks.getProject,
    saveProject: mocks.saveProject,
    createProject: mocks.createProject,
    deleteProject: mocks.deleteProject,
    exportAll: mocks.exportAll,
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
    mocks.getProjects.mockReset().mockResolvedValue([]);
    mocks.getProject.mockReset().mockResolvedValue(null);
    mocks.saveProject.mockReset().mockResolvedValue(undefined);
    mocks.createProject.mockReset().mockResolvedValue(undefined);
    mocks.exportAll.mockReset();
    mocks.appendToChangeLog.mockReset();
    mocks.ensureOriginRef.mockReset();
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

  describe('setProjectColor', () => {
    it('sets the color and persists', async () => {
      mocks.getProject.mockResolvedValue(makeProject('p1'));
      const { result } = renderHook(() => useProjects());
      await act(async () => {});
      await act(async () => { await result.current.setProjectColor('p1', 'teal'); });
      expect(mocks.saveProject).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'p1', color: 'teal' }),
      );
    });

    it('strips the color field when cleared (undefined)', async () => {
      mocks.getProject.mockResolvedValue({ ...makeProject('p1'), color: 'pink' });
      const { result } = renderHook(() => useProjects());
      await act(async () => {});
      await act(async () => { await result.current.setProjectColor('p1', undefined); });
      const saved = mocks.saveProject.mock.calls[mocks.saveProject.mock.calls.length - 1][0];
      expect(saved).not.toHaveProperty('color');
    });

    it('no-ops when the project does not exist', async () => {
      mocks.getProject.mockResolvedValue(null);
      const { result } = renderHook(() => useProjects());
      await act(async () => {});
      await act(async () => { await result.current.setProjectColor('missing', 'blue'); });
      expect(mocks.saveProject).not.toHaveBeenCalled();
    });
  });

  describe('archiveProject / unarchiveProject', () => {
    it('archiveProject persists archived: true, logs it, and does NOT call ensureOriginRef', async () => {
      mocks.getProject.mockResolvedValue(makeProject('p1'));
      const { result } = renderHook(() => useProjects());
      await act(async () => {});
      await act(async () => { await result.current.archiveProject('p1'); });
      expect(mocks.saveProject).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'p1', archived: true }),
      );
      expect(mocks.appendToChangeLog).toHaveBeenCalledWith(
        expect.objectContaining({ op: 'archive', entity: 'project', id: 'p1' }),
      );
      // Mutates an existing project — not new identity (same category as delete).
      expect(mocks.ensureOriginRef).not.toHaveBeenCalled();
    });

    it('unarchiveProject strips archived (not archived:false), logs it, no ensureOriginRef', async () => {
      mocks.getProject.mockResolvedValue({ ...makeProject('p1'), archived: true });
      const { result } = renderHook(() => useProjects());
      await act(async () => {});
      await act(async () => { await result.current.unarchiveProject('p1'); });
      const saved = mocks.saveProject.mock.calls[mocks.saveProject.mock.calls.length - 1][0];
      expect(saved).not.toHaveProperty('archived');
      expect(mocks.appendToChangeLog).toHaveBeenCalledWith(
        expect.objectContaining({ op: 'unarchive', entity: 'project', id: 'p1' }),
      );
      expect(mocks.ensureOriginRef).not.toHaveBeenCalled();
    });

    it('both no-op when the project does not exist', async () => {
      mocks.getProject.mockResolvedValue(null);
      const { result } = renderHook(() => useProjects());
      await act(async () => {});
      await act(async () => {
        await result.current.archiveProject('missing');
        await result.current.unarchiveProject('missing');
      });
      expect(mocks.saveProject).not.toHaveBeenCalled();
      expect(mocks.appendToChangeLog).not.toHaveBeenCalled();
    });
  });

  describe('cloneProject', () => {
    it('creates a clone with a fresh id, " - Copy (1)" name, and logs the add', async () => {
      const source = makeProject('p1'); // name "Project p1"
      mocks.getProject.mockResolvedValue(source);
      mocks.getProjects.mockResolvedValue([source]);
      const { result } = renderHook(() => useProjects());
      await act(async () => {});

      let clone: Project | null = null;
      await act(async () => { clone = await result.current.cloneProject('p1'); });

      expect(clone).not.toBeNull();
      expect(clone!.id).toBe('new-id'); // generateId is mocked
      expect(clone!.name).toBe('Project p1 - Copy (1)');
      expect(mocks.createProject).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-id', name: 'Project p1 - Copy (1)' }),
      );
      expect(mocks.ensureOriginRef).toHaveBeenCalled();
      expect(mocks.appendToChangeLog).toHaveBeenCalledWith(
        expect.objectContaining({ op: 'add', entity: 'project', id: 'new-id' }),
      );
    });

    it('returns null and does not create when the source is missing', async () => {
      mocks.getProject.mockResolvedValue(null);
      const { result } = renderHook(() => useProjects());
      await act(async () => {});
      let clone: Project | null = null;
      await act(async () => { clone = await result.current.cloneProject('missing'); });
      expect(clone).toBeNull();
      expect(mocks.createProject).not.toHaveBeenCalled();
    });
  });

  describe('exportProject', () => {
    it('returns a dataset-shaped state filtered to the one project, keeping pool/settings/tokens', async () => {
      const p1 = makeProject('p1');
      const p2 = makeProject('p2');
      mocks.exportAll.mockResolvedValue({
        version: '0.15.0',
        msbExportKind: 'dataset',
        settings: { discountRateAnnual: 0.03, laborRates: [], holidays: [], trafficLightThresholds: {} },
        teamPool: [{ id: 'pm1', name: 'Alice', role: 'Dev' }],
        projects: [p1, p2],
        _originRef: 'origin-1',
        _storageRef: 'store-1',
        _changeLog: [],
      });
      const { result } = renderHook(() => useProjects());
      await act(async () => {});

      let data: Awaited<ReturnType<typeof result.current.exportProject>> = null;
      await act(async () => { data = await result.current.exportProject('p2'); });

      expect(data).not.toBeNull();
      expect(data!.projects).toEqual([p2]);
      expect(data!.msbExportKind).toBe('dataset');
      expect(data!.teamPool).toHaveLength(1); // full pool retained
      expect(data!._originRef).toBe('origin-1'); // reconciliation tokens retained
    });

    it('returns null when the project is absent from the export', async () => {
      mocks.exportAll.mockResolvedValue({
        version: '0.15.0', msbExportKind: 'dataset',
        settings: { discountRateAnnual: 0.03, laborRates: [], holidays: [], trafficLightThresholds: {} },
        teamPool: [], projects: [makeProject('p1')],
      });
      const { result } = renderHook(() => useProjects());
      await act(async () => {});
      let data: Awaited<ReturnType<typeof result.current.exportProject>> = null;
      await act(async () => { data = await result.current.exportProject('nope'); });
      expect(data).toBeNull();
    });
  });
});
