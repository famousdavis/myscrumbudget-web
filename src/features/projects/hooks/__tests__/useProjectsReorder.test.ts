// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * `useProjects.reorderProjects` against the REAL localStorage repository.
 *
 * ⚠️ WHY A SEPARATE FILE, AND NOT A `describe` ADDED TO useProjects.test.ts:
 * that file mocks the repository wholesale with `vi.fn()`s, so it has NO storage.
 * The assertion that matters here is about persisted bytes, and a mock-only
 * version of it would assert its own setup rather than the code under test.
 *
 * ⚠️ ONE SHARED REPOSITORY INSTANCE. Two instances read the same localStorage and
 * so look equivalent, but a spy on one never sees calls made on the other — see
 * the note in useProject.test.ts recording the two tests that cost.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Project } from '@/types/domain';

const { repo } = await vi.hoisted(async () => {
  const { createLocalStorageRepository } = await import('@/lib/storage/localStorage');
  return { repo: createLocalStorageRepository() };
});
vi.mock('@/components/RepositoryProvider', () => {
  const value = { repository: repo, mode: 'local' as const, isCloud: false, switchMode: vi.fn() };
  return { useRepository: () => value };
});

import { useProjects } from '../useProjects';

function makeProject(id: string): Project {
  return {
    id,
    name: `Project ${id}`,
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
        assignments: [],
        allocations: [],
        productivityWindows: [],
        actualCost: 0,
        baselineBudget: 100000,
      },
    ],
  };
}

const storedIds = async () => (await repo.getProjects()).map((p) => p.id);

describe('useProjects — reorderProjects against a list this tab never saw', () => {
  beforeEach(async () => {
    localStorage.clear();
    await repo.clear();
  });

  it('keeps a project written by another tab, in storage AND on screen', async () => {
    // The two-tab scenario, seeded the way it actually arises: some OTHER writer
    // of `msb:projects` — a second tab today, any future non-hook writer
    // tomorrow — adds a project this hook instance has never loaded. Nothing
    // corrects it in local mode: `localStorage.ts` has zero `cloudSyncBus`
    // references and there is no `storage` listener for the data keys.
    await repo.saveProject(makeProject('a'));
    await repo.saveProject(makeProject('b'));

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // ⚠️ PRECONDITION ASSERTED, NOT ASSUMED. Without this the test could pass
    // for the wrong reason — a setup that never created the stale state would
    // make the real assertion below vacuous.
    expect(result.current.projects.map((p) => p.id)).toEqual(['a', 'b']);

    // "Tab A" creates a project. This hook instance is not told and does not know.
    await repo.saveProject(makeProject('NEW'));
    expect(result.current.projects.map((p) => p.id)).toEqual(['a', 'b']);

    // "Tab B" drags. Its `orderedIds` predates 'NEW' — it cannot name it.
    await act(async () => {
      await result.current.reorderProjects(['b', 'a']);
    });

    // ⚠️ TWO ASSERTIONS, DELIBERATELY, AND THE SPLIT IS THE EVIDENCE. Up to
    // v0.37.11 the first failed: the repository rebuilt storage from exactly the
    // ids it was handed and 'NEW' was destroyed, permanently and silently. With
    // the repository fixed but no reload, the FIRST passes and the SECOND fails —
    // the bytes are safe while the dashboard still shows a list without it.
    expect(await storedIds()).toEqual(['b', 'a', 'NEW']);
    expect(result.current.projects.map((p) => p.id)).toEqual(['b', 'a', 'NEW']);
  });
});
