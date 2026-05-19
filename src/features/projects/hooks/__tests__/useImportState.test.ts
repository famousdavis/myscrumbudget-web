// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { useImportState } from '../useImportState';
import { repo, switchRepoImpl } from '@/lib/storage/repo';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import { getStorageMode } from '@/lib/storage/storageMode';
import type { AppState, Project } from '@/types/domain';

// Mock applyImportMerge so we can isolate the hook from the apply logic.
vi.mock('@/lib/utils/importUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/importUtils')>();
  return {
    ...actual,
    applyImportMerge: vi.fn(),
  };
});

import { applyImportMerge } from '@/lib/utils/importUtils';

const mockedApply = vi.mocked(applyImportMerge);

function makeFile(content: string, name = 'export.json', size?: number): File {
  const file = new File([content], name, { type: 'application/json' });
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size });
  }
  return file;
}

function makeChangeEvent(file: File | null): React.ChangeEvent<HTMLInputElement> {
  const value = '';
  const input = document.createElement('input');
  input.type = 'file';
  return {
    target: { files: file ? [file] : null, value } as unknown as HTMLInputElement,
    currentTarget: input,
  } as unknown as React.ChangeEvent<HTMLInputElement>;
}

function validAppStateJson(overrides: Partial<AppState> = {}): string {
  const base: AppState = {
    version: '0.30.0',
    msbExportKind: 'dataset',
    settings: {
      discountRateAnnual: 0.05,
      laborRates: [{ role: 'Dev', hourlyRate: 100 }],
      holidays: [],
      trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
    },
    teamPool: [],
    projects: [],
    ...overrides,
  };
  return JSON.stringify(base);
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Demo',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    activeReforecastId: 'rf1',
    reforecasts: [
      {
        id: 'rf1',
        name: 'Baseline',
        createdAt: '2026-01-01T00:00:00.000Z',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        reforecastDate: '2026-01-01',
        allocations: [],
        assignments: [],
        productivityWindows: [],
        actualCost: 0,
        baselineBudget: 100000,
      },
    ],
    ...overrides,
  };
}

function setupHook() {
  return renderHook(() => {
    const ref = useRef<HTMLInputElement>(null);
    const state = useImportState(ref);
    return { ref, ...state };
  });
}

describe('useImportState', () => {
  beforeEach(async () => {
    localStorage.clear();
    switchRepoImpl(createLocalStorageRepository());
    mockedApply.mockReset();
    mockedApply.mockResolvedValue({
      addedCount: 0,
      replacedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errorMessages: [],
    });
  });

  it('idle → preview on valid file (local mode)', async () => {
    const { result } = setupHook();
    const file = makeFile(validAppStateJson({ projects: [makeProject()] }));

    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(file));
    });

    expect(result.current.phase.phase).toBe('preview');
    expect(result.current.fileError).toBeNull();
  });

  it('idle → fileError on oversized file', async () => {
    const { result } = setupHook();
    const huge = makeFile('{}', 'big.json', 11 * 1024 * 1024);

    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(huge));
    });

    expect(result.current.phase.phase).toBe('idle');
    expect(result.current.fileError).toMatch(/too large/i);
  });

  it('idle → fileError on invalid JSON', async () => {
    const { result } = setupHook();
    const bad = makeFile('not-json{{');

    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(bad));
    });

    expect(result.current.fileError).toMatch(/invalid json/i);
  });

  it('idle → fileError on unknown msbExportKind', async () => {
    const { result } = setupHook();
    const wrong = makeFile(
      JSON.stringify({
        version: '0.30.0',
        msbExportKind: 'single-project',
        settings: {}, projects: [],
      }),
    );

    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(wrong));
    });

    expect(result.current.fileError).toMatch(/Unrecognized export format/);
  });

  it('idle → fileError on validateAppState failure', async () => {
    const { result } = setupHook();
    // Missing required settings fields
    const bad = makeFile(
      JSON.stringify({
        version: '0.30.0',
        settings: { foo: 'bar' },
        projects: [],
      }),
    );

    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(bad));
    });

    expect(result.current.fileError).toMatch(/Invalid data structure/);
  });

  it('preview → applying → banner on successful apply', async () => {
    mockedApply.mockResolvedValueOnce({
      addedCount: 1, replacedCount: 0, skippedCount: 0,
      errorCount: 0, errorMessages: [],
    });

    const { result } = setupHook();
    const file = makeFile(validAppStateJson({ projects: [makeProject()] }));
    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(file));
    });
    expect(result.current.phase.phase).toBe('preview');

    await act(async () => {
      await result.current.runApply();
    });

    expect(result.current.phase.phase).toBe('banner');
    if (result.current.phase.phase === 'banner') {
      expect(result.current.phase.result.addedCount).toBe(1);
    }
  });

  it('preview → applying → banner for all-skip result (pitfall #71)', async () => {
    mockedApply.mockResolvedValueOnce({
      addedCount: 0, replacedCount: 0, skippedCount: 1,
      errorCount: 0, errorMessages: [],
    });

    const { result } = setupHook();
    const file = makeFile(validAppStateJson({ projects: [makeProject()] }));
    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(file));
    });
    await act(async () => {
      await result.current.runApply();
    });

    expect(result.current.phase.phase).toBe('banner');
  });

  it('preview → idle on cancelImport', async () => {
    const { result } = setupHook();
    const file = makeFile(validAppStateJson({ projects: [makeProject()] }));
    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(file));
    });
    expect(result.current.phase.phase).toBe('preview');

    act(() => {
      result.current.cancelImport();
    });

    expect(result.current.phase.phase).toBe('idle');
  });

  it('applying phase: cancelImport is a no-op', async () => {
    // Keep apply pending so we can observe the applying phase.
    let resolveApply!: (v: { addedCount: number; replacedCount: number; skippedCount: number; errorCount: number; errorMessages: string[] }) => void;
    mockedApply.mockImplementationOnce(
      () => new Promise((res) => { resolveApply = res; }),
    );

    const { result } = setupHook();
    const file = makeFile(validAppStateJson({ projects: [makeProject()] }));
    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(file));
    });

    // Fire and DO NOT await — leaves us in applying.
    act(() => {
      void result.current.runApply();
    });

    await waitFor(() => expect(result.current.phase.phase).toBe('applying'));

    act(() => {
      result.current.cancelImport();
    });
    expect(result.current.phase.phase).toBe('applying'); // unchanged

    // Now resolve so the act() doesn't leak
    await act(async () => {
      resolveApply({
        addedCount: 0, replacedCount: 0, skippedCount: 0,
        errorCount: 0, errorMessages: [],
      });
    });
  });

  it('applying guard: second concurrent runApply call is a no-op', async () => {
    let resolveApply!: (v: { addedCount: number; replacedCount: number; skippedCount: number; errorCount: number; errorMessages: string[] }) => void;
    mockedApply.mockImplementationOnce(
      () => new Promise((res) => { resolveApply = res; }),
    );

    const { result } = setupHook();
    const file = makeFile(validAppStateJson({ projects: [makeProject()] }));
    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(file));
    });

    act(() => {
      void result.current.runApply();
    });
    await waitFor(() => expect(result.current.phase.phase).toBe('applying'));

    // Second call while applying — should not invoke applyImportMerge again
    await act(async () => {
      await result.current.runApply();
    });

    expect(mockedApply).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveApply({
        addedCount: 0, replacedCount: 0, skippedCount: 0,
        errorCount: 0, errorMessages: [],
      });
    });
  });

  it('banner → idle on cancelImport', async () => {
    const { result } = setupHook();
    const file = makeFile(validAppStateJson({ projects: [makeProject()] }));
    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(file));
    });
    await act(async () => {
      await result.current.runApply();
    });
    expect(result.current.phase.phase).toBe('banner');

    act(() => {
      result.current.cancelImport();
    });

    expect(result.current.phase.phase).toBe('idle');
  });

  it('Layer 1: reads repo.getProjects (no fast-path shortcut)', async () => {
    const getProjectsSpy = vi.spyOn(repo, 'getProjects');
    getProjectsSpy.mockClear();

    const { result } = setupHook();
    const file = makeFile(validAppStateJson({ projects: [makeProject()] }));
    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(file));
    });

    expect(getProjectsSpy).toHaveBeenCalled();
    expect(result.current.phase.phase).toBe('preview');

    getProjectsSpy.mockRestore();
  });

  it('replace decision: applyImportMerge receives preview with the correct decision (cloud-mode-agnostic check)', async () => {
    // We can't easily assert "saveProject called with { id: existingId }" because
    // applyImportMerge is mocked. Instead, assert the preview passed in has the
    // right decision.
    const existing = makeProject({ id: 'p1', name: 'Original' });
    await repo.saveProject(existing);

    const { result } = setupHook();
    const file = makeFile(
      validAppStateJson({
        projects: [makeProject({ id: 'p1', name: 'New' })],
      }),
    );
    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(file));
    });

    // detectConflicts defaulted to 'skip' for the ID conflict.
    // User flips to 'replace'.
    act(() => {
      result.current.setDecision('p1', 'replace');
    });

    await act(async () => {
      await result.current.runApply();
    });

    expect(mockedApply).toHaveBeenCalledTimes(1);
    const passedPreview = mockedApply.mock.calls[0][0];
    expect(passedPreview.decisions['p1']).toBe('replace');
  });

  it('add in local mode: decisions defaults to add with no conflicts (verified via preview)', async () => {
    const { result } = setupHook();
    const file = makeFile(
      validAppStateJson({
        projects: [makeProject({ id: 'p_new', name: 'Net New' })],
      }),
    );
    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(file));
    });

    expect(result.current.phase.phase).toBe('preview');
    if (result.current.phase.phase === 'preview') {
      expect(result.current.phase.preview.decisions['p_new']).toBe('add');
      expect(result.current.phase.preview.mode).toBe(getStorageMode());
    }
  });

  it('fileError cleared on new file pick', async () => {
    const { result } = setupHook();
    // First trigger an error
    const bad = makeFile('not json');
    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(bad));
    });
    expect(result.current.fileError).not.toBeNull();

    // Then a valid file — error should clear
    const good = makeFile(validAppStateJson({ projects: [makeProject()] }));
    await act(async () => {
      await result.current.handleFileChange(makeChangeEvent(good));
    });
    expect(result.current.fileError).toBeNull();
    expect(result.current.phase.phase).toBe('preview');
  });
});
