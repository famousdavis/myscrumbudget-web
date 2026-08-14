// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import ExcelJS from 'exceljs';
import type {
  Project,
  Reforecast,
  PoolMember,
  Settings,
} from '@/types/domain';
import {
  RESOURCE_PLAN_SHEET_NAME,
  RESOURCE_PLAN_META_SHEET_NAME,
  UNKNOWN_ROLE,
} from '@/lib/constants';

export interface ParsedRow {
  rowIndex: number; // 1-based row number from the worksheet
  name: string;
  role: string;
  allocationsByMonth: Record<string, number>; // YYYY-MM → 0..1
}

export type ImportWarning =
  | {
      code: 'W1';
      memberName: string;
      assignedRole: string;
      fellBackToUnknown: boolean;
    }
  | {
      code: 'W2';
      memberName: string;
      excelRole: string;
      poolRole: string;
    }
  | { code: 'W3'; memberName: string }
  | {
      code: 'W4';
      sourceReforecastName: string;
      activeReforecastName: string;
    }
  | { code: 'W5'; memberName: string; poolMemberId: string };

export interface SourceMeta {
  schema: number;
  appVersion: string;
  projectId: string;
  projectName: string;
  reforecastId: string;
  reforecastName: string;
  generatedAt: string;
}

export type ParseResult =
  | { ok: false; errors: string[] }
  | {
      ok: true;
      rows: ParsedRow[];
      warnings: ImportWarning[];
      sourceMeta: SourceMeta;
    };

const REQUIRED_META_KEYS: (keyof SourceMeta)[] = [
  'schema',
  'projectId',
  'projectName',
  'reforecastId',
  'reforecastName',
];

/**
 * Parse a Resource Plan workbook against the current active reforecast.
 * Returns aggregated hard errors (E1–E9) on failure, or rows + soft
 * warnings (W1–W4) on success. Errors are aggregated, not short-circuit —
 * the user sees every issue at once.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cognitive complexity 55, against a threshold of 15. DECLINED to decompose,
 * v0.36.3 — and the reason is not that decomposition is hard. It is that this
 * function is not yet netted well enough for it to be safe.
 *
 * Measured before deciding, with the pass condition written down first:
 * decompose only if the mutation score clears 70%. It scores 68.10%
 * (111 killed, 32 survived, 20 no-coverage), or 69.85% counting its nested
 * callbacks — below the line under either attribution.
 *
 * ⚠️ Its 87.34% BRANCH COVERAGE does not contradict that; it is simply not
 * evidence about it. Coverage says which lines ran, mutation says whether
 * anything would object if they were wrong, and above the floor the two carry
 * no relation: elsewhere in this repo costs.ts pairs 93.75% coverage with
 * 69.57% mutation, while charterBudget.ts pairs LOWER coverage (76.92%) with a
 * HIGHER score (84.31%). Do not read the coverage figure here as reassurance.
 *
 * Restructuring code whose tests do not pin its behaviour is how a refactor
 * ships a silent change, so the order is: cover first, then revisit this.
 * What to cover, already identified so the next session need not re-derive it:
 *   - 15 ConditionalExpression + 8 EqualityOperator survivors — real logic
 *     mutants, not message-string noise. The tests reach these branches
 *     without distinguishing their conditions.
 *   - 20 no-coverage mutants, at the E5 "Role" header check, the all-blank-row
 *     helper, the W3 "(Unknown)" fallback, and — worth singling out — the E10
 *     name/role length caps. Those caps are SECURITY hardening added in
 *     v0.28.2 and they have never executed once, which is the same shape as
 *     validateHistoricalCostEntry before v0.35.2 netted it.
 *
 * When it is netted, the shape is already priced (npm run cc region mode):
 * meta/E3 cc 9 · header/E5 cc 3 · row parsing cc 17 · W1/W2 cc 14 · W3 cc 7 ·
 * W4 cc 1, leaving this function around 10. Note that lift creates ONE new
 * over-threshold function (row parsing at 17), so it trades a finding rather
 * than removing one and must be justified on readability, not on the count.
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function parseResourcePlanWorkbook(
  file: File,
  project: Project,
  activeReforecast: Reforecast,
  pool: PoolMember[],
  settings: Settings,
  expectedMonths: string[],
): Promise<ParseResult> {
  // ── E1: must be a valid .xlsx ─────────────────────────────────────
  let workbook: ExcelJS.Workbook;
  try {
    const buf = await file.arrayBuffer();
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf);
  } catch {
    return { ok: false, errors: ['E1: file is not a valid .xlsx workbook'] };
  }

  // ── E2: Resource Plan sheet must exist ────────────────────────────
  const sheet = workbook.getWorksheet(RESOURCE_PLAN_SHEET_NAME);
  if (!sheet) {
    return {
      ok: false,
      errors: [`E2: worksheet "${RESOURCE_PLAN_SHEET_NAME}" not found`],
    };
  }

  // ── E3: _msb_meta sheet present and valid JSON with required keys ─
  const metaSheet = workbook.getWorksheet(RESOURCE_PLAN_META_SHEET_NAME);
  if (!metaSheet) {
    return {
      ok: false,
      errors: [
        `E3: this file is not a MyScrumBudget export (missing "${RESOURCE_PLAN_META_SHEET_NAME}" sheet)`,
      ],
    };
  }
  const metaRaw = metaSheet.getCell('A1').value;
  const metaText =
    typeof metaRaw === 'string'
      ? metaRaw
      : metaRaw == null
        ? ''
        : String(metaRaw);
  if (!metaText) {
    return {
      ok: false,
      errors: ['E3: metadata sheet is empty'],
    };
  }
  let sourceMeta: SourceMeta;
  try {
    const parsed = JSON.parse(metaText) as Partial<SourceMeta>;
    for (const key of REQUIRED_META_KEYS) {
      if (parsed[key] === undefined || parsed[key] === null) {
        return {
          ok: false,
          errors: [`E3: metadata is missing required field "${key}"`],
        };
      }
    }
    sourceMeta = {
      schema: parsed.schema as number,
      appVersion: (parsed.appVersion as string) ?? '',
      projectId: parsed.projectId as string,
      projectName: parsed.projectName as string,
      reforecastId: parsed.reforecastId as string,
      reforecastName: parsed.reforecastName as string,
      generatedAt: (parsed.generatedAt as string) ?? '',
    };
  } catch {
    return {
      ok: false,
      errors: ['E3: metadata is not valid JSON'],
    };
  }

  // ── E4: project ID must match the import target (hard error) ──────
  if (sourceMeta.projectId !== project.id) {
    return {
      ok: false,
      errors: [
        `E4: file was exported from project "${sourceMeta.projectName}" but you are importing into "${project.name}"`,
      ],
    };
  }

  // ── E5: header row 4 must match expected months exactly ───────────
  const errors: string[] = [];
  const expectedTotalCols = 2 + expectedMonths.length;
  const headerRow = sheet.getRow(4);
  const nameHeader = cellText(headerRow.getCell(1));
  const roleHeader = cellText(headerRow.getCell(2));
  if (nameHeader !== 'Name') {
    errors.push(`E5: header A4 expected "Name", got "${nameHeader}"`);
  }
  if (roleHeader !== 'Role') {
    errors.push(`E5: header B4 expected "Role", got "${roleHeader}"`);
  }
  expectedMonths.forEach((m, i) => {
    const headerText = cellText(headerRow.getCell(3 + i));
    if (headerText !== m) {
      errors.push(
        `E5: month header column ${3 + i} expected "${m}", got "${headerText}"`,
      );
    }
  });
  // Reject extra columns past the last expected month column.
  const extraCellText = cellText(headerRow.getCell(expectedTotalCols + 1));
  if (extraCellText.length > 0) {
    errors.push(
      `E5: unexpected extra column past month "${expectedMonths[expectedMonths.length - 1]}"`,
    );
  }

  // ── Parse data rows from row 5 onwards ────────────────────────────
  const rows: ParsedRow[] = [];
  const seenNamesLower = new Set<string>();
  const lastRow = Math.max(sheet.actualRowCount, sheet.rowCount);
  for (let r = 5; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const nameRaw = cellText(row.getCell(1)).trim();
    const roleRaw = cellText(row.getCell(2)).trim();

    // Read all expected allocation cells first (we need them for the
    // trailing-blank check).
    const rawCellValues: ExcelJS.CellValue[] = [];
    for (let mi = 0; mi < expectedMonths.length; mi++) {
      rawCellValues.push(row.getCell(3 + mi).value as ExcelJS.CellValue);
    }
    const allCellsBlank =
      nameRaw === '' &&
      roleRaw === '' &&
      rawCellValues.every((v) => v === null || v === undefined || v === '');
    if (allCellsBlank) continue; // trailing-blank tolerance

    // E6: name and role must both be present once we know the row is non-blank.
    if (!nameRaw || !roleRaw) {
      errors.push(`E6: row ${r} is missing Name or Role`);
      continue;
    }

    // E10 (v0.28.2 / L11): bound name and role lengths. Without caps a
    // malicious .xlsx with a multi-MB cell flows through, eventually hits
    // Firestore's 1MB doc limit on save, and produces a cryptic post-save
    // error rather than a clean parse-time rejection. Caps mirror the
    // suite-wide convention (name ≤ 200, role ≤ 100).
    const NAME_MAX = 200;
    const ROLE_MAX = 100;
    if (nameRaw.length > NAME_MAX) {
      errors.push(`E10: row ${r} name exceeds ${NAME_MAX} characters`);
      continue;
    }
    if (roleRaw.length > ROLE_MAX) {
      errors.push(`E10: row ${r} role exceeds ${ROLE_MAX} characters`);
      continue;
    }

    // E9: duplicate names (case-insensitive)
    const nameLower = nameRaw.toLowerCase();
    if (seenNamesLower.has(nameLower)) {
      errors.push(`E9: row ${r} duplicates name "${nameRaw}"`);
      continue;
    }
    seenNamesLower.add(nameLower);

    // Parse allocation cells
    const allocationsByMonth: Record<string, number> = {};
    let rowHasError = false;
    rawCellValues.forEach((raw, mi) => {
      const month = expectedMonths[mi];
      if (raw === null || raw === undefined || raw === '') {
        allocationsByMonth[month] = 0;
        return;
      }
      const numeric = toNumeric(raw);
      if (numeric === null) {
        errors.push(
          `E7: row ${r} column "${month}" is not a number`,
        );
        rowHasError = true;
        return;
      }
      if (numeric < 0 || numeric > 100) {
        errors.push(
          `E8: row ${r} column "${month}" value ${numeric} is outside 0–100`,
        );
        rowHasError = true;
        return;
      }
      // Dual interpretation: 0..1 is decimal, 1..100 is percentage.
      allocationsByMonth[month] =
        numeric <= 1 ? numeric : numeric / 100;
    });
    if (rowHasError) continue;

    rows.push({
      rowIndex: r,
      name: nameRaw,
      role: roleRaw,
      allocationsByMonth,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // ── Warnings ──────────────────────────────────────────────────────
  const warnings: ImportWarning[] = [];

  // Pool index by lowercased name (case-insensitive matching).
  const poolByLower = new Map<string, PoolMember>();
  for (const pm of pool) {
    poolByLower.set(pm.name.toLowerCase(), pm);
  }

  // W1 / W2 — pool reconciliation per row.
  // Track which poolMemberIds are represented in Excel (either matched or new).
  const representedPoolMemberIds = new Set<string>();
  for (const r of rows) {
    const match = poolByLower.get(r.name.toLowerCase());
    if (match) {
      representedPoolMemberIds.add(match.id);
      // W5 — matched member is archived; signal the panel to auto-unarchive.
      // Emitted alongside (not in place of) W2 when the role also differs —
      // both warnings carry independent information for the user.
      if (match.archived === true) {
        warnings.push({
          code: 'W5',
          memberName: match.name,
          poolMemberId: match.id,
        });
      }
      if (match.role !== r.role) {
        warnings.push({
          code: 'W2',
          memberName: match.name,
          excelRole: r.role,
          poolRole: match.role,
        });
      }
    } else {
      const roleMatchesLabor = settings.laborRates.some(
        (lr) => lr.role === r.role,
      );
      const assignedRole = roleMatchesLabor ? r.role : UNKNOWN_ROLE;
      const fellBackToUnknown =
        !roleMatchesLabor && r.role !== UNKNOWN_ROLE;
      warnings.push({
        code: 'W1',
        memberName: r.name,
        assignedRole,
        fellBackToUnknown,
      });
    }
  }

  // W3 — members in active reforecast but absent from Excel.
  const poolById = new Map<string, PoolMember>();
  for (const pm of pool) poolById.set(pm.id, pm);
  for (const a of activeReforecast.assignments) {
    if (!representedPoolMemberIds.has(a.poolMemberId)) {
      const pm = poolById.get(a.poolMemberId);
      const memberName = pm ? pm.name : '(Unknown)';
      warnings.push({ code: 'W3', memberName });
    }
  }

  // W4 — reforecast ID mismatch.
  if (sourceMeta.reforecastId !== activeReforecast.id) {
    warnings.push({
      code: 'W4',
      sourceReforecastName: sourceMeta.reforecastName,
      activeReforecastName: activeReforecast.name,
    });
  }

  return { ok: true, rows, warnings, sourceMeta };
}

/**
 * Read the displayed text of a cell. ExcelJS .text returns `""` for null
 * but propagates rich-text/formula display strings — what users see in Excel.
 */
function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  return cell.text ?? '';
}

/**
 * Coerce an ExcelJS cell value to a finite number, or null if it can't.
 * Handles raw numbers, ExcelJS percentage cells (which return raw 0.75
 * for "75%"), and rejects strings, formula errors, dates, etc.
 */
function toNumeric(v: ExcelJS.CellValue): number | null {
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : null;
  }
  // ExcelJS returns formula results as { formula, result }. Numeric result OK.
  if (
    v &&
    typeof v === 'object' &&
    'result' in v &&
    typeof (v as { result: unknown }).result === 'number'
  ) {
    const n = (v as { result: number }).result;
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
