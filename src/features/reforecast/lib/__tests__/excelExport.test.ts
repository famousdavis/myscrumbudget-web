// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildResourcePlanWorkbookBlob } from '../excelExport';
import {
  RESOURCE_PLAN_SHEET_NAME,
  RESOURCE_PLAN_META_SHEET_NAME,
} from '@/lib/constants';
import type { Project, Reforecast, TeamMember } from '@/types/domain';
import { buildAllocationMap } from '@/lib/calc/allocationMap';

function makeReforecast(overrides: Partial<Reforecast> = {}): Reforecast {
  return {
    id: 'rf-1',
    name: 'Baseline',
    createdAt: '2026-01-01T00:00:00Z',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    reforecastDate: '2026-01-15',
    assignments: [],
    allocations: [],
    productivityWindows: [],
    actualCost: 0,
    baselineBudget: 100000,
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    reforecasts: [makeReforecast()],
    activeReforecastId: 'rf-1',
    ...overrides,
  };
}

async function loadBlob(blob: Blob): Promise<ExcelJS.Workbook> {
  const buf = await blob.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

describe('buildResourcePlanWorkbookBlob', () => {
  it('returns a Blob containing the Resource Plan worksheet', async () => {
    const blob = await buildResourcePlanWorkbookBlob({
      project: makeProject(),
      reforecast: makeReforecast(),
      members: [],
      allocationMap: buildAllocationMap([]),
      months: ['2026-01', '2026-02', '2026-03'],
    });
    const wb = await loadBlob(blob);
    expect(wb.getWorksheet(RESOURCE_PLAN_SHEET_NAME)).toBeDefined();
  });

  it('writes the expected header row 4 for a 3-month project', async () => {
    const months = ['2026-01', '2026-02', '2026-03'];
    const blob = await buildResourcePlanWorkbookBlob({
      project: makeProject(),
      reforecast: makeReforecast(),
      members: [],
      allocationMap: buildAllocationMap([]),
      months,
    });
    const wb = await loadBlob(blob);
    const sheet = wb.getWorksheet(RESOURCE_PLAN_SHEET_NAME)!;
    const header = sheet.getRow(4);
    expect(header.getCell(1).value).toBe('Name');
    expect(header.getCell(2).value).toBe('Role');
    months.forEach((m, i) => {
      expect(header.getCell(3 + i).value).toBe(m);
    });
  });

  it('writes the expected header row 4 for a 12-month project', async () => {
    const months = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
    const blob = await buildResourcePlanWorkbookBlob({
      project: makeProject(),
      reforecast: makeReforecast(),
      members: [],
      allocationMap: buildAllocationMap([]),
      months,
    });
    const wb = await loadBlob(blob);
    const sheet = wb.getWorksheet(RESOURCE_PLAN_SHEET_NAME)!;
    months.forEach((m, i) => {
      expect(sheet.getRow(4).getCell(3 + i).value).toBe(m);
    });
  });

  it('renders data rows in member order with allocations as decimals + 0% format', async () => {
    const months = ['2026-01', '2026-02'];
    const members: TeamMember[] = [
      { id: 'a1', name: 'Alice', role: 'Dev' },
      { id: 'a2', name: 'Bob', role: 'QA' },
    ];
    const allocationMap = buildAllocationMap([
      { memberId: 'a1', month: '2026-01', allocation: 0.75 },
      { memberId: 'a2', month: '2026-02', allocation: 0.5 },
    ]);
    const blob = await buildResourcePlanWorkbookBlob({
      project: makeProject(),
      reforecast: makeReforecast(),
      members,
      allocationMap,
      months,
    });
    const wb = await loadBlob(blob);
    const sheet = wb.getWorksheet(RESOURCE_PLAN_SHEET_NAME)!;

    expect(sheet.getCell(5, 1).value).toBe('Alice');
    expect(sheet.getCell(5, 2).value).toBe('Dev');
    expect(sheet.getCell(5, 3).value).toBe(0.75);
    expect(sheet.getCell(5, 4).value).toBe(0); // empty allocation → 0, not blank
    expect(sheet.getCell(5, 3).numFmt).toBe('0%');
    expect(sheet.getCell(5, 4).numFmt).toBe('0%');

    expect(sheet.getCell(6, 1).value).toBe('Bob');
    expect(sheet.getCell(6, 3).value).toBe(0);
    expect(sheet.getCell(6, 4).value).toBe(0.5);
  });

  it('exports zero (not blank) for empty allocations', async () => {
    const months = ['2026-01'];
    const members: TeamMember[] = [{ id: 'a1', name: 'Alice', role: 'Dev' }];
    const blob = await buildResourcePlanWorkbookBlob({
      project: makeProject(),
      reforecast: makeReforecast(),
      members,
      allocationMap: buildAllocationMap([]),
      months,
    });
    const wb = await loadBlob(blob);
    const sheet = wb.getWorksheet(RESOURCE_PLAN_SHEET_NAME)!;
    expect(sheet.getCell(5, 3).value).toBe(0);
  });

  it('shades every allocation cell pale yellow (FFFF99) — input-cell convention', async () => {
    const months = ['2026-01', '2026-02'];
    const members: TeamMember[] = [
      { id: 'a1', name: 'Alice', role: 'Dev' },
      { id: 'a2', name: 'Bob', role: 'QA' },
    ];
    const allocationMap = buildAllocationMap([
      { memberId: 'a1', month: '2026-01', allocation: 0.5 },
    ]);
    const blob = await buildResourcePlanWorkbookBlob({
      project: makeProject(),
      reforecast: makeReforecast(),
      members,
      allocationMap,
      months,
    });
    const wb = await loadBlob(blob);
    const sheet = wb.getWorksheet(RESOURCE_PLAN_SHEET_NAME)!;

    // Both populated and empty allocation cells get the fill.
    for (const [r, c] of [
      [5, 3],
      [5, 4],
      [6, 3],
      [6, 4],
    ]) {
      const fill = sheet.getCell(r, c).fill as
        | { type: string; pattern: string; fgColor: { argb: string } }
        | undefined;
      expect(fill?.type).toBe('pattern');
      expect(fill?.pattern).toBe('solid');
      expect(fill?.fgColor?.argb).toBe('FFFFFF99');
    }

    // Name and Role columns should NOT be filled.
    expect(sheet.getCell(5, 1).fill).toBeUndefined();
    expect(sheet.getCell(5, 2).fill).toBeUndefined();
  });

  it('hides the metadata sheet (state veryHidden) and stores valid JSON in A1', async () => {
    const blob = await buildResourcePlanWorkbookBlob({
      project: makeProject({ id: 'proj-meta', name: 'Meta Project' }),
      reforecast: makeReforecast({ id: 'rf-meta', name: 'Q3 Reforecast' }),
      members: [],
      allocationMap: buildAllocationMap([]),
      months: ['2026-01'],
    });
    const wb = await loadBlob(blob);
    const meta = wb.getWorksheet(RESOURCE_PLAN_META_SHEET_NAME)!;
    expect(meta).toBeDefined();
    expect(meta.state).toBe('veryHidden');
    const raw = meta.getCell('A1').value;
    expect(typeof raw).toBe('string');
    const parsed = JSON.parse(raw as string);
    expect(parsed.schema).toBe(1);
    expect(parsed.appVersion).toBeTruthy();
    expect(parsed.projectId).toBe('proj-meta');
    expect(parsed.projectName).toBe('Meta Project');
    expect(parsed.reforecastId).toBe('rf-meta');
    expect(parsed.reforecastName).toBe('Q3 Reforecast');
    expect(parsed.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('freezes the header (row 4) and Name/Role columns', async () => {
    const blob = await buildResourcePlanWorkbookBlob({
      project: makeProject(),
      reforecast: makeReforecast(),
      members: [],
      allocationMap: buildAllocationMap([]),
      months: ['2026-01'],
    });
    const wb = await loadBlob(blob);
    const sheet = wb.getWorksheet(RESOURCE_PLAN_SHEET_NAME)!;
    const view = sheet.views?.[0];
    expect(view?.state).toBe('frozen');
    expect((view as { xSplit: number; ySplit: number }).xSplit).toBe(2);
    expect((view as { xSplit: number; ySplit: number }).ySplit).toBe(4);
  });

  it('merges the title row (row 1) and metadata row (row 2)', async () => {
    const months = ['2026-01', '2026-02', '2026-03'];
    const blob = await buildResourcePlanWorkbookBlob({
      project: makeProject(),
      reforecast: makeReforecast(),
      members: [],
      allocationMap: buildAllocationMap([]),
      months,
    });
    const wb = await loadBlob(blob);
    const sheet = wb.getWorksheet(RESOURCE_PLAN_SHEET_NAME)!;
    // ExcelJS exposes mergeCells via internal model; verify by re-reading A1
    // and checking that adjacent header cells are NOT independently set in row 1.
    expect(sheet.getCell('A1').value).toContain('Resource Plan');
    expect(sheet.getCell('A2').value).toContain('Project:');
    // Cells E1 (5th col, beyond merge's last col would also share value via merge model)
    // exceljs returns the merged master value when reading any merged cell.
    expect(sheet.getCell('A1').isMerged).toBe(true);
    expect(sheet.getCell('A2').isMerged).toBe(true);
  });
});
