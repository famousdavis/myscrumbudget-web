// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Repository } from './repository';
import type { Settings, Project, AppState } from '@/types/domain';
import { STORAGE_KEYS } from '@/types/storage';
import { runMigrations, DATA_VERSION } from './migrations';
import { isValidSettings, isValidProjectEntry, isValidPoolMemberEntry } from '@/lib/utils/validation';
import {
  ensureOriginRef, getWorkspaceId, getChangeLog, getExportAttribution,
  setOriginRef, setChangeLog, type ChangeLogEntry,
} from './fingerprint';

export const DEFAULT_SETTINGS: Settings = {
  discountRateAnnual: 0.03,
  laborRates: [
    { role: 'BA', hourlyRate: 75 },
    { role: 'IT-SoftEng', hourlyRate: 100 },
    { role: 'IT-Security', hourlyRate: 90 },
    { role: 'IT-DevOps', hourlyRate: 80 },
    { role: 'Manager', hourlyRate: 150 },
    { role: 'PMO', hourlyRate: 120 },
  ],
  holidays: [],
  trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
};

/**
 * Custom error class for storage quota exceeded
 */
export class StorageQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

/**
 * Custom error class for storage that cannot be read at all
 *
 * ⚠️ v0.38.0. Raised ONLY when a key holds a value with nothing salvageable in
 * it — unparseable text, or a value that is not the array it must be. It is NOT
 * raised for an absent key or for element-level damage; see readEntries.
 *
 * The point of a distinct class is that `migrateIfNeeded` must swallow THIS and
 * nothing else. Catching every Error there would also swallow a genuine
 * migration bug, which today surfaces (badly, but visibly) as a blank page.
 */
export class StorageIntegrityError extends Error {
  readonly key: string;
  constructor(key: string, detail: string) {
    super(
      `Stored data under "${key}" could not be read (${detail}). ` +
      'Your existing data has been left untouched rather than overwritten.',
    );
    this.name = 'StorageIntegrityError';
    this.key = key;
  }
}

/**
 * Turn a caught storage error into something worth showing a user.
 *
 * ⚠️ Exists because the existing handlers all say "Please check your
 * connection." That was fine when the only ways a repository call could fail
 * were network and permission. It is actively misleading for a local-storage
 * integrity failure — it points the user at the one thing that is definitely
 * not the problem, on every 500 ms debounce. Every caller keeps its own
 * connection wording as the fallback; only the integrity case is reworded.
 *
 * ⚠️ The message deliberately does NOT name the storage key. `err.key` is there
 * for the console; a user reading a toast cannot act on `msb:projects`, and
 * what they can act on — nothing was lost, and an import restores it — is what
 * the sentence says instead.
 */
export function describeStorageError(err: unknown, fallback: string): string {
  if (err instanceof StorageIntegrityError) {
    return 'Some of your stored data could not be read, so nothing was changed. ' +
      'Your existing data is intact. Importing a previous export will restore it.';
  }
  return fallback;
}

/**
 * Read from localStorage with optional type validation
 * Returns fallback if key not found, parse fails, or validation fails
 *
 * ⚠️ Still the reader for keys with no salvageable structure (the version
 * string). The three top-level DATA keys no longer come through here — see
 * readEntries and getSettings.
 */
function get<T>(key: string, fallback: T, validator?: (val: unknown) => val is T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const data = localStorage.getItem(key);
    if (!data) return fallback;

    const parsed = JSON.parse(data);

    // If validator provided, check type at runtime
    if (validator && !validator(parsed)) {
      console.warn(`[storage] Type validation failed for "${key}", using fallback`);
      return fallback;
    }

    return parsed as T;
  } catch (e) {
    console.warn(`[storage] Failed to read "${key}":`, e);
    return fallback;
  }
}

/**
 * Parse a key into its three genuinely distinct states.
 *
 * ⚠️⚠️ THE ORDER OF THESE CHECKS IS THE WHOLE OF ACCEPTANCE CRITERION 4, AND IT
 * IS WHY FIRST RUN STILL WORKS. An ABSENT key is not a failure — it is first
 * run, and it must short-circuit BEFORE the parse. Measured 2026-09-06 across
 * six fixtures: absent and a stored `"[]"` both come back clean, while a bad
 * element, unparseable text and a non-array all come back as failures.
 *
 * ⚠️ Note the second one especially: a stored `"[]"` is CLEAN, because
 * `[].every(...)` is vacuously true. So "the read returned nothing" and "the
 * read failed" were never the same condition — which means no shape has to
 * trade criterion 4 against criteria 1-3. DO NOT reintroduce an inference from
 * the returned VALUE (`length === 0`); that is the one mistake that would break
 * first run, and `signOutCleanup.ts:196` is what it looks like when shipped.
 */
type RawRead =
  | { state: 'absent' }
  | { state: 'value'; value: unknown }
  | { state: 'unparseable' };

function readRaw(key: string): RawRead {
  if (typeof window === 'undefined') return { state: 'absent' };
  let data: string | null;
  try {
    data = localStorage.getItem(key);
  } catch {
    // SecurityError — storage is walled off entirely. Indistinguishable from
    // first run from here, and treating it as first run is the non-destructive
    // reading: nothing is claimed to exist, so nothing is claimed to be lost.
    return { state: 'absent' };
  }
  if (!data) return { state: 'absent' };
  try {
    return { state: 'value', value: JSON.parse(data) };
  } catch {
    return { state: 'unparseable' };
  }
}

/**
 * Read an array key, salvaging what is readable and setting aside what is not.
 *
 * `entries` are the elements the caller may use. `residue` holds every element
 * that failed the shape check, in its stored relative order, as an opaque
 * value — it is never inspected and never handed out.
 *
 * ⚠️ Throws StorageIntegrityError when there is nothing to salvage (unparseable
 * text, or a value that is not an array). That is deliberate and it is what
 * protects `signOutCleanup.ts:196`: that guard reads projects and clears the
 * local keys when it sees `length === 0`. A throw sends it into its own
 * existing catch, which keeps the local data — so v0.37.11's guard works
 * against corrupt storage without needing to know this failure exists.
 */
function readEntries<T>(
  key: string,
  isEntry: (v: unknown) => v is T,
): { entries: T[]; residue: unknown[] } {
  const raw = readRaw(key);
  if (raw.state === 'absent') return { entries: [], residue: [] };
  if (raw.state === 'unparseable') throw new StorageIntegrityError(key, 'not valid JSON');
  if (!Array.isArray(raw.value)) {
    throw new StorageIntegrityError(key, `expected an array, found ${typeof raw.value}`);
  }

  const entries: T[] = [];
  const residue: unknown[] = [];
  for (const element of raw.value) {
    if (isEntry(element)) entries.push(element);
    else residue.push(element);
  }
  if (residue.length > 0) {
    console.warn(
      `[storage] ${residue.length} unreadable entr${residue.length === 1 ? 'y' : 'ies'} in ` +
      `"${key}" set aside; they are preserved and will not be overwritten.`,
    );
  }
  return { entries, residue };
}

/**
 * Write an array key, carrying the unreadable elements through untouched.
 *
 * ⚠️⚠️ THIS IS THE DIFFERENCE BETWEEN THIS RELEASE AND A ONE-LINE `.filter()`,
 * and it is the whole of acceptance criterion 8. Filtering the read alone still
 * loses the data — the very next write persists the filtered array and commits
 * the loss permanently. Measured 2026-09-06: a filter-only shape passes
 * criteria 1, 2 and 3 (the OTHER projects do survive) and leaves the malformed
 * element gone after all three mutations. Only carrying it forward preserves it.
 *
 * ⚠️ Residue FOLLOWS the written entries, keeping its own relative order,
 * rather than holding its original index. That is not a shortcut: `saveProject`
 * could be position-stable but `deleteProject` and `reorderProjects` rebuild the
 * array, so "original index" has no meaning after them. Appending is also
 * exactly what `reorderProjects` already promises for ids absent from
 * `orderedIds` (see its contract below) — and a residue element has no readable
 * id, so it is necessarily one of those. One rule, and it matches the shipped
 * contract instead of competing with it.
 *
 * ⚠️ HONEST BOUND, measured rather than described as "value-faithful": this
 * re-serialises the residue, so it survives the PARSED value, not the original
 * bytes. Measured losses on a JSON round trip: `1e999` -> `null`, `-0` -> `0`,
 * `12345678901234567890` -> `12345678901234567000`, duplicate keys collapse,
 * numeric-like keys reorder. The elements involved are unreadable by
 * definition, so nothing in this app consumes that precision — but a later
 * repair by hand gets the parsed value, not what was originally stored.
 */
function writeEntries(key: string, entries: unknown[], residue: unknown[]): void {
  set(key, residue.length === 0 ? entries : [...entries, ...residue]);
}

/**
 * How many stored entries could not be read, per data key.
 *
 * ⚠️ Exists for ONE reason: an export must not silently hand back a short
 * backup. A user who exports, sees a file and believes they are safe has had
 * recoverable corruption turned into permanent loss by our own escape hatch.
 * The export callers use this to say so. Local mode only — a Firestore-backed
 * export has no localStorage residue to report, and callers must gate on mode.
 *
 * Returns zeroes rather than throwing on unreadable storage: the callers are
 * building a user-facing message, and an unreadable key surfaces through the
 * read that actually failed.
 */
export function readStorageResidueCount(): { projects: number; teamPool: number } {
  const count = <T,>(key: string, isEntry: (v: unknown) => v is T): number => {
    try {
      return readEntries(key, isEntry).residue.length;
    } catch {
      return 0;
    }
  };
  return {
    projects: count(STORAGE_KEYS.projects, isValidProjectEntry),
    teamPool: count(STORAGE_KEYS.teamPool, isValidPoolMemberEntry),
  };
}

/**
 * The sentence an export must add when the file it just produced is short, or
 * null when it is complete.
 *
 * ⚠️⚠️ THIS IS ACCEPTANCE CRITERION 6 AND IT IS THE ONLY PROACTIVE SIGNAL IN
 * THE RELEASE. Every other message in this change fires when a write is
 * refused. A user who never writes — opens the app, exports "to be safe",
 * clears their browser — would otherwise be told nothing at all, and would have
 * had recoverable corruption converted into permanent loss by our own escape
 * hatch. It fires exactly when the risk materialises.
 *
 * ⚠️ `isCloud` gate: residue is a localStorage fact. A Firestore-backed export
 * has none to report and must not claim otherwise.
 *
 * ⚠️ BOUND, stated because the obvious stronger claim is false: this marks the
 * export in the UI, NOT in the file. A file handed to someone else carries no
 * marker. Putting the residue INTO the file was measured and rejected —
 * `validateAppState` refuses a projects array containing an unreadable element,
 * and it refuses the WHOLE file, so carrying it would turn a short backup into
 * an unimportable one. A metadata field on `AppState` would work but is an
 * export-format contract change, which this item is not.
 */
export function describeExportOmission(isCloud: boolean): string | null {
  if (isCloud) return null;
  const { projects, teamPool } = readStorageResidueCount();
  const total = projects + teamPool;
  if (total === 0) return null;
  return `${total} unreadable ${total === 1 ? 'entry was' : 'entries were'} ` +
    'left out because they could not be read. They are still in your browser storage.';
}

/**
 * Write to localStorage with quota error detection
 * Throws StorageQuotaError if quota is exceeded
 */
function set(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    const json = JSON.stringify(value);
    localStorage.setItem(key, json);
  } catch (e) {
    // Detect quota exceeded error (DOMException code 22 or name QuotaExceededError)
    if (e instanceof DOMException && (e.code === 22 || e.name === 'QuotaExceededError')) {
      console.error(`[storage] Quota exceeded for "${key}"`);
      throw new StorageQuotaError('Storage quota exceeded. Cannot save changes. Try exporting your data and clearing old projects.');
    }
    console.error(`[storage] Failed to write "${key}":`, e);
  }
}

export function createLocalStorageRepository(): Repository {
  const repo: Repository = {
    /**
     * ⚠️ Settings is an OBJECT, so unlike the two array keys there is no
     * readable subset to salvage — every failure here is total, and this throws.
     *
     * ⚠️⚠️ Returning DEFAULT_SETTINGS on damage (what this did until v0.38.0) is
     * worse than it looks, and it is the failure v0.37.4 named and feared.
     * Measured 2026-09-06: a settings blob whose `laborRates` is unreadable used
     * to load as the six seeded defaults, and ONE ordinary edit — changing the
     * discount rate — then wrote those defaults over the user's real rates,
     * holidays and thresholds. The read looked successful, so nothing warned.
     *
     * Throwing is also what makes the write safe with no guard on
     * `saveSettings`: `useSettings` leaves `settings` at null when the read
     * fails, and `updateSettings` early-returns on a null previous value, so no
     * settings write can be composed at all. `saveSettings` stays unguarded ON
     * PURPOSE — the import path writes through it, and that is how a user
     * recovers.
     */
    async getSettings() {
      const raw = readRaw(STORAGE_KEYS.settings);
      if (raw.state === 'absent') return DEFAULT_SETTINGS;
      if (raw.state === 'unparseable') {
        throw new StorageIntegrityError(STORAGE_KEYS.settings, 'not valid JSON');
      }
      if (!isValidSettings(raw.value)) {
        throw new StorageIntegrityError(STORAGE_KEYS.settings, 'unrecognised shape');
      }
      return raw.value;
    },

    async saveSettings(settings) {
      set(STORAGE_KEYS.settings, settings);
    },

    async getTeamPool() {
      return readEntries(STORAGE_KEYS.teamPool, isValidPoolMemberEntry).entries;
    },

    /**
     * ⚠️ Carries residue forward. `useTeamPool` persists its own STATE, which
     * came from `getTeamPool` and therefore holds only the readable members — so
     * a plain write here would drop the rest. Measured at HEAD: three stored
     * members, one unreadable, one `addPoolMember` and storage held the new
     * member alone.
     */
    async saveTeamPool(pool) {
      const { residue } = readEntries(STORAGE_KEYS.teamPool, isValidPoolMemberEntry);
      writeEntries(STORAGE_KEYS.teamPool, pool, residue);
    },

    async saveSettingsAndTeamPool(settings, pool) {
      // ⚠️ POOL FIRST, AND THE ORDER IS THE WHOLE DESIGN OF THIS METHOD IN LOCAL
      // MODE. localStorage has no multi-key transaction, so this is two
      // `setItem`s — far narrower than two debounced writes (no debounce, no
      // navigation, no second reader) but not atomic. `set` throws
      // StorageQuotaError on quota and swallows every other write error with a
      // bare console.error, so a partial write IS reachable.
      //
      // Pool first, for two independent reasons:
      //   1. RECOVERABILITY. Both orders leave identical red markers on screen,
      //      so visibility does not separate them. Pool-first is repaired by
      //      repeating the same rename — the cascade finds 0 holders and the
      //      rates land, one step. Rates-first strands every holder on a role
      //      whose rate row no longer exists, with no X row left to rename.
      //   2. A rename's byte delta is N×Δ on the pool against 1×Δ on the rates,
      //      so if either write crosses quota it is the pool's. Writing it
      //      first means the likelier failure happens before anything was
      //      written at all.
      //
      // ⚠️ `importUtils.ts:319` is also pool-first, for a DIFFERENT reason
      // (project writes downstream need the updated pool to build
      // `_teamSnapshot`). Do not copy its reasoning onto this site.
      // v0.38.0: the pool half carries residue forward like every other pool
      // write. The settings half cannot — see getSettings — but it is also
      // unreachable with damaged settings, because this handler reads stored
      // settings first (settings/page.tsx:63) and that read throws.
      const { residue } = readEntries(STORAGE_KEYS.teamPool, isValidPoolMemberEntry);
      writeEntries(STORAGE_KEYS.teamPool, pool, residue);
      set(STORAGE_KEYS.settings, settings);
    },

    async getProjects() {
      return readEntries(STORAGE_KEYS.projects, isValidProjectEntry).entries;
    },

    async getProject(id) {
      const projects = await repo.getProjects();
      return projects.find((p) => p.id === id) ?? null;
    },

    async saveProject(project) {
      const { entries, residue } = readEntries(STORAGE_KEYS.projects, isValidProjectEntry);
      const index = entries.findIndex((p) => p.id === project.id);
      if (index >= 0) {
        entries[index] = project;
      } else {
        entries.push(project);
      }
      writeEntries(STORAGE_KEYS.projects, entries, residue);
    },

    async createProject(project) {
      // localStorage has no ownership concept — delegate to saveProject
      await repo.saveProject(project);
    },

    async deleteProject(id) {
      const { entries, residue } = readEntries(STORAGE_KEYS.projects, isValidProjectEntry);
      writeEntries(
        STORAGE_KEYS.projects,
        entries.filter((p) => p.id !== id),
        residue,
      );
    },

    /**
     * CONTRACT: ids in `orderedIds` take that order; ids present in storage but
     * ABSENT from `orderedIds` follow, in their existing relative order.
     *
     * ⚠️ Until v0.37.12 this wrote ONLY the ids it was handed, so a caller
     * holding a stale picture of the list silently and permanently destroyed
     * every project missing from it. Reachable by an ordinary user with two
     * tabs: create a project in tab A, drag to reorder in tab B, and tab A's
     * project is gone. Nothing corrects tab B in local mode — this file has zero
     * `cloudSyncBus` references and no `storage` listener exists for
     * `msb:projects` (`FirstRunBanner.tsx:57` is the only one, for another key).
     *
     * ⚠️ End-placement is not an arbitrary pick. `saveProject` pushes (:142),
     * so new projects already go last here; and Firestore has implemented the
     * same rule all along — `createProject` sets `order: projects.length` and
     * `getProjects` sorts on `order`, so a project a stale tab never saw keeps
     * the highest `order` and sorts last. The interface is named *reorder*, not
     * *replace*. THIS implementation was the outlier; the fix makes it conform.
     *
     * ⚠⚠ HISTORY, kept because the bound it records is what this file was
     * missing. Until v0.38.0 this carried a stated bound — "never drops a
     * project that `getProjects()` RETURNED", explicitly NOT "never reduces the
     * stored project count" — because `getProjects` read through an
     * all-or-nothing `.every(...)` validator, so ONE malformed stored entry made
     * it return `[]` and this function then wrote `[]`. Measured 2026-09-03:
     * three well-formed projects beside one malformed entry, all three destroyed
     * by an ordinary drag. **v0.38.0 removed the cause, and the weaker bound
     * with it.** The read now salvages the readable entries and every write
     * carries the rest through, so this drops nothing either way.
     *
     * ⚠️ The residue appended by `writeEntries` lands under the SAME clause as
     * unhandled ids — it follows, in its existing relative order — because a
     * residue element has no readable `id` and so can never appear in
     * `orderedIds`. The contract above already covers it; nothing was widened.
     */
    async reorderProjects(orderedIds) {
      const { entries, residue } = readEntries(STORAGE_KEYS.projects, isValidProjectEntry);
      const byId = new Map(entries.map((p) => [p.id, p]));
      const handled = new Set(orderedIds);
      const reordered = orderedIds
        .map((id) => byId.get(id))
        .filter((p): p is Project => p !== undefined);
      // Unhandled projects follow, in storage order. When `orderedIds` covers
      // every stored project nothing is appended and the write is byte-identical
      // to the pre-v0.37.12 behaviour.
      writeEntries(
        STORAGE_KEYS.projects,
        [...reordered, ...entries.filter((p) => !handled.has(p.id))],
        residue,
      );
    },

    async exportAll() {
      const data: AppState = {
        version: DATA_VERSION,
        msbExportKind: 'dataset',  // discriminant — pitfall #61 gate for future formats
        settings: await repo.getSettings(),
        teamPool: await repo.getTeamPool(),
        projects: await repo.getProjects(),
        // Workspace reconciliation tokens
        _originRef: ensureOriginRef(),
        _storageRef: getWorkspaceId(),
        _changeLog: getChangeLog(),
      };

      // Conditionally inject export attribution
      const attr = getExportAttribution();
      if (attr.name) data._exportedBy = attr.name;
      if (attr.id) data._exportedById = attr.id;

      return data;
    },

    /**
     * ⚠️ DELIBERATELY EXEMPT from carry-forward, and this is the user's way out.
     * Every other write preserves unreadable residue; this one replaces each key
     * wholesale. Without that exemption a user whose storage is damaged could
     * never clear it — the residue would survive every write forever, including
     * the import meant to repair it. `clear()` is exempt for the same reason.
     */
    async importAll(state) {
      set(STORAGE_KEYS.version, state.version);
      set(STORAGE_KEYS.settings, state.settings);
      set(STORAGE_KEYS.teamPool, state.teamPool);
      set(STORAGE_KEYS.projects, state.projects);

      // Preserve _originRef from imported file; backfill with current workspace if absent
      const importedOrigin = state._originRef;
      const originRef = typeof importedOrigin === 'string' && importedOrigin
        ? importedOrigin
        : getWorkspaceId();
      setOriginRef(originRef);

      // Preserve imported changelog, append import event
      const importedLog: ChangeLogEntry[] = Array.isArray(state._changeLog) ? state._changeLog : [];
      const withImportEvent: ChangeLogEntry[] = [...importedLog, {
        t: Math.floor(Date.now() / 1000),
        op: 'import',
        entity: 'dataset',
        source: 'file',
      }];
      setChangeLog(withImportEvent);
    },

    async clear() {
      Object.values(STORAGE_KEYS).forEach((key) => {
        localStorage.removeItem(key);
      });
    },

    async getVersion() {
      return get<string>(STORAGE_KEYS.version, DATA_VERSION);
    },

    /**
     * ⚠️⚠️ THIS RUNS AT BOOT, WITH NO USER ACTION, ON ANY DATA_VERSION BUMP —
     * which made it the worst of the five read-then-write sites. `exportAll`
     * reads all three keys and `importAll` writes all three, so before v0.38.0 a
     * single unreadable entry meant the app destroyed the user's projects, team
     * pool and labor rates while starting up. Measured 2026-09-06: version
     * 0.15.0 with three valid projects and one malformed entry migrated to
     * 0.16.0 and left the projects key holding `[]`.
     *
     * ⚠️⚠️ IT MUST NOT THROW, AND THAT IS NOT A STYLE CHOICE.
     * `MigrationGuard.tsx:29` is `migrateIfNeeded().then(() => setReady(true))`
     * with NO `.catch`. A rejection here leaves `ready` false forever and the
     * guard renders `null` — a permanently BLANK PAGE with no message. So a
     * StorageIntegrityError is swallowed and the migration is skipped.
     *
     * ⚠️ ONLY StorageIntegrityError. Catching every Error would also swallow a
     * genuine migration bug, which today surfaces (badly, but visibly) as that
     * same blank page; changing THAT is not this item's business.
     *
     * ⚠️ Residue is carried through the migration rather than the migration
     * being refused. Refusing also preserves the element — but only because no
     * write happens at all, which satisfies criterion 8 VACUOUSLY, and it leaves
     * the user permanently unmigrated. That is not hypothetical: v0.29.0's
     * migration was a breaking semantic change (`reforecast.startDate` YYYY-MM
     * to YYYY-MM-DD), so new code reading old data misreads every reforecast
     * window. Carrying advances the version AND preserves the element through a
     * real write.
     *
     * ⚠️ Residue is NOT migrated — it cannot be, it is unreadable. A later
     * hand-repair of such an element therefore yields old-schema data under a
     * newer version stamp. Recorded rather than solved: repairing by hand is
     * already outside anything this app offers.
     */
    async migrateIfNeeded() {
      try {
        const currentVersion = await repo.getVersion();
        // Read the residue BEFORE exportAll so the same throw covers both, and
        // so there is something to carry after importAll writes wholesale.
        const projectResidue = readEntries(STORAGE_KEYS.projects, isValidProjectEntry).residue;
        const poolResidue = readEntries(STORAGE_KEYS.teamPool, isValidPoolMemberEntry).residue;
        const data = await repo.exportAll();
        const migrated = runMigrations(data, currentVersion);

        if (migrated.version !== currentVersion) {
          await repo.importAll(migrated);
          // `importAll` writes each key wholesale — it is the recovery path and
          // is deliberately exempt from carry-forward — so re-attach here.
          if (projectResidue.length > 0) {
            writeEntries(STORAGE_KEYS.projects, migrated.projects, projectResidue);
          }
          if (poolResidue.length > 0) {
            writeEntries(STORAGE_KEYS.teamPool, migrated.teamPool, poolResidue);
          }
        }
      } catch (e) {
        if (!(e instanceof StorageIntegrityError)) throw e;
        console.warn(
          '[storage] Migration skipped — stored data could not be read. ' +
          'Nothing was written; your data is unchanged.',
          e.key,
        );
      }
    },
  };

  return repo;
}
