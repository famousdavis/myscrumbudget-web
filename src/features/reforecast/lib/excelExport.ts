// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import ExcelJS from 'exceljs';
import type { Project, Reforecast, TeamMember } from '@/types/domain';
import type { AllocationMap } from '@/lib/calc/allocationMap';
import { getAllocation } from '@/lib/calc/allocationMap';
import {
  APP_VERSION,
  RESOURCE_PLAN_SHEET_NAME,
  RESOURCE_PLAN_META_SHEET_NAME,
} from '@/lib/constants';

export interface ResourcePlanMeta {
  schema: number;
  appVersion: string;
  projectId: string;
  projectName: string;
  reforecastId: string;
  reforecastName: string;
  generatedAt: string;
}

interface BuildArgs {
  project: Project;
  reforecast: Reforecast;
  members: TeamMember[];
  allocationMap: AllocationMap;
  months: string[];
}

/**
 * Build a Resource Plan workbook for the active reforecast and return it
 * as an .xlsx Blob ready to download. The returned Blob contains:
 *   - Sheet "Resource Plan" — title, metadata, header (row 4), data rows
 *   - Hidden sheet "_msb_meta" — A1 holds JSON identity tuple consumed by import
 */
export async function buildResourcePlanWorkbookBlob(args: BuildArgs): Promise<Blob> {
  const { project, reforecast, members, allocationMap, months } = args;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(RESOURCE_PLAN_SHEET_NAME);

  // Set column widths BEFORE any rows are written. The `columns` setter
  // without `header`/`key` only sizes columns and leaves row 1 untouched
  // for our manual title write.
  sheet.columns = [
    { width: 25 },
    { width: 20 },
    ...months.map(() => ({ width: 11 })),
  ];

  const totalCols = 2 + months.length;
  const lastColLetter = columnLetter(totalCols);

  // Row 1 — title (merged across all columns).
  const titleCell = sheet.getCell('A1');
  titleCell.value = `Resource Plan — ${project.name} — ${reforecast.name}`;
  titleCell.font = { bold: true, size: 14 };
  sheet.mergeCells(`A1:${lastColLetter}1`);

  // Row 2 — metadata (merged).
  const metaCell = sheet.getCell('A2');
  metaCell.value = [
    `Project: ${project.name}`,
    `Reforecast: ${reforecast.name}`,
    `Reforecast Date: ${reforecast.reforecastDate}`,
    `Generated: ${new Date().toISOString()}`,
  ].join(' | ');
  metaCell.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
  sheet.mergeCells(`A2:${lastColLetter}2`);

  // Row 3 — blank (skip).

  // Row 4 — header.
  const headerRow = sheet.getRow(4);
  headerRow.getCell(1).value = 'Name';
  headerRow.getCell(2).value = 'Role';
  months.forEach((m, i) => {
    headerRow.getCell(3 + i).value = m;
  });
  for (let c = 1; c <= totalCols; c++) {
    const cell = headerRow.getCell(c);
    cell.font = { bold: true };
    cell.border = { bottom: { style: 'thin' } };
  }
  headerRow.commit();

  // Rows 5+ — data. Empty allocations are written as 0 (rendered "0%"),
  // never blank — resource managers need to see the cell.
  members.forEach((member, idx) => {
    const row = sheet.getRow(5 + idx);
    row.getCell(1).value = member.name;
    row.getCell(2).value = member.role;
    months.forEach((month, mi) => {
      const value = getAllocation(allocationMap, month, member.id);
      const cell = row.getCell(3 + mi);
      cell.value = value;
      cell.numFmt = '0%';
      // Pale yellow input-cell convention — signals "edit me" to resource
      // managers. ARGB: FF (full alpha) + FFFF99 (RGB).
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF99' },
      };
    });
    row.commit();
  });

  // Freeze header (row 4) and Name/Role columns (cols 1-2).
  sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }];

  // Hidden metadata sheet — JSON in A1, sheet state = veryHidden so it
  // doesn't appear in Excel's Format → Sheet → Unhide list.
  const meta = workbook.addWorksheet(RESOURCE_PLAN_META_SHEET_NAME);
  meta.state = 'veryHidden';
  const metaPayload: ResourcePlanMeta = {
    schema: 1,
    appVersion: APP_VERSION,
    projectId: project.id,
    projectName: project.name,
    reforecastId: reforecast.id,
    reforecastName: reforecast.name,
    generatedAt: new Date().toISOString(),
  };
  meta.getCell('A1').value = JSON.stringify(metaPayload);

  const buf = await workbook.xlsx.writeBuffer();
  // ExcelJS returns a Buffer-like; wrap in BlobPart-compatible array.
  return new Blob([buf as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Convert a 1-based column index to its Excel letter (1 = A, 27 = AA).
 * Used for merge-cell range strings.
 */
function columnLetter(col: number): string {
  let n = col;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
