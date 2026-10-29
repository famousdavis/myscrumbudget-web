// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * v0.44.6 — `docToProject` never throws, and sets aside only what no version of
 * the app writes.
 *
 * It runs for every project on the reader's list, on documents any member of a
 * project can write. Before this release a `reforecasts` value that was not a
 * list, or a `null` inside it, threw out of the list read and left the
 * dashboard empty. [FAILS-TODAY] tests throw against v0.44.5.
 *
 * ⚠️ THE MUST-PASS DOCUMENT IS THE POINT OF THIS FILE. A set-aside value is
 * written away by the next save, so a rule that tripped on anything the app
 * writes would delete real data. That test carries every field every version
 * since cloud storage (v0.16.0) has written, including the legacy root-level
 * `assignments`, and asserts nothing is set aside.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { docToProject } from '../firestoreUtils';
import { takeCloudLoadIssues } from '../cloudLoadGuard';

function reforecast(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, name: `RF ${id}`, createdAt: '2026-01-01T00:00:00Z',
    startDate: '2026-01-01', endDate: '2026-12-31', reforecastDate: '2026-01-15',
    assignments: [{ id: 'a1', poolMemberId: 'pm1' }],
    allocations: [{ memberId: 'a1', month: '2026-01', allocation: 0.5 }],
    productivityWindows: [{ id: 'w1', startDate: '2026-03-01', endDate: '2026-03-05', factor: 0 }],
    actualCost: 1000, baselineBudget: 50000,
    ...over,
  };
}

beforeEach(() => {
  takeCloudLoadIssues('p1');
  vi.restoreAllMocks();
});

describe('docToProject — shapes that used to throw', () => {
  it('[FAILS-TODAY] reforecasts that are not a list load as none, and the rest loads', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project = docToProject('p1', { name: 'Kept', reforecasts: 'x', activeReforecastId: 'rf1' });
    expect(project.name).toBe('Kept');
    expect(project.reforecasts).toEqual([]);
    expect(takeCloudLoadIssues('p1')).toEqual(['reforecasts-not-a-list']);
    // The rule only — never the project id or the value.
    expect(warn).toHaveBeenCalledWith('[cloud-load-guard] reforecasts-not-a-list');
  });

  it('[FAILS-TODAY] a reforecast that is not an object is set aside and its siblings load', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project = docToProject('p1', {
      name: 'P', reforecasts: [null, 7, ['x'], reforecast('rf1')], activeReforecastId: 'rf1',
    });
    expect(project.reforecasts.map((rf) => rf.id)).toEqual(['rf1']);
    expect(takeCloudLoadIssues('p1')).toEqual(['reforecast-not-an-object']);
  });

  it('[FAILS-TODAY] legacy root assignments that are not a list are set aside', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const legacy = reforecast('rf1');
    delete legacy.assignments;
    const project = docToProject('p1', { name: 'P', reforecasts: [legacy], assignments: 'x' });
    expect(project.reforecasts[0].assignments).toEqual([]);
    expect(takeCloudLoadIssues('p1')).toEqual(['legacy-assignments-not-a-list']);
  });

  it('a name, dates or active id that are not text are set aside', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project = docToProject('p1', {
      name: { x: 1 }, startDate: 20260101, endDate: ['2026'], activeReforecastId: 5, reforecasts: [],
    });
    expect(project.name).toBe('');
    expect(project.startDate).toBe('');
    expect(project.endDate).toBe('');
    expect(project.activeReforecastId).toBeNull();
    expect(takeCloudLoadIssues('p1').sort()).toEqual(
      ['active-reforecast-id-not-text', 'project-dates-not-text', 'project-name-not-text'],
    );
  });

  it('takeCloudLoadIssues hands the notes over once', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    docToProject('p1', { name: 'P', reforecasts: 'x' });
    expect(takeCloudLoadIssues('p1')).toHaveLength(1);
    expect(takeCloudLoadIssues('p1')).toEqual([]);
  });
});

describe('docToProject — [MUST-PASS] everything the app writes loads unchanged', () => {
  it('sets aside nothing in a document carrying every field any version has written', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const full = reforecast('rf1', {
      actualsThroughDate: '2026-06-30',
      notes: 'n'.repeat(2000),
      historicalCosts: [{ month: '2026-01', cost: 100, hours: 0 }, { month: '2026-02', cost: 200, hours: 8 }],
      charterBudget: {
        riskProfile: {
          projectType: 'biz', requirementsClarity: 'partial', teamExperience: 'some',
          orgChangeImpact: 'mod', integrationComplexity: 'mod', cvOverride: null, optimismUpliftPct: 0,
        },
        distribution: 'normal', targetPercentile: 80, derivedCV: 0.2, derivedSigma: 1000,
        etcAtCalculation: 5000, adjustedCostBasis: 5000, charterBudgetAmount: 6000,
        medianAmount: 5000, calculatedAt: '2026-01-01T00:00:00Z',
      },
    });
    // A reforecast saved before v0.24.0 has no assignments of its own; the
    // document then carries them at the root (schemaVersion 1).
    const legacy = reforecast('rf0');
    delete legacy.assignments;
    const reforecasts = [legacy, full, ...Array.from({ length: 40 }, (_, i) => reforecast(`rf${i + 2}`))];
    const data = {
      name: 'A project name of some length', startDate: '2026-01-01', endDate: '2026-12-31',
      reforecasts, activeReforecastId: 'rf1', assignments: [{ id: 'a9', poolMemberId: 'pm9' }],
      color: 'teal', archived: true, owner: 'u', members: { u: 'owner' }, order: 3,
      _teamSnapshot: { pm1: { name: 'Ada', role: 'Dev' } }, schemaVersion: 1,
    };
    const project = docToProject('p1', data);

    expect(takeCloudLoadIssues('p1')).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    expect(project.name).toBe(data.name);
    expect(project.activeReforecastId).toBe('rf1');
    expect(project.reforecasts).toHaveLength(42);
    expect(project.reforecasts[0].assignments).toEqual([{ id: 'a9', poolMemberId: 'pm9' }]);
    expect(project.reforecasts[1]).toEqual(full);
  });

  it('a missing or null field still loads as before, with nothing noted', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project = docToProject('p1', { name: null, activeReforecastId: null });
    expect(project).toMatchObject({ name: '', startDate: '', endDate: '', reforecasts: [], activeReforecastId: null });
    expect(takeCloudLoadIssues('p1')).toEqual([]);
  });
});
