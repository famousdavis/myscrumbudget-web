// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * What the cloud read path set aside while loading a project (v0.44.6).
 *
 * A project document can be written by any member of the project, so
 * `docToProject` checks the shapes it depends on and sets aside what it cannot
 * use instead of throwing — one bad document must not empty the project list.
 * Each rule is logged once per read as a short identifier, never with the
 * project's id or the offending value. The project page takes the notes for the
 * project it opens and tells the user.
 *
 * ⚠️ Every rule here must reject only values no version of the app writes.
 * The next save of the project writes the set-aside value away, which repairs
 * the document; on a value the app CAN write it would lose data instead.
 */
const notes = new Map<string, Set<string>>();

export type CloudLoadRule =
  | 'project-name-not-text'
  | 'project-dates-not-text'
  | 'active-reforecast-id-not-text'
  | 'reforecasts-not-a-list'
  | 'reforecast-not-an-object'
  | 'legacy-assignments-not-a-list'
  | 'project-document-unreadable';

/** Record that a rule set something aside in this project, and log the rule. */
export function noteCloudLoadIssue(projectId: string, rule: CloudLoadRule): void {
  console.warn(`[cloud-load-guard] ${rule}`);
  const rules = notes.get(projectId) ?? new Set<string>();
  rules.add(rule);
  notes.set(projectId, rules);
}

/** The rules noted for this project since the last call, and clear them. */
export function takeCloudLoadIssues(projectId: string): string[] {
  const rules = notes.get(projectId);
  notes.delete(projectId);
  return rules ? [...rules] : [];
}
