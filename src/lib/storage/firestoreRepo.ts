import {
  doc, getDoc, setDoc, deleteDoc,
  collection, query, where, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Repository } from './repository';
import type {
  Settings, PoolMember, Project, AppState,
  ProjectAssignment,
} from '@/types/domain';
import { DEFAULT_SETTINGS } from './localStorage';
import { DATA_VERSION } from './migrations';
import type { ChangeLogEntry, ExportAttribution } from './fingerprint';
import {
  getWorkspaceId, getChangeLog, getExportAttribution,
  setOriginRef, setChangeLog,
} from './fingerprint';

const PROJECTS_COL = 'myscrumbudget_projects';
const SETTINGS_COL = 'myscrumbudget_settings';

// Firestore document shape for projects (extends Project with cloud metadata)
interface FirestoreProjectDoc {
  // Core project fields
  name: string;
  startDate: string;
  endDate: string;
  assignments: ProjectAssignment[];
  reforecasts: unknown[]; // stored as-is, Reforecast[]
  activeReforecastId: string | null;

  // Cloud metadata
  owner: string;
  members: Record<string, string>; // { [uid]: 'owner' | 'editor' | 'viewer' }
  order: number;
  _teamSnapshot: Record<string, { name: string; role: string }>;
  _originRef: string;
  _changeLog: ChangeLogEntry[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

/**
 * Build a team snapshot mapping poolMemberIds to their name/role.
 * Embedded in Firestore project docs so shared viewers can see team info.
 */
function buildTeamSnapshot(
  assignments: ProjectAssignment[],
  pool: PoolMember[],
): Record<string, { name: string; role: string }> {
  const snapshot: Record<string, { name: string; role: string }> = {};
  const poolMap = new Map(pool.map((m) => [m.id, m]));
  assignments.forEach((a) => {
    const pm = poolMap.get(a.poolMemberId);
    if (pm) snapshot[a.poolMemberId] = { name: pm.name, role: pm.role };
  });
  return snapshot;
}

/**
 * Strip undefined values from an object for Firestore compatibility.
 * Firestore rejects explicit undefined — omit those fields entirely.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as Record<string, unknown>;
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) {
      result[key] = value;
    }
  });
  return result as T;
}

/**
 * Convert a Firestore document to a Project domain object.
 */
function docToProject(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    name: (data.name as string) ?? '',
    startDate: (data.startDate as string) ?? '',
    endDate: (data.endDate as string) ?? '',
    assignments: (data.assignments as ProjectAssignment[]) ?? [],
    reforecasts: (data.reforecasts as Project['reforecasts']) ?? [],
    activeReforecastId: (data.activeReforecastId as string | null) ?? null,
  };
}

export function createFirestoreRepository(uid: string): Repository {
  if (!db) throw new Error('Firestore is not initialized');

  const settingsRef = doc(db, SETTINGS_COL, uid);

  const repo: Repository = {
    // ── Settings ──
    async getSettings(): Promise<Settings> {
      const snap = await getDoc(settingsRef);
      if (!snap.exists()) return DEFAULT_SETTINGS;
      const data = snap.data();
      return {
        discountRateAnnual: data.discountRateAnnual ?? DEFAULT_SETTINGS.discountRateAnnual,
        laborRates: data.laborRates ?? DEFAULT_SETTINGS.laborRates,
        holidays: data.holidays ?? DEFAULT_SETTINGS.holidays,
        trafficLightThresholds: data.trafficLightThresholds ?? DEFAULT_SETTINGS.trafficLightThresholds,
      };
    },

    async saveSettings(settings: Settings): Promise<void> {
      await setDoc(settingsRef, stripUndefined({
        discountRateAnnual: settings.discountRateAnnual,
        laborRates: settings.laborRates,
        holidays: settings.holidays,
        trafficLightThresholds: settings.trafficLightThresholds,
      }), { merge: true });
    },

    // ── Team Pool (stored in settings doc) ──
    async getTeamPool(): Promise<PoolMember[]> {
      const snap = await getDoc(settingsRef);
      if (!snap.exists()) return [];
      return (snap.data().teamPool as PoolMember[]) ?? [];
    },

    async saveTeamPool(pool: PoolMember[]): Promise<void> {
      await setDoc(settingsRef, { teamPool: pool }, { merge: true });
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
      // Strip _order but keep _memberCount for shared badge
      return projects.map(({ _order, ...p }) => p as Project);
    },

    async getProject(id: string): Promise<Project | null> {
      const snap = await getDoc(doc(db!, PROJECTS_COL, id));
      if (!snap.exists()) return null;
      return docToProject(snap.id, snap.data());
    },

    /**
     * Save project data to Firestore.
     * Uses merge:true and NEVER touches owner/members fields.
     * This prevents editors from accidentally overwriting ownership.
     */
    async saveProject(project: Project): Promise<void> {
      const pool = await repo.getTeamPool();
      const now = new Date().toISOString();

      await setDoc(doc(db!, PROJECTS_COL, project.id), stripUndefined({
        name: project.name,
        startDate: project.startDate,
        endDate: project.endDate,
        assignments: project.assignments,
        reforecasts: project.reforecasts,
        activeReforecastId: project.activeReforecastId,
        _teamSnapshot: buildTeamSnapshot(project.assignments, pool),
        updatedAt: now,
      }), { merge: true });
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
        assignments: project.assignments,
        reforecasts: project.reforecasts as unknown[],
        activeReforecastId: project.activeReforecastId,
        owner: uid,
        members: { [uid]: 'owner' },
        order: projects.length,
        _teamSnapshot: buildTeamSnapshot(project.assignments, pool),
        _originRef: uid,
        _changeLog: [],
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      };

      await setDoc(doc(db!, PROJECTS_COL, project.id), stripUndefined(docData as unknown as Record<string, unknown>));
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
          assignments: project.assignments,
          reforecasts: project.reforecasts as unknown[],
          activeReforecastId: project.activeReforecastId,
          owner: uid,
          members: { [uid]: 'owner' },
          order: i,
          _teamSnapshot: buildTeamSnapshot(project.assignments, pool),
          _originRef: state._originRef ?? uid,
          _changeLog: state._changeLog ?? [],
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        };

        // Full setDoc (no merge) for imports — old fields are replaced entirely
        await setDoc(doc(db!, PROJECTS_COL, targetId), stripUndefined(docData as unknown as Record<string, unknown>));
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
