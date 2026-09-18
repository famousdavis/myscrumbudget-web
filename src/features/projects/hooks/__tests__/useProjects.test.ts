// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Project } from '@/types/domain';

const mocks = vi.hoisted(() => ({
  cancelByKey: vi.fn(),
  getProjects: vi.fn<() => Promise<Project[]>>().mockResolvedValue([]),
  getProject: vi.fn().mockResolvedValue(null),
  saveProject: vi.fn().mockResolvedValue(undefined),
  createProject: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  exportAll: vi.fn(),
  // v0.42.0 — the two preference methods. ⚠️ This mock repository is UNTYPED, so
  // a method the hook calls and the mock lacks is NOT a compile error: it is a
  // runtime TypeError inside the hook's own try/catch, surfacing as a toast and
  // an assertion failure three lines from the cause. Declaring them here is what
  // keeps that failure legible (measured at v0.42.0 pre-flight: adding a
  // Repository method costs 2 tsc errors and ZERO in test files).
  writeProjectPrefs: vi.fn().mockResolvedValue(undefined),
  ensureProjectPrefsSeeded: vi.fn().mockResolvedValue(undefined),
  appendToChangeLog: vi.fn(),
  ensureOriginRef: vi.fn(),
  addToastGlobal: vi.fn(),
  /** Every cloudSyncBus handler the hook registers, so a test can fire one. */
  busHandlers: [] as ((event: string) => void)[],
}));

vi.mock('@/lib/storage/pendingSaveRegistry', () => ({
  cancelByKey: mocks.cancelByKey,
  register: vi.fn(() => () => {}),
}));
// ⚠️ The returned value must be REFERENTIALLY STABLE across renders. `reload`
// is memoised on `repository`, and the mount effect is memoised on `reload`, so
// a fresh object per call produces an unbounded re-fetch loop rather than a
// clean failure. Discovered here; pinned as a property of the real provider by
// the identity-stability test in RepositoryProvider.test.tsx.
const repositoryContext = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/components/RepositoryProvider', () => {
  repositoryContext.value = {
    repository: {
      getProjects: mocks.getProjects,
      getProject: mocks.getProject,
      saveProject: mocks.saveProject,
      createProject: mocks.createProject,
      deleteProject: mocks.deleteProject,
      exportAll: mocks.exportAll,
      writeProjectPrefs: mocks.writeProjectPrefs,
      ensureProjectPrefsSeeded: mocks.ensureProjectPrefsSeeded,
    },
    mode: 'local' as const,
    // ⚠️ MUTATED PER TEST by the cloud cases below (the seed trigger is gated on
    // it), and reset in beforeEach. The object itself must stay the SAME
    // reference — see the stability note above.
    isCloud: false,
    switchMode: vi.fn(),
  };
  return { useRepository: () => repositoryContext.value };
});
vi.mock('@/lib/storage/fingerprint', () => ({
  appendToChangeLog: mocks.appendToChangeLog,
  ensureOriginRef: mocks.ensureOriginRef,
}));
vi.mock('@/lib/firebase/cloudSyncBus', () => ({
  cloudSyncBus: {
    // Captures the handler so a test can fire a real bus event (v0.42.0).
    subscribe: vi.fn((handler: (event: string) => void) => {
      mocks.busHandlers.push(handler);
      return () => {
        const i = mocks.busHandlers.indexOf(handler);
        if (i >= 0) mocks.busHandlers.splice(i, 1);
      };
    }),
    emit: vi.fn(),
  },
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
    mocks.writeProjectPrefs.mockReset().mockResolvedValue(undefined);
    mocks.ensureProjectPrefsSeeded.mockReset().mockResolvedValue(undefined);
    mocks.appendToChangeLog.mockReset();
    mocks.ensureOriginRef.mockReset();
    mocks.addToastGlobal.mockReset();
    mocks.busHandlers.length = 0;
    (repositoryContext.value as { isCloud: boolean }).isCloud = false;
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
    // ⚠️ REWRITTEN AT v0.42.0. These asserted `getProject` then `saveProject`
    // with a whole project object — the route that wrote one member's colour
    // into a document every member reads. The hook now sends a PATCH and reads
    // nothing first: there is no whole-object write left to clobber a concurrent
    // edit, which was the only reason for the pre-read.
    it('sends a colour patch — no read, no project write', async () => {
      const { result } = renderHook(() => useProjects());
      await act(async () => {});

      await act(async () => { await result.current.setProjectColor('p1', 'teal'); });

      expect(mocks.writeProjectPrefs).toHaveBeenCalledWith([{ id: 'p1', color: 'teal' }]);
      expect(mocks.saveProject, 'the shared document is not touched').not.toHaveBeenCalled();
      expect(mocks.getProject, 'and nothing is read first').not.toHaveBeenCalled();
    });

    it('clears with null — the patch says "remove", not "set to nothing"', async () => {
      const { result } = renderHook(() => useProjects());
      await act(async () => {});

      await act(async () => { await result.current.setProjectColor('p1', undefined); });

      expect(mocks.writeProjectPrefs).toHaveBeenCalledWith([{ id: 'p1', color: null }]);
    });

    it('reports a rejected write and does not reload', async () => {
      // ⚠️ REPLACES "no-ops when the project does not exist", which could no
      // longer fail: it asserted `saveProject` was not called, and the hook does
      // not call `saveProject` at all now. The "project is gone" case moved to
      // the repository (localStorage.test.ts [Q2]); what belongs here is that a
      // failed write is reported rather than swallowed.
      mocks.writeProjectPrefs.mockRejectedValueOnce({ code: 'permission-denied' });
      const { result } = renderHook(() => useProjects());
      await act(async () => {});
      mocks.getProjects.mockClear();

      await act(async () => { await result.current.setProjectColor('p1', 'blue'); });

      expect(mocks.addToastGlobal).toHaveBeenCalled();
      expect(mocks.getProjects, 'a failed write does not reload').not.toHaveBeenCalled();
    });
  });

  describe('archiveProject / unarchiveProject', () => {
    // ⚠️ REWRITTEN AT v0.42.0, and this pair is the defect in miniature:
    // archiving used to write `archived: true` to the shared document, which hid
    // the project from EVERY member's dashboard — the owner's included.
    it('archive sends archived: true, logs it, and does NOT call ensureOriginRef', async () => {
      const { result } = renderHook(() => useProjects());
      await act(async () => {});

      await act(async () => { await result.current.archiveProject('p1'); });

      expect(mocks.writeProjectPrefs).toHaveBeenCalledWith([{ id: 'p1', archived: true }]);
      expect(mocks.saveProject, 'nobody else\u2019s dashboard changes').not.toHaveBeenCalled();
      expect(mocks.appendToChangeLog).toHaveBeenCalledWith(
        expect.objectContaining({ op: 'archive', entity: 'project', id: 'p1' }),
      );
      expect(mocks.ensureOriginRef).not.toHaveBeenCalled();
    });

    it('unarchive sends archived: null — cleared, never false', async () => {
      const { result } = renderHook(() => useProjects());
      await act(async () => {});

      await act(async () => { await result.current.unarchiveProject('p1'); });

      expect(mocks.writeProjectPrefs).toHaveBeenCalledWith([{ id: 'p1', archived: null }]);
      expect(mocks.appendToChangeLog).toHaveBeenCalledWith(
        expect.objectContaining({ op: 'unarchive', entity: 'project', id: 'p1' }),
      );
      expect(mocks.ensureOriginRef).not.toHaveBeenCalled();
    });

    it('a rejected archive is reported and not logged as done', async () => {
      // The other half of the old "both no-op when the project does not exist":
      // the hook no longer knows whether a project exists, so what it still owes
      // the user is an honest report when the write fails.
      mocks.writeProjectPrefs.mockRejectedValueOnce({ code: 'permission-denied' });
      const { result } = renderHook(() => useProjects());
      await act(async () => {});

      await act(async () => { await result.current.archiveProject('p1'); });

      expect(mocks.addToastGlobal).toHaveBeenCalled();
      expect(mocks.appendToChangeLog, 'nothing happened, so nothing is logged').not.toHaveBeenCalled();
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

  /**
   * v0.41.0 — a rejected WRITE names permission; a rejected READ does not.
   *
   * ⚠️ THE ASYMMETRY IS THE SUBJECT, so the three rows belong together: any one
   * of them alone reads as an arbitrary choice of wording. Its reason is at
   * `describeWriteError` — a failed read evicts data and is recoverable by
   * reloading, a failed save loses the edit the user just made.
   */
  describe('permission-denied wording (v0.41.0)', () => {
    const PERMISSION_COPY =
      'You do not have permission to make this change. ' +
      'If this is a shared project, ask its owner for edit access.';

    it('[C1] a rejected WRITE names permission, not the connection', async () => {
      // ⚠️ THE LIVE INSTANCE, not a hypothetical. The MSB delete rule is
      // `resource.data.members[request.auth.uid] == 'owner'`, so an EDITOR
      // pressing Delete gets exactly this rejection today and was told to check
      // their connection — the one diagnosis that is definitely wrong when a
      // security rule refused the write.
      mocks.getProjects.mockResolvedValue([makeProject('p1')]);
      const { result } = renderHook(() => useProjects());
      await act(async () => {});
      mocks.addToastGlobal.mockClear();

      mocks.deleteProject.mockRejectedValueOnce({ code: 'permission-denied' });
      await act(async () => { await result.current.deleteProject('p1'); });

      // EXACT string: `describeStorageError`'s verbatim fallback is the wrong
      // build, and it also contains the word "project", so a loose match on that
      // would pass against it.
      expect(mocks.addToastGlobal).toHaveBeenCalledWith(PERMISSION_COPY, 'error');
    });

    it('[C2] a rejected READ at a non-I2 site keeps its copy BYTE-IDENTICAL', async () => {
      // ⚠️ `exportProject` is a READ that toasts, and it is deliberately still on
      // `describeStorageError`. The wrong build is option C — branching inside
      // the shared helper — which would reword this site too. The exact original
      // sentence is the assertion; anything else means the helper was widened.
      mocks.getProjects.mockResolvedValue([]);
      const { result } = renderHook(() => useProjects());
      await act(async () => {});
      mocks.addToastGlobal.mockClear();

      mocks.exportAll.mockRejectedValueOnce({ code: 'permission-denied' });
      await act(async () => {
        await expect(result.current.exportProject('p1')).rejects.toBeTruthy();
      });

      expect(mocks.addToastGlobal).toHaveBeenCalledWith(
        'Failed to export project. Please check your connection.',
        'error',
      );
    });

    it('[C3] I2’s silence on a permission-denied LOAD is intact — no toast at all', async () => {
      // ⚠️ v0.31.0 (I2) decided this deliberately. The guard branches on the
      // error code and returns BEFORE any describe* helper, so the write-path
      // change cannot reach it — but "cannot reach it" is a claim about code
      // until something asserts the silence.
      mocks.getProjects.mockRejectedValueOnce({ code: 'permission-denied' });
      const { result } = renderHook(() => useProjects());
      await act(async () => {});

      expect(result.current.projects, 'evicted').toEqual([]);
      expect(mocks.addToastGlobal, 'and silent').not.toHaveBeenCalled();
    });
  });

  describe('per-user preferences (v0.42.0)', () => {
    it('[S1] a settings bus event reloads the list', async () => {
      // ⚠️ THE PREFERENCES LIVE IN THE SETTINGS DOCUMENT NOW, so a colour changed
      // in another tab or on another device produces a 'settings' event and
      // nothing else. Without this subscription the dashboard would show the old
      // colours until someone reloaded the page by hand.
      const { result } = renderHook(() => useProjects());
      await act(async () => {});
      expect(result.current.loading).toBe(false);
      mocks.getProjects.mockClear();

      await act(async () => { mocks.busHandlers.forEach((handler) => handler('settings')); });

      expect(mocks.getProjects, 'a settings change re-reads the projects').toHaveBeenCalledTimes(1);
    });

    it('[S2] in cloud mode the seed runs ONCE, after a successful load', async () => {
      (repositoryContext.value as { isCloud: boolean }).isCloud = true;
      const { result } = renderHook(() => useProjects());
      await act(async () => {});

      expect(mocks.ensureProjectPrefsSeeded).toHaveBeenCalledTimes(1);

      // A later reload — a bus event, a mutation, anything — must not re-seed.
      await act(async () => { mocks.busHandlers.forEach((handler) => handler('projects')); });
      await act(async () => { await result.current.deleteProject('p1'); });

      expect(mocks.ensureProjectPrefsSeeded,
        'idempotent in the repository, but not even asked again here').toHaveBeenCalledTimes(1);
    });

    it('[S3] in local mode the seed is never attempted', async () => {
      // Gated on `isCloud` from the provider, never on the stored mode: the mode
      // key can say "cloud" while nobody is signed in, and the provider then
      // hands out the LOCAL repository.
      renderHook(() => useProjects());
      await act(async () => {});

      expect(mocks.ensureProjectPrefsSeeded).not.toHaveBeenCalled();
    });

    it('[S4] a failed seed is logged with its code only, never toasted', async () => {
      // ⚠️ A FAILED SEED IS NOT A FAILED ACTION: the reader keeps seeing the
      // documents' values, which is what they saw yesterday, and the next load
      // tries again. A toast would report a background step the user did not ask
      // for. The code only — never the payload (v0.28.2 log hygiene).
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mocks.ensureProjectPrefsSeeded.mockRejectedValueOnce({ code: 'unavailable', message: 'secret-detail' });
      (repositoryContext.value as { isCloud: boolean }).isCloud = true;

      renderHook(() => useProjects());
      await act(async () => {});

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('seed failed'), 'unavailable');
      expect(mocks.addToastGlobal, 'the user is not told about a background step').not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('[S5] a clone carries the CLONER\u2019s colour onto the new id', async () => {
      // `createProject` no longer writes a colour, so without this the clone of a
      // coloured project would come out untinted for the person who cloned it.
      const source = { ...makeProject('p1'), color: 'teal' as const };
      mocks.getProject.mockResolvedValue(source);
      mocks.getProjects.mockResolvedValue([source]);
      const { result } = renderHook(() => useProjects());
      await act(async () => {});

      await act(async () => { await result.current.cloneProject('p1'); });

      expect(mocks.writeProjectPrefs).toHaveBeenCalledWith([{ id: 'new-id', color: 'teal' }]);
      expect(mocks.writeProjectPrefs.mock.calls[0][0][0]).not.toHaveProperty('archived');
    });
  });
});
