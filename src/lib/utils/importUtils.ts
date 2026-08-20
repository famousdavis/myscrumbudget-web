// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { AppState, Project, PoolMember } from '@/types/domain';
import type { StorageMode } from '@/lib/storage/storageMode';
import type { Repository } from '@/lib/storage/repository';
import { generateId } from '@/lib/utils/id';
import { appendToChangeLog } from '@/lib/storage/fingerprint';
import { cloudSyncBus } from '@/lib/firebase/cloudSyncBus';

export type ImportDecision = 'add' | 'skip' | 'replace';
export type SettingsDecision = 'keep' | 'replace';
export type TeamPoolDecision = 'keep' | 'merge' | 'replace';

export interface ConflictReason {
  type: 'id' | 'name';
  existingId: string;
  existingName: string;
  /**
   * Whether the EXISTING (conflicting) project is itself archived. Surfaced in
   * the import preview so a "conflict with X" where X is hidden from the grid
   * doesn't read as data silently vanishing (v0.34.0).
   */
  existingArchived?: boolean;
}

export interface MergePreview {
  incomingState: AppState;       // de-duped; first occurrence of each ID kept
  existingProjects: Project[];   // Layer 1 snapshot — frozen at parse time
  decisions: Record<string, ImportDecision>;
  conflicts: Record<string, ConflictReason>;
  settingsDecision: SettingsDecision;
  teamPoolDecision: TeamPoolDecision;
  mode: StorageMode;
  /**
   * Count of incoming projects dropped before conflict detection because their
   * ID appeared more than once in the import file. Shown as a notice in the
   * preview UI. Not included in skippedCount (they never reach apply).
   */
  duplicatesDropped: number;
}

export interface ImportMergeResult {
  addedCount: number;
  replacedCount: number;
  skippedCount: number;
  errorCount: number;
  errorMessages: string[];
}

export type ImportPhase =
  | { phase: 'idle' }
  | { phase: 'preview'; preview: MergePreview }
  | { phase: 'applying' }           // carries nothing — pitfall #70
  | { phase: 'banner'; result: ImportMergeResult };

/**
 * Normalize a project name for conflict detection.
 * Applied identically in detectConflicts AND Layer 2 re-read lookup — pitfall #2.
 */
export function normalizeProjectName(name: string): string {
  return name.trim().toLowerCase().normalize('NFC');
}

/**
 * Detect ID and name conflicts between incoming and existing projects.
 *
 * Defaults:
 *   - ID conflict   → 'skip'
 *   - Name conflict → 'skip'
 *   - No conflict   → 'add'
 *
 * 'replace' is NEVER a default — it requires explicit user choice.
 * Empty/whitespace project names are excluded from name matching.
 */
export function detectConflicts(
  incoming: Project[],
  existing: Project[],
): {
  decisions: Record<string, ImportDecision>;
  conflicts: Record<string, ConflictReason>;
} {
  const decisions: Record<string, ImportDecision> = {};
  const conflicts: Record<string, ConflictReason> = {};

  const existingById = new Map(existing.map((p) => [p.id, p]));
  const existingByName = new Map(
    existing
      .filter((p) => p.name.trim().length > 0)
      .map((p) => [normalizeProjectName(p.name), p]),
  );

  for (const project of incoming) {
    const idMatch = existingById.get(project.id);
    if (idMatch) {
      decisions[project.id] = 'skip';
      conflicts[project.id] = {
        type: 'id',
        existingId: idMatch.id,
        existingName: idMatch.name,
        existingArchived: idMatch.archived,
      };
      continue;
    }

    const nameMatch =
      project.name.trim().length > 0
        ? existingByName.get(normalizeProjectName(project.name))
        : undefined;
    if (nameMatch) {
      decisions[project.id] = 'skip';
      conflicts[project.id] = {
        type: 'name',
        existingId: nameMatch.id,
        existingName: nameMatch.name,
        existingArchived: nameMatch.archived,
      };
      continue;
    }

    decisions[project.id] = 'add';
  }

  return { decisions, conflicts };
}

/**
 * Build the MergePreview from a parsed, validated, sanitized AppState.
 *
 * Duplicate incoming IDs: first occurrence kept; subsequent dropped and counted
 * in duplicatesDropped. Duplicates are NOT shown as rows in the preview and
 * are NOT counted in skippedCount — they simply do not exist in the de-duped
 * incomingState.projects array.
 */
export function buildMergePreview(
  incomingState: AppState,
  existingProjects: Project[],
  mode: StorageMode,
): MergePreview {
  const seenIds = new Set<string>();
  const dedupedProjects: Project[] = [];
  let duplicatesDropped = 0;
  for (const p of incomingState.projects) {
    if (seenIds.has(p.id)) {
      duplicatesDropped++;
    } else {
      seenIds.add(p.id);
      dedupedProjects.push(p);
    }
  }
  const deduped: AppState = { ...incomingState, projects: dedupedProjects };

  const { decisions, conflicts } = detectConflicts(deduped.projects, existingProjects);

  return {
    incomingState: deduped,
    existingProjects,
    decisions,
    conflicts,
    settingsDecision: 'keep',
    teamPoolDecision: 'merge',
    mode,
    duplicatesDropped,
  };
}

/**
 * Merge the team pool: add incoming members not already in the pool (by ID).
 * Existing members with the same ID are NOT overwritten — their name/role
 * may have been customized locally since the export was taken.
 * Use 'replace' decision for full override.
 */
export function mergeTeamPool(
  existing: PoolMember[],
  incoming: PoolMember[],
): PoolMember[] {
  const existingIds = new Set(existing.map((m) => m.id));
  return [...existing, ...incoming.filter((m) => !existingIds.has(m.id))];
}

/**
 * Build banner text from an ImportMergeResult.
 * Non-zero counts only. All-skip / all-keep produces "nothing applied".
 * Pitfalls #18 and #71.
 */
export function buildBannerText(result: ImportMergeResult): string {
  const parts: string[] = [];
  if (result.addedCount > 0) parts.push(`${result.addedCount} added`);
  if (result.replacedCount > 0) parts.push(`${result.replacedCount} replaced`);
  if (result.skippedCount > 0) parts.push(`${result.skippedCount} skipped`);
  return `Import complete: ${parts.length > 0 ? parts.join(', ') : 'nothing applied'}.`;
}

/**
 * Apply the import merge to storage.
 *
 * WRITE ORDER: teamPool → settings → projects.
 * Rationale: in cloud mode, createProject and saveProject each read the pool
 * back through the Firestore repository's OWN getTeamPool to build _teamSnapshot
 * for the Firestore
 * project document. If teamPool is replaced after projects are written, every
 * new/replaced project document snapshots the pre-import pool, causing stale
 * team-member display until the next manual save. Processing teamPool first
 * ensures all project writes use the final pool state.
 *
 * Layer 2 stale-data guard: always re-reads repository.getProjects() at apply time.
 * The Layer 1 snapshot (MergePreview.existingProjects) was taken at parse time.
 * Note: in cloud mode this reads from the Firestore snapshot listener cache,
 * not necessarily a network round-trip. It is more current than Layer 1 but
 * not a guaranteed just-committed read. Accepted limitation.
 *
 * Cloud hydration race: if both Layer 1 and Layer 2 reads occur before Firestore
 * hydrates (user enables cloud mode and immediately imports), both return empty
 * and all decisions default to 'add', potentially creating duplicates. This
 * window is bounded by Firestore hydration latency. The CHANGELOG documents this.
 * The invitation-landing sign-in path (useInvitationLanding — no page reload on
 * mode flip) is the highest-risk window. The preview UI shows a hint when cloud
 * mode is active and existingProjects is empty.
 *
 * cloudSyncBus race: a 'projects' event from another tab during the apply loop
 * triggers useProjects.reload() mid-import. Each awaited write is atomic at the
 * adapter level — visual re-render does not affect write correctness.
 *
 * Sign-out mid-apply: the repository is a PARAMETER, captured for the duration
 * of this call, so a sign-out cannot swap the store out from under a half-applied
 * import (v0.37.0 — before that it could, because the store was a module global
 * that performSignOutCleanup reset to localStorage). In-flight writes complete or
 * fail at the transport level against the store they started on. The result
 * reflects actual completed writes. Sign-out still implies abandonment of
 * in-flight work; it no longer implies redirected writes.
 *
 * Sequential writes (not Promise.allSettled): required because
 * firestoreRepo.createProject reads its own getProjects() to assign display order.
 * Parallel creates would assign identical order values.
 *
 * Cloud 'add': generates a new Project.id via generateId() to avoid Firestore
 * collision with another workspace's document (unreadable due to security rules).
 * Internal IDs (Reforecast.id, Assignment.id, Allocation.memberId) are NOT
 * regenerated — they are document-internal references with no cross-document
 * addressing in MSB's data model. Pitfall #3 does not apply here.
 *
 * 'replace' uses repository.saveProject, which calls setDoc with merge: true.
 * In cloud mode, Firestore fields NOT written by saveProject (owner, members,
 * order, createdAt, _originRef, _changeLog, schemaVersion — these live on the
 * internal FirestoreProjectDoc, not on the Project domain type) are preserved
 * by merge: true automatically. No runTransaction is needed because saveProject
 * has no read step. Pitfall #63 does not apply.
 * NOTE: _teamSnapshot IS written by saveProject (regenerated from current pool).
 *
 * appendToChangeLog writes to the workspace-level localStorage key
 * (STORAGE_KEYS.changeLog via fingerprint.ts). This is intentional and
 * consistent with how firestoreRepo.importAll handles it — the per-document
 * Firestore _changeLog is separate and not updated here.
 */
/*
 * ───────────────────────────────────────────────────────────────────────────
 * Cognitive complexity 69 — the highest in the repo, against a threshold of 15.
 * DECOMPOSITION DECLINED, v0.36.6. Note this declines for the OPPOSITE reason to
 * parseResourcePlanWorkbook: that one is not netted well enough to restructure
 * safely, whereas this one IS. Here it is the decomposition itself that does not
 * pay.
 *
 * Evidence, measured at v0.36.6 (`npm run mutate -- --mutate
 * 'src/lib/utils/importUtils.ts'`, then survivors classified by enclosing
 * function): mutation score 85.15%, 86 killed / 15 survived / 0 no-coverage,
 * against a pass condition fixed beforehand of ≥85% netted · 70–84% cover first
 * · <70% not netted. So restructuring would be SAFE — the tests would object to a
 * behaviour change made while moving code.
 *
 * ⚠️ That verdict sits one mutant above its own bar (a single further survivor
 * gives 84.31%). It does not matter here, because the decision is made by the
 * second gate, not the first — but do not quote 85.15% as comfortable.
 *
 * The second gate is what declines it: a decomposition is only worth adopting if
 * it reduces the number of over-threshold functions. Every available shape fails
 * that (`npm run cc <file> <start>-<end>`, regions named rather than numbered
 * because line numbers move):
 *
 *   team-pool block   cc 12     settings block   cc  6     fresh-read block cc 0
 *   PROJECTS LOOP     cc 48     changelog block  cc  1     notify block     cc 2
 *
 * Lifting all six leaves this function near zero and creates a cc 48 function —
 * one finding replaced by one barely-smaller finding. Going inside the loop does
 * not rescue it either: the target-resolution section alone prices at cc 18, and
 * is still over.
 *
 * ⚠️ And the loop is not a pure move in any case. It uses FIVE `continue`
 * statements to mean "fall back to add", so any extraction has to re-encode that
 * control flow as a return value — a behaviour-preserving rewrite, not a lift.
 * That is precisely the kind of change the 85.15% makes safe to attempt and the
 * cc numbers say is not worth attempting.
 *
 * Worth covering before any future revisit — the survivors are concentrated, not
 * scattered: 6 ConditionalExpression (the decision and conflict-type branches at
 * the top of the loop), the `p.name.trim().length > 0` filter guarding the
 * name index, and the changelog gate's `addedCount + replacedCount > 0`.
 * ───────────────────────────────────────────────────────────────────────────
 */
export async function applyImportMerge(
  preview: MergePreview,
  repository: Repository,
): Promise<ImportMergeResult> {
  const {
    incomingState,
    decisions,
    conflicts,
    settingsDecision,
    teamPoolDecision,
    mode,
  } = preview;

  let addedCount = 0;
  let replacedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  // ── 1. TeamPool (FIRST — project writes need the updated pool for _teamSnapshot) ──
  let teamPoolWritten = false;
  if (teamPoolDecision === 'replace') {
    try {
      await repository.saveTeamPool(incomingState.teamPool);
      teamPoolWritten = true;
    } catch (err) {
      errorCount++;
      errorMessages.push(
        `Team pool: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  } else if (teamPoolDecision === 'merge') {
    try {
      const currentPool = await repository.getTeamPool();
      await repository.saveTeamPool(mergeTeamPool(currentPool, incomingState.teamPool));
      teamPoolWritten = true;
    } catch (err) {
      errorCount++;
      errorMessages.push(
        `Team pool merge: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  // ── 2. Settings ──
  let settingsWritten = false;
  if (settingsDecision === 'replace') {
    try {
      await repository.saveSettings(incomingState.settings);
      settingsWritten = true;
    } catch (err) {
      errorCount++;
      errorMessages.push(
        `Settings: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  // ── 3. Projects (Layer 2 fresh read for stale-data guard) ──
  const freshExisting = await repository.getProjects();
  const freshById = new Map(freshExisting.map((p) => [p.id, p]));
  const freshByName = new Map(
    freshExisting
      .filter((p) => p.name.trim().length > 0)
      .map((p) => [normalizeProjectName(p.name), p]),
  );

  for (const project of incomingState.projects) {
    const decision = decisions[project.id] ?? 'skip';
    if (decision === 'skip') {
      skippedCount++;
      continue;
    }

    try {
      if (decision === 'add') {
        // Cloud: generate new Project.id to avoid Firestore collision.
        // Local: keep original ID for round-trip fidelity.
        const targetProject: Project =
          mode === 'cloud' ? { ...project, id: generateId() } : project;
        await repository.createProject(targetProject);
        addedCount++;
      } else {
        // decision === 'replace'
        const conflict = conflicts[project.id];
        let existingId: string;

        if (conflict?.type === 'id') {
          existingId = project.id;
        } else if (conflict?.type === 'name') {
          const freshNameMatch = freshByName.get(normalizeProjectName(project.name));
          if (!freshNameMatch) {
            // Name no longer conflicts at Layer 2 — target was deleted or renamed.
            // Fall back to 'add'.
            const targetProject: Project =
              mode === 'cloud' ? { ...project, id: generateId() } : project;
            await repository.createProject(targetProject);
            addedCount++;
            continue;
          }
          if (freshNameMatch.id !== conflict.existingId) {
            // A DIFFERENT project now holds this name (original target was renamed
            // and a new project took the name, or original was deleted and replaced).
            // Silently replacing the new project would clobber unrelated data.
            // Fall back to 'add' instead.
            const targetProject: Project =
              mode === 'cloud' ? { ...project, id: generateId() } : project;
            await repository.createProject(targetProject);
            addedCount++;
            continue;
          }
          existingId = freshNameMatch.id; // same project, safe to replace
        } else {
          // 'replace' with no recorded conflict — defensive; treat as 'add'.
          const targetProject: Project =
            mode === 'cloud' ? { ...project, id: generateId() } : project;
          await repository.createProject(targetProject);
          addedCount++;
          continue;
        }

        // If the target was deleted between Layer 1 and Layer 2, fall back to 'add'.
        // saveProject merge:true on a non-existent cloud doc would create a document
        // lacking owner/members, which Firestore rules would reject.
        if (!freshById.has(existingId)) {
          const targetProject: Project =
            mode === 'cloud'
              ? { ...project, id: generateId() }
              : { ...project, id: existingId };
          await repository.createProject(targetProject);
          addedCount++;
          continue;
        }

        // repository.saveProject: setDoc with merge:true. Preserves Firestore-side
        // identity fields (owner, members, order, createdAt, _originRef, etc.)
        // that live on FirestoreProjectDoc but are absent from the Project domain type.
        // _teamSnapshot is regenerated (written) from the current pool.
        await repository.saveProject({ ...project, id: existingId });
        replacedCount++;
      }
    } catch (err) {
      errorCount++;
      errorMessages.push(
        `"${project.name}": ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  // ── 4. Changelog ──
  // Gate: log only when at least one write succeeded (pitfall #46).
  // Named success flags — not arithmetic — to include all write types correctly.
  // appendToChangeLog writes to workspace-level localStorage (fingerprint.ts),
  // consistent with firestoreRepo.importAll. Per-document Firestore _changeLog
  // is not updated here.
  if (addedCount + replacedCount > 0 || settingsWritten || teamPoolWritten) {
    appendToChangeLog({
      op: 'import',
      entity: 'dataset',
      source: 'file',
      count: addedCount + replacedCount,
    });
  }

  // ── 5. Notify consumers ──
  // Always emit 'projects' — reflects both our writes and any concurrent external
  // changes that arrived during the apply window. Intentional even for all-skip.
  cloudSyncBus.emit('projects');
  if (settingsWritten) cloudSyncBus.emit('settings');
  if (teamPoolWritten) cloudSyncBus.emit('teamPool');

  return { addedCount, replacedCount, skippedCount, errorCount, errorMessages };
}
