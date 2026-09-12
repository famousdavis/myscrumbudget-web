// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The END-TO-END wiring for the shared-project team-name fallback (v0.38.2).
 *
 * ⚠️ WHY THIS FILE HAD TO EXIST. `resolveAssignments` has accepted a
 * `teamSnapshot` third argument since v0.16.0 and `teamResolution.test.ts` has
 * covered it correctly the whole time — passing the map to the function
 * directly. Those tests prove the HELPER works. Nothing proved the APP ever
 * supplies one, and for three years of releases it did not: all four production
 * call sites passed two arguments, and `docToProject` discarded the map before
 * it could reach them. A green helper test beside a dead call site is the
 * vacuity class this project keeps finding; the discriminator is a test that
 * drives the real consumer with a VIEWER'S OWN (empty) POOL.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Project, PoolMember } from '@/types/domain';
import { useTeam } from '../useTeam';

/** A project shared BY someone else: its assignments name pool members the viewer does not have. */
function sharedProject(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Virtual Art Museum Team 4',
    startDate: '2026-08-20',
    endDate: '2026-12-04',
    activeReforecastId: 'rf1',
    reforecasts: [{
      id: 'rf1',
      name: 'August 27',
      createdAt: '2026-08-27T00:00:00Z',
      reforecastDate: '2026-09-12',
      startDate: '2026-08-20',
      endDate: '2026-12-04',
      assignments: [
        { id: 'a1', poolMemberId: 'owner-pm-1' },
        { id: 'a2', poolMemberId: 'owner-pm-2' },
      ],
      allocations: [],
      productivityWindows: [],
      actualCost: 2500,
      baselineBudget: 84000,
    }],
    _teamSnapshot: {
      'owner-pm-1': { name: 'Grace Kim', role: 'Data Engineer' },
      'owner-pm-2': { name: 'Alice Ray', role: 'BA' },
    },
    ...over,
  };
}

function render(project: Project | null, pool: PoolMember[]) {
  const updateProject = vi.fn();
  const hook = renderHook(() => useTeam({ project, updateProject, pool }));
  return { ...hook, updateProject };
}

describe('useTeam — shared-project team names', () => {
  it('names the owner\'s team when the VIEWER\'s pool is empty', () => {
    // [FAILS-TODAY] This is the reported defect verbatim: every row of a shared
    // project rendered "(Unknown)" with an empty role, because the viewer's own
    // pool resolves none of the owner's poolMemberIds and the snapshot never
    // reached this call site.
    const { result } = render(sharedProject(), []);

    // Names asserted first and on their own: the whole-object form below
    // truncates to "[ { id: 'a1', ...(2) }, ...(1) ]" on both sides, which is a
    // real assertion printing an unreadable diff.
    expect(result.current.members.map((m) => m.name)).toEqual(['Grace Kim', 'Alice Ray']);
    expect(result.current.members).toEqual([
      { id: 'a1', name: 'Grace Kim', role: 'Data Engineer' },
      { id: 'a2', name: 'Alice Ray', role: 'BA' },
    ]);
  });

  it('keeps assignment ids as the resolved member id, so allocations still match', () => {
    // Load-bearing: MonthlyAllocation.memberId references the ASSIGNMENT id.
    // A fallback that minted its own ids would name the rows and silently
    // detach every allocation from them.
    const { result } = render(sharedProject(), []);
    expect(result.current.members.map((m) => m.id)).toEqual(['a1', 'a2']);
  });

  it('prefers the viewer\'s OWN pool over the snapshot', () => {
    // The pool is live; the snapshot is a cache written at the owner's last
    // save. Where both know a member, the pool wins.
    const { result } = render(sharedProject(), [
      { id: 'owner-pm-1', name: 'Grace Kim (my pool)', role: 'Developer' },
    ]);

    expect(result.current.members[0]).toEqual({
      id: 'a1', name: 'Grace Kim (my pool)', role: 'Developer',
    });
    expect(result.current.members[1].name).toBe('Alice Ray');
  });

  it('still reports (Unknown) when NEITHER the pool nor the snapshot has the member', () => {
    // The fallback must not mask a genuinely unresolvable assignment — that is
    // a real data problem and it should still be visible.
    const { result } = render(sharedProject({ _teamSnapshot: undefined }), []);
    expect(result.current.members.map((m) => m.name)).toEqual(['(Unknown)', '(Unknown)']);
  });

  it('sorts a shared roster by the SNAPSHOT names, not by "(Unknown)"', () => {
    // [FAILS-TODAY] Pins the SECOND call site (sortAssignments) independently
    // of the first. At HEAD every name resolved to the identical "(Unknown)",
    // so sorting a shared project was a no-op that looked like it had worked.
    const project = sharedProject({
      _teamSnapshot: {
        'owner-pm-1': { name: 'Zoe Last', role: 'QA' },
        'owner-pm-2': { name: 'Adam First', role: 'BA' },
      },
    });
    const { result, updateProject } = render(project, []);

    act(() => { result.current.sortAssignments('name'); });

    expect(updateProject).toHaveBeenCalledTimes(1);
    const updater = updateProject.mock.calls[0][0] as (p: Project) => Project;
    expect(updater(project).reforecasts[0].assignments.map((a) => a.id)).toEqual(['a2', 'a1']);
  });
});
