// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Project, ProjectPrefsEntry } from '@/types/domain';
import { isProjectColor } from '@/features/projects/lib/projectColors';

/**
 * Per-user project preferences: reading them, and applying them (v0.42.0).
 *
 * Colour, archive state and dashboard order used to live on the shared project
 * document, so one member's choice changed every member's view. They now live in
 * each reader's own settings document, and this module holds the parts that do
 * not touch Firebase: what a stored preference blob means, and what a reader's
 * project list looks like once it is applied.
 *
 * ⚠️ EVERY READ HERE IS TOTAL. Nothing bounds what can land in a settings
 * document — the rules allow the owner to write any shape — and a throw on the
 * read path does not degrade gracefully: `useProjects` catches it, leaves
 * `projects` at `[]`, and the dashboard renders the Getting Started guide to a
 * user who has projects. So an unknown colour, an `archived` that is not `true`,
 * an entry that is not an object, a `projectOrder` that is not an array of
 * strings: each is IGNORED, never thrown, never "repaired".
 */

/** One reader's preferences, validated. */
export interface ReaderPrefs {
  /**
   * Has this reader been seeded?
   *
   * ⚠️ SEEDED IS PERMANENT AND IT IS WHAT THE FEATURE BUYS. Once true, no
   * document `color`/`archived`/`order` is read for this reader again — which is
   * exactly what makes them immune to a pre-release tab, or an editor, still
   * writing those fields to the shared document (the rules still allow it).
   */
  seeded: boolean;
  /** Validated entries, by project id. A Map, so a project id cannot reach `Object.prototype`. */
  entries: Map<string, ProjectPrefsEntry>;
  /** Validated id list, in the reader's order. Ids not in the project list are ignored later. */
  order: string[];
}

export const EMPTY_READER_PREFS: ReaderPrefs = {
  seeded: false,
  entries: new Map(),
  order: [],
};

/**
 * Is this settings document seeded?
 *
 * ⚠️ ONE PREDICATE, USED BY BOTH THE READER AND THE WRITER. If the two ever
 * disagreed, a reader could be treated as unseeded (and shown document values)
 * while every writer believed the seed had happened — the preferences would
 * still be written, and never read.
 *
 * ⚠️ `=== 1`, not "the key is present". 1 is the only value ever written, and
 * the fail-safe direction is to treat anything else as UNSEEDED: that reader
 * sees document values and is re-seeded, which is recoverable. Treating a
 * corrupt marker as seeded would permanently hide values nobody can restore.
 */
export function isSeeded(data: Record<string, unknown> | undefined): boolean {
  return data?.projectPrefsSeed === 1;
}

/** Validate one stored preference entry; returns undefined when it holds nothing usable. */
function readEntry(value: unknown): ProjectPrefsEntry | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const { color, archived } = value as { color?: unknown; archived?: unknown };
  const entry: ProjectPrefsEntry = {};
  if (isProjectColor(color)) entry.color = color;
  // `true` only — `false`, `'yes'`, 1 and null all mean "not archived", the same
  // collapse `docToProject` applies to the document field.
  if (archived === true) entry.archived = true;
  return entry.color || entry.archived ? entry : undefined;
}

/**
 * Read a reader's preferences out of their raw settings document.
 *
 * An absent document, or one with none of the three keys, is simply unseeded.
 */
export function readReaderPrefs(data: Record<string, unknown> | undefined): ReaderPrefs {
  if (!data) return EMPTY_READER_PREFS;
  const entries = new Map<string, ProjectPrefsEntry>();
  const rawPrefs = data.projectPrefs;
  if (typeof rawPrefs === 'object' && rawPrefs !== null && !Array.isArray(rawPrefs)) {
    for (const [id, value] of Object.entries(rawPrefs as Record<string, unknown>)) {
      const entry = readEntry(value);
      // An entry that validates to nothing — including the `{}` a cleared
      // preference leaves behind — is stored as no entry at all, so "cleared"
      // and "never set" read identically.
      if (entry) entries.set(id, entry);
    }
  }
  const rawOrder = data.projectOrder;
  const order = Array.isArray(rawOrder)
    ? rawOrder.filter((id): id is string => typeof id === 'string')
    : [];
  return { seeded: isSeeded(data), entries, order };
}

/**
 * The colour and archive state THIS reader sees for a project.
 *
 * ⚠️ TOTAL REPLACEMENT FOR A SEEDED READER: their entry decides, and no entry
 * means no colour and not archived. The document's own values are not consulted
 * — that is the whole point of the seed, and a `prefs[id] ?? document` fallback
 * would quietly reinstate every defect this release removes.
 */
export function applyPrefsToProject(project: Project, prefs: ReaderPrefs): Project {
  if (!prefs.seeded) return project;
  const entry = prefs.entries.get(project.id);
  const next: Project = { ...project };
  delete next.color;
  delete next.archived;
  if (entry?.color) next.color = entry.color;
  if (entry?.archived) next.archived = true;
  return next;
}

/** One listed project, with the two document values the order rule uses. */
export interface OrderableProject<T> {
  id: string;
  /** The stored `order`, when it is a usable number; null otherwise. */
  order: number | null;
  /** The stored `createdAt`, or '' when it is missing or not a string. */
  createdAt: string;
  value: T;
}

/** The stored `order`, or null when it is absent or unusable (`null`, a string, NaN). */
export function readStoredOrder(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Ascending string compare, written once so the two tie-breaks cannot drift. */
function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compareByDocument<T>(a: OrderableProject<T>, b: OrderableProject<T>): number {
  const aOrdered = a.order !== null;
  const bOrdered = b.order !== null;
  // 2. A document with no usable order sorts AFTER every ordered one. ⚠️ This
  //    deliberately differs from v0.41.0's `?? 0`, which sorted such a document
  //    FIRST: since v0.42.0 every newly created project has no `order`, and a new
  //    project belongs at the end — where `order: projects.length` used to put it.
  if (aOrdered !== bOrdered) return aOrdered ? -1 : 1;
  // 1. Documents with a usable `order`, ascending. Ties by document id — which
  //    is what v0.41.0's stable sort over a document-id-ordered query produced,
  //    so a reader's first seed freezes the order they already saw. Ties are
  //    common: every reader's first project was written with order 0.
  if (aOrdered && bOrdered) {
    return a.order === b.order
      ? compareStrings(a.id, b.id)
      : (a.order as number) - (b.order as number);
  }
  const byCreated = compareStrings(a.createdAt, b.createdAt);
  return byCreated === 0 ? compareStrings(a.id, b.id) : byCreated;
}

/**
 * Order a reader's projects.
 *
 * A seeded reader's `projectOrder` decides, for the ids it lists that are
 * actually present; ids it lists that are not present are ignored (a deleted or
 * un-shared project leaves its id behind, and nothing prunes them). Everything
 * else follows in document order.
 */
export function orderProjects<T>(rows: OrderableProject<T>[], prefs: ReaderPrefs): T[] {
  const byDocument = [...rows].sort(compareByDocument);
  if (!prefs.seeded || prefs.order.length === 0) return byDocument.map((r) => r.value);

  const remaining = new Map(byDocument.map((r) => [r.id, r]));
  const listed: T[] = [];
  for (const id of prefs.order) {
    const row = remaining.get(id);
    if (!row) continue;
    listed.push(row.value);
    remaining.delete(id);
  }
  // `remaining` keeps insertion order, which is document order.
  return [...listed, ...[...remaining.values()].map((r) => r.value)];
}

/**
 * The entries a first seed should write: one per project the reader can
 * currently see that has a colour or is archived.
 *
 * ⚠️ NO EMPTY ENTRIES. A project with neither gets no entry at all, so the
 * stored map stays the size of what the reader actually set rather than the size
 * of their project list.
 */
export function buildSeedEntries(projects: Project[]): Map<string, ProjectPrefsEntry> {
  const entries = new Map<string, ProjectPrefsEntry>();
  for (const project of projects) {
    const entry: ProjectPrefsEntry = {};
    if (project.color) entry.color = project.color;
    if (project.archived === true) entry.archived = true;
    if (entry.color || entry.archived) entries.set(project.id, entry);
  }
  return entries;
}
