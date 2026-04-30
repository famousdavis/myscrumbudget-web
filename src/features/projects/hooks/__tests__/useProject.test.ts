// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProject } from '../useProject';
import { repo } from '@/lib/storage/repo';
import { cloudSyncBus } from '@/lib/firebase/cloudSyncBus';
import type { Project } from '@/types/domain';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p-undo',
    name: 'Test',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    reforecasts: [
      {
        id: 'rf-1',
        name: 'Baseline',
        createdAt: '2025-01-01T00:00:00Z',
        startDate: '2025-01',
        reforecastDate: '2025-01-01',
        assignments: [],
        allocations: [],
        productivityWindows: [],
        actualCost: 0,
        baselineBudget: 100000,
      },
    ],
    activeReforecastId: 'rf-1',
    ...overrides,
  };
}

async function loadHook() {
  const hook = renderHook(() => useProject('p-undo'));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('useProject — undo/redo', () => {
  beforeEach(async () => {
    await repo.clear();
    await repo.saveProject(makeProject());
  });

  afterEach(async () => {
    await repo.clear();
  });

  it('loads the project and starts with empty stacks', async () => {
    const { result } = await loadHook();
    expect(result.current.project?.name).toBe('Test');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('updateProject pushes the pre-update snapshot and clears redo', async () => {
    const { result } = await loadHook();

    act(() => {
      result.current.updateProject((prev) => ({ ...prev, name: 'Renamed' }));
    });

    expect(result.current.project?.name).toBe('Renamed');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo restores the prior project and moves it to redo stack', async () => {
    const { result } = await loadHook();

    act(() => {
      result.current.updateProject((prev) => ({ ...prev, name: 'Renamed' }));
    });
    act(() => {
      result.current.undo();
    });

    expect(result.current.project?.name).toBe('Test');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redo restores the post-mutation project', async () => {
    const { result } = await loadHook();

    act(() => {
      result.current.updateProject((prev) => ({ ...prev, name: 'Renamed' }));
    });
    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.redo();
    });

    expect(result.current.project?.name).toBe('Renamed');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('new mutation after undo clears the redo stack', async () => {
    const { result } = await loadHook();

    act(() => {
      result.current.updateProject((prev) => ({ ...prev, name: 'A' }));
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.updateProject((prev) => ({ ...prev, name: 'B' }));
    });

    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.project?.name).toBe('B');
  });

  it('undo with empty stack is a no-op', async () => {
    const { result } = await loadHook();
    act(() => {
      result.current.undo();
    });
    expect(result.current.project?.name).toBe('Test');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('redo with empty stack is a no-op', async () => {
    const { result } = await loadHook();
    act(() => {
      result.current.redo();
    });
    expect(result.current.project?.name).toBe('Test');
    expect(result.current.canRedo).toBe(false);
  });

  it('beginUndoGroup pushes one snapshot; subsequent updates do not', async () => {
    const { result } = await loadHook();

    act(() => {
      result.current.beginUndoGroup();
    });
    act(() => {
      result.current.updateProject((prev) => ({ ...prev, name: 'A' }));
    });
    act(() => {
      result.current.updateProject((prev) => ({ ...prev, name: 'B' }));
    });
    act(() => {
      result.current.updateProject((prev) => ({ ...prev, name: 'C' }));
    });
    act(() => {
      result.current.endUndoGroup();
    });

    // One undo restores all the way back to "Test" — the entire group is one entry.
    expect(result.current.project?.name).toBe('C');
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });
    expect(result.current.project?.name).toBe('Test');
    expect(result.current.canUndo).toBe(false);
  });

  it('beginUndoGroup is idempotent within a session', async () => {
    const { result } = await loadHook();

    act(() => {
      result.current.beginUndoGroup();
    });
    act(() => {
      result.current.beginUndoGroup(); // second call should be a no-op
    });
    act(() => {
      result.current.updateProject((prev) => ({ ...prev, name: 'X' }));
    });
    act(() => {
      result.current.endUndoGroup();
    });

    // Stack should still have only one entry.
    act(() => {
      result.current.undo();
    });
    expect(result.current.project?.name).toBe('Test');
    expect(result.current.canUndo).toBe(false);
  });

  it('undo mid-group clears the flag so subsequent updates push fresh snapshots', async () => {
    // This is the corrected behavior from Risk #3 of the plan.
    const { result } = await loadHook();

    act(() => {
      result.current.beginUndoGroup();
    });
    act(() => {
      result.current.updateProject((prev) => ({ ...prev, name: 'mid-edit' }));
    });

    // Mid-edit Ctrl+Z while group is still active.
    act(() => {
      result.current.undo();
    });
    expect(result.current.project?.name).toBe('Test');

    // The flag should now be cleared. The next updateProject must push a snapshot
    // (otherwise continued typing would be unrecoverable).
    act(() => {
      result.current.updateProject((prev) => ({ ...prev, name: 'continued' }));
    });
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });
    expect(result.current.project?.name).toBe('Test');
  });

  it('stack length never exceeds UNDO_STACK_LIMIT (50)', async () => {
    const { result } = await loadHook();

    // Push 60 mutations.
    for (let i = 0; i < 60; i++) {
      act(() => {
        result.current.updateProject((prev) => ({ ...prev, name: `v${i}` }));
      });
    }

    // Drain via undo. Should be able to undo exactly 50 times before hitting the floor.
    for (let i = 0; i < 50; i++) {
      act(() => {
        result.current.undo();
      });
    }

    expect(result.current.canUndo).toBe(false);
    // The oldest 10 snapshots were dropped — we don't get back to 'Test'.
    // We get back to the state captured 50 steps ago, which is the project AFTER 'v9' was applied
    // (because the snapshot pushed when 'v10' was the new value held the 'v9' state).
    expect(result.current.project?.name).toBe('v9');
  });

  it('undo synchronously persists the snapshot via flush()', async () => {
    const { result } = await loadHook();
    const saveSpy = vi.spyOn(repo, 'saveProject');

    act(() => {
      result.current.updateProject((prev) => ({ ...prev, name: 'changed' }));
    });

    saveSpy.mockClear();

    act(() => {
      result.current.undo();
    });

    // undo() calls persistProject + flush() — flush writes synchronously
    // to repo before returning.
    expect(saveSpy).toHaveBeenCalled();
    const lastCallArg = saveSpy.mock.calls[saveSpy.mock.calls.length - 1][0];
    expect(lastCallArg.name).toBe('Test');

    saveSpy.mockRestore();
  });

  it('cloudSyncBus reload does NOT push to undo stack', async () => {
    const { result } = await loadHook();

    // Externally update the underlying repo (simulates another browser).
    await repo.saveProject(makeProject({ name: 'Externally Changed' }));

    act(() => {
      cloudSyncBus.emit('projects');
    });

    await waitFor(() => {
      expect(result.current.project?.name).toBe('Externally Changed');
    });

    // The reload bypasses updateProject, so no undo entry should exist.
    expect(result.current.canUndo).toBe(false);
  });
});
