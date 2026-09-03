// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Workspace binding utilities for export pipeline diagnostics
import { STORAGE_KEYS } from '@/types/storage';

export const WORKSPACE_ID_KEY = 'msb-workspace-id';
export const CHANGELOG_MAX_ENTRIES = 500;

export interface ChangeLogEntry {
  t: number;       // Unix timestamp (seconds)
  /**
   * ⚠️ 'update' WAS MISSING FROM THIS LIST while two live call sites wrote it —
   * `useTeamPool.archivePoolMember` and `unarchivePoolMember` have both written
   * `{ op: 'update', entity: 'pool-member', id }` since v0.25.0. Corrected 2026-09-03.
   * `op` is a plain string, so nothing was type-checked and nothing reported the gap.
   *
   * ⚠️ AND THOSE TWO ARE INDISTINGUISHABLE FROM EACH OTHER in the exported trail: an
   * archive and an unarchive of the same member produce byte-identical entries. That is
   * a pre-existing defect, recorded here rather than fixed, because changing an op
   * changes what downstream reads of already-exported files mean. It is its own item.
   *
   * The v0.37.9 role-rename entry is deliberately distinguishable from both: it carries
   * `count` and omits `id`, where archive/unarchive carry `id` and omit `count`.
   */
  op: string;      // 'add' | 'delete' | 'update' | 'import' | 'archive' | 'unarchive'
  entity: string;  // 'project' | 'pool-member' | 'reforecast' | 'productivity-window' | 'dataset'
  id?: string;
  count?: number;
  source?: string;
}

export interface ExportAttribution {
  name: string;
  id: string;
}

// Stable per-browser UUID — generated once, persists forever
export function getWorkspaceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(WORKSPACE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(WORKSPACE_ID_KEY, id);
  }
  return id;
}

// Read _originRef from localStorage (may be empty string if never set)
export function getOriginRef(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEYS.originRef) ?? '';
}

// Lazily set _originRef on first structural mutation
export function ensureOriginRef(): string {
  if (typeof window === 'undefined') return '';
  let ref = localStorage.getItem(STORAGE_KEYS.originRef);
  if (!ref) {
    ref = getWorkspaceId();
    localStorage.setItem(STORAGE_KEYS.originRef, ref);
  }
  return ref;
}

// Set _originRef explicitly (used during import to preserve source origin)
export function setOriginRef(ref: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.originRef, ref);
}

// Read changelog from localStorage
export function getChangeLog(): ChangeLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.changeLog);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Set changelog explicitly (used during import)
export function setChangeLog(log: ChangeLogEntry[]): void {
  if (typeof window === 'undefined') return;
  const capped = log.length > CHANGELOG_MAX_ENTRIES
    ? log.slice(log.length - CHANGELOG_MAX_ENTRIES)
    : log;
  localStorage.setItem(STORAGE_KEYS.changeLog, JSON.stringify(capped));
}

// Append entry to changelog (reads current, appends, writes back)
export function appendToChangeLog(entry: Omit<ChangeLogEntry, 't'>): void {
  if (typeof window === 'undefined') return;
  const log = getChangeLog();
  const updated = [...log, { ...entry, t: Math.floor(Date.now() / 1000) }];
  const capped = updated.length > CHANGELOG_MAX_ENTRIES
    ? updated.slice(updated.length - CHANGELOG_MAX_ENTRIES)
    : updated;
  localStorage.setItem(STORAGE_KEYS.changeLog, JSON.stringify(capped));
}

// Read export attribution from localStorage
export function getExportAttribution(): ExportAttribution {
  if (typeof window === 'undefined') return { name: '', id: '' };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.exportAttribution);
    if (!raw) return { name: '', id: '' };
    const parsed = JSON.parse(raw);
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      id: typeof parsed.id === 'string' ? parsed.id : '',
    };
  } catch {
    return { name: '', id: '' };
  }
}

// Save export attribution to localStorage
export function setExportAttribution(attr: ExportAttribution): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.exportAttribution, JSON.stringify(attr));
}
