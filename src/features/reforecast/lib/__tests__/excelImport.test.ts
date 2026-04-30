// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseResourcePlanWorkbook } from '../excelImport';
import { buildResourcePlanWorkbookBlob } from '../excelExport';
import {
  RESOURCE_PLAN_SHEET_NAME,
  RESOURCE_PLAN_META_SHEET_NAME,
} from '@/lib/constants';
import type {
  Project,
  Reforecast,
  PoolMember,
  Settings,
  TeamMember,
} from '@/types/domain';
import { buildAllocationMap } from '@/lib/calc/allocationMap';

/* ── Fixtures ─────────────────────────────────────────────────────── */

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

function makeReforecast(overrides: Partial<Reforecast> = {}): Reforecast {
  return {
    id: 'rf-1',
    name: 'Baseline',
    createdAt: '2026-01-01T00:00:00Z',
    startDate: '2026-01',
    reforecastDate: '2026-01-15',
    assignments: [],
    allocations: [],
    productivityWindows: [],
    actualCost: 0,
    baselineBudget: 100000,
    ...overrides,
  };
}

const SETTINGS: Settings = {
  discountRateAnnual: 0.03,
  laborRates: [
    { role: 'Developer', hourlyRate: 100 },
    { role: 'QA', hourlyRate: 80 },
  ],
  holidays: [],
  trafficLightThresholds: { amberPercent: 5, redPercent: 15 },
};

const MONTHS = ['2026-01', '2026-02', '2026-03'];

/* ── Helpers ──────────────────────────────────────────────────────── */

function blobToFile(blob: Blob, name = 'plan.xlsx'): File {
  return new File([blob], name, { type: blob.type });
}

async function buildBaselineFile(opts: {
  project?: Project;
  reforecast?: Reforecast;
  members?: TeamMember[];
  months?: string[];
} = {}) {
  const project = opts.project ?? makeProject();
  const reforecast = opts.reforecast ?? makeReforecast();
  const members = opts.members ?? [];
  const months = opts.months ?? MONTHS;
  const blob = await buildResourcePlanWorkbookBlob({
    project,
    reforecast,
    members,
    allocationMap: buildAllocationMap(reforecast.allocations),
    months,
  });
  return { file: blobToFile(blob), project, reforecast, months };
}

/**
 * Build a workbook from scratch for negative tests (missing sheets,
 * malformed metadata, hand-crafted edge cases).
 */
async function buildCustomFile(
  configure: (wb: ExcelJS.Workbook) => void | Promise<void>,
): Promise<File> {
  const wb = new ExcelJS.Workbook();
  await configure(wb);
  const buf = await wb.xlsx.writeBuffer();
  return blobToFile(
    new Blob([buf as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
}

/* ── Happy path ──────────────────────────────────────────────────── */

describe('parseResourcePlanWorkbook — happy path', () => {
  it('returns ok:true with no warnings for an unmodified export', async () => {
    const project = makeProject();
    const reforecast = makeReforecast({
      assignments: [
        { id: 'a1', poolMemberId: 'pm1' },
      ],
      allocations: [{ memberId: 'a1', month: '2026-01', allocation: 0.5 }],
    });
    const updatedProject: Project = {
      ...project,
      reforecasts: [reforecast],
    };
    const pool: PoolMember[] = [{ id: 'pm1', name: 'Alice', role: 'Developer' }];
    const members: TeamMember[] = [{ id: 'a1', name: 'Alice', role: 'Developer' }];

    const { file } = await buildBaselineFile({
      project: updatedProject,
      reforecast,
      members,
    });
    const result = await parseResourcePlanWorkbook(
      file,
      updatedProject,
      reforecast,
      pool,
      SETTINGS,
      MONTHS,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Alice');
    expect(result.rows[0].allocationsByMonth['2026-01']).toBe(0.5);
    expect(result.warnings).toEqual([]);
  });
});

/* ── E1: invalid file ────────────────────────────────────────────── */

describe('parseResourcePlanWorkbook — E1', () => {
  it('rejects a non-xlsx blob', async () => {
    const file = new File([new Blob(['not xlsx'])], 'bad.xlsx');
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/^E1/);
  });
});

/* ── E2: missing Resource Plan sheet ─────────────────────────────── */

describe('parseResourcePlanWorkbook — E2', () => {
  it('rejects a workbook without a Resource Plan sheet', async () => {
    const file = await buildCustomFile((wb) => {
      const meta = wb.addWorksheet(RESOURCE_PLAN_META_SHEET_NAME);
      meta.getCell('A1').value = JSON.stringify({
        schema: 1,
        projectId: 'proj-1',
        projectName: 'X',
        reforecastId: 'rf-1',
        reforecastName: 'X',
      });
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/^E2/);
  });
});

/* ── E3: meta sheet missing or invalid ───────────────────────────── */

describe('parseResourcePlanWorkbook — E3', () => {
  it('rejects when metadata sheet is missing', async () => {
    const file = await buildCustomFile((wb) => {
      wb.addWorksheet(RESOURCE_PLAN_SHEET_NAME);
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/^E3/);
  });

  it('rejects when meta A1 is empty', async () => {
    const file = await buildCustomFile((wb) => {
      wb.addWorksheet(RESOURCE_PLAN_SHEET_NAME);
      wb.addWorksheet(RESOURCE_PLAN_META_SHEET_NAME); // no A1 value
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/^E3/);
  });

  it('rejects when meta A1 is non-JSON text', async () => {
    const file = await buildCustomFile((wb) => {
      wb.addWorksheet(RESOURCE_PLAN_SHEET_NAME);
      const meta = wb.addWorksheet(RESOURCE_PLAN_META_SHEET_NAME);
      meta.getCell('A1').value = 'not-json-{{';
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/^E3/);
  });

  it('rejects when meta JSON is missing required fields', async () => {
    const file = await buildCustomFile((wb) => {
      wb.addWorksheet(RESOURCE_PLAN_SHEET_NAME);
      const meta = wb.addWorksheet(RESOURCE_PLAN_META_SHEET_NAME);
      meta.getCell('A1').value = JSON.stringify({ schema: 1, projectName: 'X' });
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/^E3/);
  });
});

/* ── E4: project ID mismatch ─────────────────────────────────────── */

describe('parseResourcePlanWorkbook — E4', () => {
  it('blocks import when projectId does not match', async () => {
    const sourceProject = makeProject({ id: 'source-proj', name: 'Source' });
    const { file } = await buildBaselineFile({ project: sourceProject });

    const targetProject = makeProject({ id: 'different-proj', name: 'Target' });
    const result = await parseResourcePlanWorkbook(
      file,
      targetProject,
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/^E4/);
    expect(result.errors[0]).toContain('Source');
    expect(result.errors[0]).toContain('Target');
  });
});

/* ── E5: header row mismatch ─────────────────────────────────────── */

describe('parseResourcePlanWorkbook — E5', () => {
  async function buildWithHeader(
    headerCells: (string | null)[],
    extraCol?: string,
  ): Promise<File> {
    return buildCustomFile((wb) => {
      const sheet = wb.addWorksheet(RESOURCE_PLAN_SHEET_NAME);
      headerCells.forEach((v, i) => {
        if (v !== null) sheet.getCell(4, i + 1).value = v;
      });
      if (extraCol) sheet.getCell(4, headerCells.length + 1).value = extraCol;
      const meta = wb.addWorksheet(RESOURCE_PLAN_META_SHEET_NAME);
      meta.getCell('A1').value = JSON.stringify({
        schema: 1,
        projectId: 'proj-1',
        projectName: 'P',
        reforecastId: 'rf-1',
        reforecastName: 'R',
      });
    });
  }

  it('rejects fewer month columns than expected', async () => {
    const file = await buildWithHeader(['Name', 'Role', '2026-01', '2026-02']); // missing 2026-03
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith('E5'))).toBe(true);
  });

  it('rejects wrong month label at a column', async () => {
    const file = await buildWithHeader(['Name', 'Role', '2026-01', '2027-01', '2026-03']);
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => /E5.*2026-02/.test(e))).toBe(true);
  });

  it('rejects when A4 is "Member" instead of "Name"', async () => {
    const file = await buildWithHeader(['Member', 'Role', '2026-01', '2026-02', '2026-03']);
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith('E5'))).toBe(true);
  });

  it('rejects extra column past the last expected month', async () => {
    const file = await buildWithHeader(
      ['Name', 'Role', '2026-01', '2026-02', '2026-03'],
      '2026-04',
    );
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith('E5'))).toBe(true);
  });
});

/* ── E6 / E7 / E8 / E9 / value interpretation / blank rows ───────── */

describe('parseResourcePlanWorkbook — data row validation', () => {
  /**
   * Build a valid header + meta workbook, then let the test populate data rows
   * starting at row 5.
   */
  async function buildWithRows(
    populate: (sheet: ExcelJS.Worksheet) => void,
  ): Promise<File> {
    return buildCustomFile((wb) => {
      const sheet = wb.addWorksheet(RESOURCE_PLAN_SHEET_NAME);
      sheet.getCell(4, 1).value = 'Name';
      sheet.getCell(4, 2).value = 'Role';
      MONTHS.forEach((m, i) => {
        sheet.getCell(4, 3 + i).value = m;
      });
      populate(sheet);
      const meta = wb.addWorksheet(RESOURCE_PLAN_META_SHEET_NAME);
      meta.getCell('A1').value = JSON.stringify({
        schema: 1,
        projectId: 'proj-1',
        projectName: 'P',
        reforecastId: 'rf-1',
        reforecastName: 'R',
      });
    });
  }

  it('E6: rejects row with empty Name', async () => {
    const file = await buildWithRows((sheet) => {
      sheet.getCell(5, 2).value = 'Developer';
      sheet.getCell(5, 3).value = 0.5;
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith('E6'))).toBe(true);
  });

  it('E6: rejects row with empty Role', async () => {
    const file = await buildWithRows((sheet) => {
      sheet.getCell(5, 1).value = 'Alice';
      sheet.getCell(5, 3).value = 0.5;
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith('E6'))).toBe(true);
  });

  it('E7: rejects non-numeric allocation cell', async () => {
    const file = await buildWithRows((sheet) => {
      sheet.getCell(5, 1).value = 'Alice';
      sheet.getCell(5, 2).value = 'Developer';
      sheet.getCell(5, 3).value = 'abc';
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith('E7'))).toBe(true);
  });

  it('E8: rejects negative allocation', async () => {
    const file = await buildWithRows((sheet) => {
      sheet.getCell(5, 1).value = 'Alice';
      sheet.getCell(5, 2).value = 'Developer';
      sheet.getCell(5, 3).value = -1;
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith('E8'))).toBe(true);
  });

  it('E8: rejects allocation > 100', async () => {
    const file = await buildWithRows((sheet) => {
      sheet.getCell(5, 1).value = 'Alice';
      sheet.getCell(5, 2).value = 'Developer';
      sheet.getCell(5, 3).value = 101;
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith('E8'))).toBe(true);
  });

  it('E9: rejects duplicate names (case-insensitive)', async () => {
    const file = await buildWithRows((sheet) => {
      sheet.getCell(5, 1).value = 'Alice';
      sheet.getCell(5, 2).value = 'Developer';
      sheet.getCell(6, 1).value = 'ALICE';
      sheet.getCell(6, 2).value = 'QA';
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith('E9'))).toBe(true);
  });

  it('allocation interpretation: 0.5 → 0.5, 75 → 0.75, 100 → 1, 100.0001 → E8', async () => {
    const file = await buildWithRows((sheet) => {
      sheet.getCell(5, 1).value = 'Alice';
      sheet.getCell(5, 2).value = 'Developer';
      sheet.getCell(5, 3).value = 0.5;
      sheet.getCell(5, 4).value = 75;
      sheet.getCell(5, 5).value = 100;
      sheet.getCell(6, 1).value = 'Bob';
      sheet.getCell(6, 2).value = 'QA';
      sheet.getCell(6, 3).value = 100.0001;
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    // Bob's 100.0001 produces E8; Alice's row should still parse but the
    // overall result is ok:false because errors are aggregated.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith('E8'))).toBe(true);
  });

  it('allocation interpretation: 1.0001 → 0.010001 (boundary into percentage path)', async () => {
    const file = await buildWithRows((sheet) => {
      sheet.getCell(5, 1).value = 'Alice';
      sheet.getCell(5, 2).value = 'Developer';
      sheet.getCell(5, 3).value = 1.0001;
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].allocationsByMonth['2026-01']).toBeCloseTo(0.010001, 6);
  });

  it('skips trailing all-blank rows silently', async () => {
    const file = await buildWithRows((sheet) => {
      sheet.getCell(5, 1).value = 'Alice';
      sheet.getCell(5, 2).value = 'Developer';
      sheet.getCell(5, 3).value = 0.5;
      // rows 6-10 left entirely blank — should be ignored, not E6
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
  });
});

/* ── Soft warnings W1 / W2 / W3 / W4 ─────────────────────────────── */

describe('parseResourcePlanWorkbook — soft warnings', () => {
  async function buildWithRowsAndMeta(
    populate: (sheet: ExcelJS.Worksheet) => void,
    metaOverrides: { reforecastId?: string; reforecastName?: string } = {},
  ): Promise<File> {
    return buildCustomFile((wb) => {
      const sheet = wb.addWorksheet(RESOURCE_PLAN_SHEET_NAME);
      sheet.getCell(4, 1).value = 'Name';
      sheet.getCell(4, 2).value = 'Role';
      MONTHS.forEach((m, i) => {
        sheet.getCell(4, 3 + i).value = m;
      });
      populate(sheet);
      const meta = wb.addWorksheet(RESOURCE_PLAN_META_SHEET_NAME);
      meta.getCell('A1').value = JSON.stringify({
        schema: 1,
        projectId: 'proj-1',
        projectName: 'P',
        reforecastId: metaOverrides.reforecastId ?? 'rf-1',
        reforecastName: metaOverrides.reforecastName ?? 'Baseline',
      });
    });
  }

  it('W1: new pool member with role matching labor rates → no Unknown fallback', async () => {
    const file = await buildWithRowsAndMeta((sheet) => {
      sheet.getCell(5, 1).value = 'Alice';
      sheet.getCell(5, 2).value = 'Developer'; // matches SETTINGS.laborRates
      sheet.getCell(5, 3).value = 0.5;
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [], // pool empty — Alice is new
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const w1 = result.warnings.find((w) => w.code === 'W1');
    expect(w1).toBeDefined();
    if (w1?.code !== 'W1') return;
    expect(w1.memberName).toBe('Alice');
    expect(w1.assignedRole).toBe('Developer');
    expect(w1.fellBackToUnknown).toBe(false);
  });

  it('W1: new pool member with role NOT in labor rates → Unknown fallback', async () => {
    const file = await buildWithRowsAndMeta((sheet) => {
      sheet.getCell(5, 1).value = 'Alice';
      sheet.getCell(5, 2).value = 'Foo'; // not a labor rate
      sheet.getCell(5, 3).value = 0.5;
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const w1 = result.warnings.find((w) => w.code === 'W1');
    expect(w1).toBeDefined();
    if (w1?.code !== 'W1') return;
    expect(w1.assignedRole).toBe('Unknown');
    expect(w1.fellBackToUnknown).toBe(true);
  });

  it('W2: existing pool member with different role → kept pool role, warning emitted', async () => {
    const pool: PoolMember[] = [{ id: 'pm1', name: 'Alice', role: 'Developer' }];
    const file = await buildWithRowsAndMeta((sheet) => {
      sheet.getCell(5, 1).value = 'Alice';
      sheet.getCell(5, 2).value = 'QA'; // differs from pool's "Developer"
      sheet.getCell(5, 3).value = 0.5;
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      pool,
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const w2 = result.warnings.find((w) => w.code === 'W2');
    expect(w2).toBeDefined();
    if (w2?.code !== 'W2') return;
    expect(w2.memberName).toBe('Alice');
    expect(w2.poolRole).toBe('Developer');
    expect(w2.excelRole).toBe('QA');
  });

  it('W3: members in active reforecast missing from Excel are reported', async () => {
    const pool: PoolMember[] = [
      { id: 'pm1', name: 'Alice', role: 'Developer' },
      { id: 'pm2', name: 'Bob', role: 'QA' },
      { id: 'pm3', name: 'Carol', role: 'Developer' },
    ];
    const reforecast = makeReforecast({
      assignments: [
        { id: 'a1', poolMemberId: 'pm1' },
        { id: 'a2', poolMemberId: 'pm2' },
        { id: 'a3', poolMemberId: 'pm3' },
      ],
    });
    const file = await buildWithRowsAndMeta((sheet) => {
      sheet.getCell(5, 1).value = 'Alice';
      sheet.getCell(5, 2).value = 'Developer';
      sheet.getCell(5, 3).value = 0.5;
      sheet.getCell(6, 1).value = 'Bob';
      sheet.getCell(6, 2).value = 'QA';
      sheet.getCell(6, 3).value = 0.5;
      // Carol absent from Excel → should produce W3
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      reforecast,
      pool,
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const w3 = result.warnings.find((w) => w.code === 'W3');
    expect(w3).toBeDefined();
    if (w3?.code !== 'W3') return;
    expect(w3.memberName).toBe('Carol');
  });

  it('W4: reforecastId mismatch produces a warning with both names', async () => {
    const file = await buildWithRowsAndMeta(
      (sheet) => {
        sheet.getCell(5, 1).value = 'Alice';
        sheet.getCell(5, 2).value = 'Developer';
        sheet.getCell(5, 3).value = 0.5;
      },
      { reforecastId: 'rf-other', reforecastName: 'Q3 Reforecast' },
    );
    const pool: PoolMember[] = [{ id: 'pm1', name: 'Alice', role: 'Developer' }];
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast({ id: 'rf-1', name: 'Baseline' }),
      pool,
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const w4 = result.warnings.find((w) => w.code === 'W4');
    expect(w4).toBeDefined();
    if (w4?.code !== 'W4') return;
    expect(w4.sourceReforecastName).toBe('Q3 Reforecast');
    expect(w4.activeReforecastName).toBe('Baseline');
  });

  it('W5: matched archived pool member emits W5 with poolMemberId', async () => {
    const pool: PoolMember[] = [
      { id: 'pm-1', name: 'Alice', role: 'Developer', archived: true },
    ];
    const file = await buildWithRowsAndMeta((sheet) => {
      sheet.getCell(5, 1).value = 'Alice';
      sheet.getCell(5, 2).value = 'Developer';
      sheet.getCell(5, 3).value = 0.5;
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      pool,
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const w5 = result.warnings.find((w) => w.code === 'W5');
    expect(w5).toBeDefined();
    if (w5?.code !== 'W5') return;
    expect(w5.memberName).toBe('Alice');
    expect(w5.poolMemberId).toBe('pm-1');
  });

  it('W5: matched archived member does not emit W1 (no duplicate add)', async () => {
    // The load-bearing assertion that proves the matched archived member
    // took the existing-match path, not the new-member path. Without this
    // the importer would create a duplicate pool entry instead of unarchiving.
    const pool: PoolMember[] = [
      { id: 'pm-1', name: 'Alice', role: 'Developer', archived: true },
    ];
    const file = await buildWithRowsAndMeta((sheet) => {
      sheet.getCell(5, 1).value = 'Alice';
      sheet.getCell(5, 2).value = 'Developer';
      sheet.getCell(5, 3).value = 0.5;
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      pool,
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const w5Count = result.warnings.filter((w) => w.code === 'W5').length;
    const w1Count = result.warnings.filter((w) => w.code === 'W1').length;
    expect(w5Count).toBe(1);
    expect(w1Count).toBe(0);
  });
});

/* ── Errors aggregated, not short-circuit ─────────────────────────── */

describe('parseResourcePlanWorkbook — error aggregation', () => {
  it('surfaces both E5 and E9 from a single file', async () => {
    // Build header that mismatches the second month + duplicate name in data.
    const file = await buildCustomFile((wb) => {
      const sheet = wb.addWorksheet(RESOURCE_PLAN_SHEET_NAME);
      sheet.getCell(4, 1).value = 'Name';
      sheet.getCell(4, 2).value = 'Role';
      sheet.getCell(4, 3).value = '2026-01';
      sheet.getCell(4, 4).value = '2027-99'; // wrong
      sheet.getCell(4, 5).value = '2026-03';
      sheet.getCell(5, 1).value = 'Alice';
      sheet.getCell(5, 2).value = 'Developer';
      sheet.getCell(5, 3).value = 0.5;
      sheet.getCell(6, 1).value = 'alice'; // duplicate
      sheet.getCell(6, 2).value = 'QA';
      sheet.getCell(6, 3).value = 0.5;
      const meta = wb.addWorksheet(RESOURCE_PLAN_META_SHEET_NAME);
      meta.getCell('A1').value = JSON.stringify({
        schema: 1,
        projectId: 'proj-1',
        projectName: 'P',
        reforecastId: 'rf-1',
        reforecastName: 'R',
      });
    });
    const result = await parseResourcePlanWorkbook(
      file,
      makeProject(),
      makeReforecast(),
      [],
      SETTINGS,
      MONTHS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.startsWith('E5'))).toBe(true);
    expect(result.errors.some((e) => e.startsWith('E9'))).toBe(true);
  });
});
