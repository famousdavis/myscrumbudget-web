// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import {
  doc, getDoc, setDoc, deleteDoc,
  collection, query, where, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { PROJECTS_COL, SETTINGS_COL } from '@/lib/firebase/collections';
import type { Repository } from './repository';
import type { Settings, PoolMember, Project, ProjectColor, AppState } from '@/types/domain';
import { DEFAULT_SETTINGS } from './localStorage';
import { DATA_VERSION } from './migrations';
import type { ChangeLogEntry } from './fingerprint';
import {
  getChangeLog, getExportAttribution,
  setOriginRef, setChangeLog,
} from './fingerprint';
import { buildTeamSnapshot, stripUndefined, docToProject } from './firestoreUtils';
import { getActiveReforecast } from '@/lib/utils/teamResolution';

/** Firestore document shape for projects (extends Project with cloud metadata). */
interface FirestoreProjectDoc {
  name: string;
  startDate: string;
  endDate: string;
  reforecasts: Project['reforecasts'];
  activeReforecastId: string | null;
  /** Dashboard tile tint (v0.33.0). null when cleared (so mergeFields can unset). */
  color: ProjectColor | null;
  /** Project-archiving flag (v0.34.0). null when cleared (so mergeFields can unset). */
  archived: boolean | null;
  owner: string;
  members: Record<string, string>;
  order: number;
  _teamSnapshot: Record<string, { name: string; role: string }>;
  _originRef: string;
  _changeLog: ChangeLogEntry[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

/**
 * Compile-time edge from `Project` to `FirestoreProjectDoc`.
 *
 * `FirestoreProjectDoc` is a hand-maintained duplicate of `Project` plus cloud
 * metadata; nothing in the type system linked the two. Adding a field to
 * `Project` therefore left this doc silently short, and the three write literals
 * still compiled, because they are checked against the duplicate rather than
 * against `Project`.
 *
 * ⚠️ This is a SECOND gate, not the only one. Adding `Project.foo?` already fails
 * `npm run typecheck` at `sanitizeImport.ts`'s `PROJECT_FIELD_SET` (TS2741,
 * naming the field) — measured 2026-08-16. What that error does NOT do is
 * mention Firestore, so a developer can satisfy it and stop, leaving the cloud
 * doc short. This closes that satisfy-and-stop path.
 *
 * ⚠️ THE SHAPE IS LOAD-BEARING; two plausible alternatives were measured and
 * rejected (2026-08-16, by adding `Project.foo?` and reading the diagnostic):
 *
 *   1. `Omit<Project,'id'> & { color: …|null; … }` — the obvious derivation.
 *      Fires TS2322 with a truncated type dump that NEVER NAMES the field.
 *      Also wrong on its own terms: intersecting `color?: ProjectColor` with
 *      `color: ProjectColor|null` yields a required `ProjectColor`, so
 *      `?? null` stops typechecking.
 *   2. The same mapped type WITHOUT `-?`. A mapped type is homomorphic and
 *      PRESERVES OPTIONALITY, so a new OPTIONAL field stays optional here and
 *      omitting it is legal — SILENT. That is a permanent false green for
 *      exactly the case this guard exists for, and it looks stronger than the
 *      form below. Same family as the `ReadonlyArray<keyof T>` trap recorded in
 *      `sanitizeImport.ts`: plausible, and silently weaker.
 *
 * `-?` strips the optionality so every Project field is required here, and
 * mapping each key to ITSELF (`K extends keyof FirestoreProjectDoc ? K : never`)
 * means a new field cannot be waved through with some other valid doc key —
 * `foo: 'name'` is TS2322 `not assignable to type 'never'`. Verbose by design;
 * v0.35.2 took the same trade after rejecting a generic `fieldsOf<T>()` helper
 * that needed an `as unknown as` double cast.
 */
type ProjectKeyCoverage = {
  [K in keyof Omit<Project, 'id'>]-?: K extends keyof FirestoreProjectDoc ? K : never;
};
const _projectKeyCoverage: ProjectKeyCoverage = {
  name: 'name',
  startDate: 'startDate',
  endDate: 'endDate',
  reforecasts: 'reforecasts',
  activeReforecastId: 'activeReforecastId',
  color: 'color',
  archived: 'archived',
};
void _projectKeyCoverage;

/**
 * The fields `saveProject` writes on every save, as a `satisfies`-checked set.
 *
 * Previously an inline `string[]` on the `setDoc` call: unconstrained, so an
 * invalid or stale key was accepted and the field simply never merged.
 * `satisfies` checks every entry against `FirestoreProjectDoc` while keeping the
 * literal key types.
 *
 * ⚠️ `Partial` is deliberate and it bounds what this catches: it rejects a key
 * that is NOT a doc field, and it does NOT require completeness. It cannot,
 * because ownership/identity fields — owner, members, order, createdAt,
 * _originRef, _changeLog, schemaVersion — are excluded ON PURPOSE so existing
 * Firestore values survive a save, which is load-bearing for the v0.30.0 import
 * `replace` path. A newly added Project field is caught by
 * `_projectKeyCoverage` above, which is the prompt to decide whether it also
 * belongs here.
 */
const SAVE_PROJECT_MERGE_SET = {
  name: true,
  startDate: true,
  endDate: true,
  reforecasts: true,
  activeReforecastId: true,
  color: true,
  archived: true,
  _teamSnapshot: true,
  updatedAt: true,
} satisfies Partial<Record<keyof FirestoreProjectDoc, true>>;

const SAVE_PROJECT_MERGE_FIELDS = Object.keys(SAVE_PROJECT_MERGE_SET);

export function createFirestoreRepository(uid: string): Repository {
  if (!db) throw new Error('Firestore is not initialized');

  const settingsRef = doc(db, SETTINGS_COL, uid);

  const repo: Repository = {
    // ── Settings ──
    async getSettings(): Promise<Settings> {
      const snap = await getDoc(settingsRef);
      if (!snap.exists()) return DEFAULT_SETTINGS;
      const data = snap.data();
      // v0.31.0 (K2): schemaVersion migration integration point.
      // Current settings schema is version 2. When a settings-schema bump
      // is needed, branch here on data.schemaVersion (legacy docs predating
      // v0.31.0 have no schemaVersion and should be treated as version 1).
      return {
        discountRateAnnual: data.discountRateAnnual ?? DEFAULT_SETTINGS.discountRateAnnual,
        laborRates: data.laborRates ?? DEFAULT_SETTINGS.laborRates,
        holidays: data.holidays ?? DEFAULT_SETTINGS.holidays,
        trafficLightThresholds: {
          ...DEFAULT_SETTINGS.trafficLightThresholds,
          ...(data.trafficLightThresholds ?? {}),
        },
      };
    },

    async saveSettings(settings: Settings): Promise<void> {
      // v0.31.0 (C1+K2): explicit mergeFields instead of merge:true, and
      // schemaVersion: 2 written so future settings-schema bumps can branch
      // on the stored version in getSettings below.
      await setDoc(settingsRef, stripUndefined({
        discountRateAnnual: settings.discountRateAnnual,
        laborRates: settings.laborRates,
        holidays: settings.holidays,
        trafficLightThresholds: settings.trafficLightThresholds,
        schemaVersion: 2,
      }), { mergeFields: ['discountRateAnnual', 'laborRates', 'holidays',
                          'trafficLightThresholds', 'schemaVersion'] });
    },

    // ── Team Pool (stored in settings doc) ──
    async getTeamPool(): Promise<PoolMember[]> {
      const snap = await getDoc(settingsRef);
      if (!snap.exists()) return [];
      return (snap.data().teamPool as PoolMember[]) ?? [];
    },

    async saveTeamPool(pool: PoolMember[]): Promise<void> {
      // v0.31.0 (C1): explicit mergeFields. Replaces the entire teamPool
      // array (correct behavior — array-element merging is not desired).
      await setDoc(settingsRef, { teamPool: pool }, { mergeFields: ['teamPool'] });
    },

    // ── Projects ──
    async getProjects(): Promise<Project[]> {
      const q = query(
        collection(db!, PROJECTS_COL),
        where(`members.${uid}`, 'in', ['owner', 'editor', 'viewer']),
      );
      const snap = await getDocs(q);
      const projects: (Project & { _order?: number; _memberCount?: number })[] = [];
      snap.forEach((d) => {
        const data = d.data();
        const project = docToProject(d.id, data);
        const proj = project as Project & { _order?: number; _memberCount?: number };
        proj._order = (data.order as number) ?? 0;
        const members = data.members as Record<string, string> | undefined;
        proj._memberCount = members ? Object.keys(members).length : 1;
        projects.push(proj);
      });
      // Sort by order field for drag-to-reorder persistence
      projects.sort((a, b) => (a._order ?? 0) - (b._order ?? 0));
      // Strip _order but keep _memberCount for shared badge.
      return projects.map(({ _order: _stripOrder, ...p }) => {
        void _stripOrder;
        return p as Project;
      });
    },

    async getProject(id: string): Promise<Project | null> {
      const snap = await getDoc(doc(db!, PROJECTS_COL, id));
      if (!snap.exists()) return null;
      return docToProject(snap.id, snap.data());
    },

    /**
     * Save mutable project fields to Firestore via explicit mergeFields (v0.31.0 C1).
     *
     * Fields WRITTEN every save (regenerated from current state):
     *   name, startDate, endDate, reforecasts, activeReforecastId,
     *   color, archived (both coalesced to null when absent so mergeFields
     *   unsets them), _teamSnapshot (regenerated from the calling user's
     *   current team pool), updatedAt
     *
     * Fields INTENTIONALLY EXCLUDED (mergeFields omits them; existing Firestore values kept):
     *   owner, members, order, createdAt, _originRef, _changeLog, schemaVersion
     *   (These live on FirestoreProjectDoc, not on the Project domain type.)
     *
     * The exclusion of createdAt, _originRef, owner, members, and order is
     * load-bearing for the v0.30.0 import 'replace' path: applyImportMerge calls
     * saveProject for 'replace' decisions and relies on merge: true to preserve
     * identity fields from the existing document. Do NOT add any of those fields
     * to this write payload without auditing the import path for regressions.
     *
     * INVESTIGATION FLAG (v0.28.1): both saveProject and createProject below
     * call repo.getTeamPool() through the delegating module, relying on the
     * active repo identity not switching mid-call. Safe today (single-tab,
     * sign-out cleanup cancels in-flight saves). Revisit before introducing
     * any concurrent or cross-tab path that could swap the active repo while
     * a save is awaiting the pool snapshot.
     */
    async saveProject(project: Project): Promise<void> {
      const pool = await repo.getTeamPool();
      const now = new Date().toISOString();

      // v0.31.0 (C1): explicit mergeFields instead of merge:true. The
      // listed fields are the only ones written every save; ownership /
      // identity fields (owner, members, order, createdAt, _originRef,
      // _changeLog, schemaVersion) are intentionally excluded so the
      // existing Firestore values are preserved (load-bearing for the
      // v0.30.0 import 'replace' path — see JSDoc above).
      await setDoc(doc(db!, PROJECTS_COL, project.id), stripUndefined({
        name: project.name,
        startDate: project.startDate,
        endDate: project.endDate,
        reforecasts: project.reforecasts,
        activeReforecastId: project.activeReforecastId,
        // null (not undefined) when cleared so mergeFields actually unsets them.
        color: project.color ?? null,
        archived: project.archived ?? null,
        _teamSnapshot: buildTeamSnapshot(getActiveReforecast(project)?.assignments ?? [], pool),
        updatedAt: now,
      }), { mergeFields: SAVE_PROJECT_MERGE_FIELDS });
    },

    /**
     * Create a new project with ownership fields.
     * Only used for brand-new projects — sets owner and members.
     */
    async createProject(project: Project): Promise<void> {
      const pool = await repo.getTeamPool();
      const now = new Date().toISOString();
      const projects = await repo.getProjects();

      const docData: FirestoreProjectDoc = {
        name: project.name,
        startDate: project.startDate,
        endDate: project.endDate,
        reforecasts: project.reforecasts,
        activeReforecastId: project.activeReforecastId,
        color: project.color ?? null,
        archived: project.archived ?? null,
        owner: uid,
        members: { [uid]: 'owner' },
        order: projects.length,
        _teamSnapshot: buildTeamSnapshot(getActiveReforecast(project)?.assignments ?? [], pool),
        _originRef: uid,
        _changeLog: [],
        createdAt: now,
        updatedAt: now,
        schemaVersion: 2,
      };

      await setDoc(doc(db!, PROJECTS_COL, project.id), stripUndefined(docData));
    },

    async deleteProject(id: string): Promise<void> {
      await deleteDoc(doc(db!, PROJECTS_COL, id));
    },

    async reorderProjects(orderedIds: string[]): Promise<void> {
      const batch = writeBatch(db!);
      orderedIds.forEach((id, index) => {
        batch.update(doc(db!, PROJECTS_COL, id), { order: index });
      });
      await batch.commit();
    },

    // ── Export/Import ──
    async exportAll(): Promise<AppState> {
      const settings = await repo.getSettings();
      const teamPool = await repo.getTeamPool();
      const projects = await repo.getProjects();

      const data: AppState = {
        version: DATA_VERSION,
        msbExportKind: 'dataset',  // discriminant — pitfall #61 gate for future formats
        settings,
        teamPool,
        projects,
        _originRef: uid,
        _storageRef: uid,
        _changeLog: getChangeLog(),
      };

      const attr = getExportAttribution();
      if (attr.name) data._exportedBy = attr.name;
      if (attr.id) data._exportedById = attr.id;

      return data;
    },

    async importAll(state: AppState): Promise<void> {
      // Save settings with merge to preserve cloud-only fields
      await repo.saveSettings(state.settings);
      await repo.saveTeamPool(state.teamPool);

      // Full replace for each project (no merge — import overwrites entirely)
      const pool = state.teamPool;
      const now = new Date().toISOString();

      for (let i = 0; i < state.projects.length; i++) {
        const project = state.projects[i];
        let targetId = project.id;

        // Collision check — try/catch because getDoc on non-existent docs
        // returns PERMISSION_DENIED when rules check resource.data
        try {
          const existing = await getDoc(doc(db!, PROJECTS_COL, targetId));
          if (existing.exists()) {
            const existingData = existing.data();
            // If user is already a member, overwrite. Otherwise, generate new ID.
            if (!existingData.members || !existingData.members[uid]) {
              targetId = crypto.randomUUID();
            }
          }
        } catch {
          // PERMISSION_DENIED = doc doesn't exist or user isn't member. Use new ID.
          targetId = crypto.randomUUID();
        }

        const docData: FirestoreProjectDoc = {
          name: project.name,
          startDate: project.startDate,
          endDate: project.endDate,
          reforecasts: project.reforecasts,
          activeReforecastId: project.activeReforecastId,
          color: project.color ?? null,
          archived: project.archived ?? null,
          owner: uid,
          members: { [uid]: 'owner' },
          order: i,
          _teamSnapshot: buildTeamSnapshot(getActiveReforecast(project)?.assignments ?? [], pool),
          _originRef: state._originRef ?? uid,
          _changeLog: state._changeLog ?? [],
          createdAt: now,
          updatedAt: now,
          schemaVersion: 2,
        };

        // Full setDoc (no merge) for imports — old fields are replaced entirely
        await setDoc(doc(db!, PROJECTS_COL, targetId), stripUndefined(docData));
      }

      // Preserve origin ref from imported file; use UID as fallback
      const importedOrigin = state._originRef;
      const originRef = typeof importedOrigin === 'string' && importedOrigin
        ? importedOrigin
        : uid;
      setOriginRef(originRef);

      // Preserve imported changelog, append import event
      const importedLog: ChangeLogEntry[] = Array.isArray(state._changeLog) ? state._changeLog : [];
      setChangeLog([...importedLog, {
        t: Math.floor(Date.now() / 1000),
        op: 'import',
        entity: 'dataset',
        source: 'file',
      }]);
    },

    async clear(): Promise<void> {
      // Delete all owned projects
      const q = query(
        collection(db!, PROJECTS_COL),
        where('owner', '==', uid),
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db!);
      snap.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();

      // Delete settings doc
      await deleteDoc(settingsRef);
    },

    async getVersion(): Promise<string> {
      return DATA_VERSION;
    },

    async migrateIfNeeded(): Promise<void> {
      // Cloud data schema is always current — migrations happen at the app level
      // before data reaches Firestore. No-op for cloud repo.
    },
  };

  return repo;
}
