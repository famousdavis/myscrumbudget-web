// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Where each page's ProjectForm sends the user (FRAME26 stage 0, MSB-5).
 * `ProjectForm.test.tsx` proves the form navigates to `exitHref`; this file
 * proves each page hands it the page that opens that form: the dashboard for
 * New, the project's own page for Edit. Both are fixed in-app destinations, so
 * neither can send the user out of MyScrumBudget.
 */

import { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

const captured: { exitHref?: string }[] = [];
vi.mock('@/features/projects/components/ProjectForm', () => ({
  ProjectForm: (props: { exitHref?: string }) => {
    captured.push(props);
    return null;
  },
}));
vi.mock('@/features/projects/hooks/useProjects', () => ({
  useProjects: () => ({ createProject: vi.fn() }),
}));
vi.mock('@/features/projects/hooks/useProject', () => ({
  useProject: () => ({
    project: { id: 'p-42', name: 'Probe', startDate: '2026-01-01', endDate: '2026-06-30', reforecasts: [] },
    loading: false,
    updateProject: vi.fn(),
    flush: vi.fn(),
  }),
}));
vi.mock('@/features/reforecast/hooks/useReforecast', () => ({
  useReforecast: () => ({
    activeReforecast: null,
    commitReforecastStartDate: vi.fn(),
    commitReforecastEndDate: vi.fn(),
  }),
}));

import NewProjectPage from '../new/page';
import EditProjectPage from '../[id]/edit/page';

describe('ProjectForm exits', () => {
  beforeEach(() => {
    captured.length = 0;
  });

  it('the New Project page exits to the dashboard', () => {
    render(<NewProjectPage />);
    expect(captured.length).toBeGreaterThan(0);
    expect(captured.at(-1)?.exitHref).toBe('/');
  });

  it("the Edit Project page exits to the project's own page", async () => {
    const params = Promise.resolve({ id: 'p-42' });
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <EditProjectPage params={params} />
        </Suspense>,
      );
    });
    expect(captured.length, 'the Edit page never rendered its form').toBeGreaterThan(0);
    expect(captured.at(-1)?.exitHref).toBe('/projects/p-42');
  });
});
