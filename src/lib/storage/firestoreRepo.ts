// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import {
  doc, getDoc, setDoc, deleteDoc, deleteField, runTransaction, FieldPath,
  collection, query, where, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { PROJECTS_COL, SETTINGS_COL } from '@/lib/firebase/collections';
import type { Repository } from './repository';
import type {
  Settings, PoolMember, Project, AppState, CostSnapshot, ProjectPrefsEntry, ProjectPrefPatch,
} from '@/types/domain';
import { DEFAULT_SETTINGS } from './localStorage';
import { DATA_VERSION } from './migrations';
import type { ChangeLogEntry } from './fingerprint';
import {
  getChangeLog, getExportAttribution,
  setOriginRef, setChangeLog,
} from './fingerprint';
import { buildProjectTeamSnapshot, stripUndefined, docToProject } from './firestoreUtils';
import {
  applyPrefsToProject, buildSeedEntries, EMPTY_READER_PREFS, isSeeded, orderProjects,
  readReaderPrefs, readStoredOrder, type OrderableProject, type ReaderPrefs,
} from './projectPrefs';
import type { ProjectWithOwnership } from '@/lib/utils/costSnapshot';

/** Firestore document shape for projects (extends Project with cloud metadata). */
interface FirestoreProjectDoc {
  name: string;
  startDate: string;
  endDate: string;
  reforecasts: Project['reforecasts'];
  activeReforecastId: string | null;
  /**
   * ⚠️ `color`, `archived` and `order` ARE DELIBERATELY ABSENT (v0.42.0).
   *
   * All three were per-user preferences stored on a SHARED document, so one
   * member's choice changed every member's dashboard: an editor's colour or
   * archive was written to the document (and an archive hid the project from
   * the owner's own dashboard), and an editor's drag wrote `order` into every
   * document they could see. They now live in each reader's own settings
   * document under `projectPrefs` / `projectOrder` — see `Repository`.
   *
   * ⚠️ The rules still ALLOW all three (spert-landing `myScrumBudgetProjectFields`).
   * That is on purpose and must stay until the stored documents are cleaned:
   * dropping them from the allowlist first would deny any full replace of a
   * document that still carries them (`importAll`'s kept-id branch, and every
   * pre-release client's create) and leave the fields undeletable by any client.
   *
   * ⚠️ `docToProject` STILL HYDRATES `color` and `archived`, and that is not
   * dead code: a reader who has not yet been seeded sees the document's values,
   * which is what makes the one-time seed "what you saw yesterday" rather than
   * a reset. Deleting the hydration empties every seed.
   */
  owner: string;
  members: Record<string, string>;
  _teamSnapshot: Record<string, { name: string; role: string }>;
  /**
   * Cost inputs the project was costed with (v0.39.0). null when absent, so
   * mergeFields can unset it.
   *
   * ⚠️ This used to read "same shape as `color`/`archived`". Those two fields
   * left this type in v0.42.0 (see the note above), so the comparison now points
   * at nothing; the shape is stated on its own terms instead.
   *
   * ⚠️ REQUIRED, NOT OPTIONAL, AND THAT IS THE WHOLE POINT. Optional would let
   * both literals below supply nothing, so nothing would ever be written and
   * the cross-repo rules change (spert-landing v2.5.38) would never be
   * exercised by a real write. Required makes `tsc` force a decision at each
   * write site, both answer `null`, and the ruleset is proven by a live write
   * with an inert payload.
   *
   * ⚠️ An explicit `null` IS a present key — `stripUndefined` removes undefined,
   * not null — so this field REQUIRES the allowlist entry deployed in
   * spert-landing v2.5.38. Without it every cloud create and import is
   * PERMISSION_DENIED. That is the v0.33.0 `color` incident verbatim, which is
   * why the ruleset shipped first.
   */
  _costSnapshot: CostSnapshot | null;
  _originRef: string;
  _changeLog: ChangeLogEntry[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

/**
 * Compile-time edge from `Project` to WHERE EACH FIELD PERSISTS.
 *
 * `FirestoreProjectDoc` is a hand-maintained near-duplicate of `Project` plus
 * cloud metadata; nothing in the type system linked the two. Adding a field to
 * `Project` therefore left this doc silently short, and the three write literals
 * still compiled, because they are checked against the duplicate rather than
 * against `Project`.
 *
 * ⚠️ SINCE v0.42.0 THE ANSWER IS NO LONGER ALWAYS "THE DOCUMENT". `color` and
 * `archived` persist in the READER's own settings document, so this map has a
 * second legal answer, `'reader-prefs'`, and a new `Project` field must be
 * dispositioned into one of the two. It is RESTRUCTURED, not relieved: the
 * tempting `Omit<Project, 'color' | 'archived'>` would make the map silent about
 * exactly the fields this release moved.
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
/** The keys of one reader's preference entry — the second legal destination. */
type ReaderPrefKey = keyof ProjectPrefsEntry;

type ProjectKeyCoverage = {
  [K in keyof Omit<Project, 'id'>]-?:
    K extends keyof FirestoreProjectDoc ? K
      : K extends ReaderPrefKey ? 'reader-prefs'
        : never;
};
const _projectKeyCoverage: ProjectKeyCoverage = {
  name: 'name',
  startDate: 'startDate',
  endDate: 'endDate',
  reforecasts: 'reforecasts',
  activeReforecastId: 'activeReforecastId',
  color: 'reader-prefs',
  archived: 'reader-prefs',
  _teamSnapshot: '_teamSnapshot',
  _costSnapshot: '_costSnapshot',
};
void _projectKeyCoverage;

/**
 * The fields `saveProject` writes on every save, as a `satisfies`-checked set.
 *
 * Previously an inline `string[]` on the `setDoc` call: unconstrained, so an
 * invalid or stale key typechecked. `satisfies` checks every entry against
 * `FirestoreProjectDoc` while keeping the literal key types.
 *
 * ⚠️ CORRECTED 2026-09-03 — this comment described the RUNTIME consequence
 * backwards, and it had the two directions swapped. From the SDK's
 * `parseSetData`, both are real and only one is silent:
 *   - A mask entry ABSENT FROM THE DATA throws `INVALID_ARGUMENT` client-side
 *     ("Field 'x' is specified in your field mask but missing from your input
 *     data") and nothing is written. LOUD. This is what a stale key does.
 *   - A DATA FIELD ABSENT FROM THE MASK is dropped without any error, because
 *     `fieldMask` is built ONLY from `mergeFields` and never from the parsed
 *     data. SILENT — and it is the direction that matters, because losing an
 *     entry from a mask is invisible at runtime.
 * The old text attributed the silent consequence to the loud cause.
 *
 * ⚠️ `Partial` is deliberate and it bounds what this catches: it rejects a key
 * that is NOT a doc field, and it does NOT require completeness. It cannot,
 * because ownership/identity fields — owner, members, createdAt, _originRef,
 * _changeLog, schemaVersion — are excluded ON PURPOSE so existing Firestore
 * values survive a save, which is load-bearing for the v0.30.0 import `replace`
 * path. A newly added Project field is caught by `_projectKeyCoverage` above,
 * which is the prompt to decide whether it also belongs here.
 *
 * ⚠️ SEVEN SINCE v0.42.0, not nine: `color` and `archived` left this set with
 * the document fields themselves. A save by ANY member used to rewrite both for
 * EVERY member — including an ordinary Ctrl+Z on the detail page, which
 * re-saves a pre-change snapshot immediately.
 */
const SAVE_PROJECT_MERGE_SET = {
  name: true,
  startDate: true,
  endDate: true,
  reforecasts: true,
  activeReforecastId: true,
  _teamSnapshot: true,
  updatedAt: true,
} satisfies Partial<Record<keyof FirestoreProjectDoc, true>>;

export const SAVE_PROJECT_MERGE_FIELDS = Object.keys(SAVE_PROJECT_MERGE_SET);

/**
 * The ONE extra field an owner's save adds (v0.40.0), as its own
 * `satisfies`-guarded set.
 *
 * ⚠️⚠️ THE SHAPE IS THE POINT, AND THE OBVIOUS ALTERNATIVE IS A SILENT TRAP.
 * The rule this release implements — "not owner → seven; owner with a usable
 * rate card → eight; owner WITHOUT one → seven" (nine/ten until v0.42.0 moved
 * `color` and `archived` off the document) — is satisfied literally by:
 *
 *     mergeFields: Object.keys(stripUndefined(payload))    // ⚠️ DO NOT.
 *
 * That is one line, it produces the right mask in all three states, and it
 * DELETES the completeness guard: with the mask derived from the payload,
 * `SAVE_PROJECT_MERGE_SET` and this set become unreferenced.
 *
 * ⚠️⚠️ AND NO LINT RATCHET CATCHES THAT — MEASURED 2026-09-13, BOTH WAYS.
 * The design note this release was built from said the ratchet would fire at 14
 * against the accepted baseline of 13, so the ship gate would fail and force
 * the question. It does NOT. That measurement was taken against a build where
 * these constants were module-PRIVATE; exporting them (which is what lets a
 * test import them) means ESLint no longer reports them as unused. Measured
 * under the dynamic mask: lint is 13/0 with the constants retained AND 13/0
 * with them deleted. The gate is green in both worlds.
 *
 * ⚠️ So the protection here is NOT the ratchet. It is the seven tests that
 * assert `mergeFields` by REFERENCE against these constants, plus the import in
 * the test file. Weaken either and this becomes a silent one-line change. Do
 * not reason from "the lint gate would catch it" — it would not.
 *
 * ⚠️ A BARE OBJECT LITERAL IS ALSO NOT ENOUGH. Without `satisfies`, a typo
 * (`_costSnapshott`) typechecks clean and fails only at runtime. With it, the
 * same typo is TS2561 naming the field and suggesting the right one.
 *
 * ⚠️ And it is EXPORTED so a test can import it. That is deliberate: a constant
 * nothing imports is the one a tidy-up deletes. `SAVE_PROJECT_MERGE_FIELDS` is
 * exported for the same reason — the mask assertions use `toBe` (reference
 * identity), because `toEqual` on the array CANNOT refuse the dynamic mask:
 * `Object.keys` of the payload yields the same seven strings in the same order,
 * so the two are equal by value.
 *
 * ⚠️ `SAVE_PROJECT_OWNER_EXTRA` extends `SAVE_PROJECT_MERGE_SET` rather than
 * restating it, so the element-order pin above (seven since v0.42.0) stays the
 * one place that order is written down.
 */
export const SAVE_PROJECT_OWNER_EXTRA = {
  _costSnapshot: true,
} satisfies Partial<Record<keyof FirestoreProjectDoc, true>>;

export const SAVE_PROJECT_OWNER_MERGE_FIELDS = [
  ...SAVE_PROJECT_MERGE_FIELDS,
  ...Object.keys(SAVE_PROJECT_OWNER_EXTRA),
];

/**
 * A `Project` as returned by `getProject`, which may carry the ownership flag.
 *
 * ⚠️ MOVED to `@/lib/utils/costSnapshot` in v0.41.0 and RE-EXPORTED here, so
 * every existing importer is unchanged. The reason is the module graph and it
 * is written at the definition: this file imports `firebase/firestore` at
 * runtime, and the flag's first consumer outside the repository layer is now a
 * React component.
 *
 * ⚠️ PRESENT and `true`, or ABSENT. Never `false`. The write path tests
 * `=== true`, so a `false` would behave identically at the write site and the
 * difference would be invisible there — which is why the shape is pinned on the
 * READ path instead (see the `getProject` tests).
 */
export type { ProjectWithOwnership };

/**
 * Resolve the cost card an owner's save should publish, or `undefined` to
 * publish nothing (v0.40.0, `DEC-W2`).
 *
 * ⚠️⚠️ TAKES THE RAW DOCUMENT DATA, NEVER `getSettings()`, AND THAT IS THE
 * WHOLE RULE. `getSettings` FABRICATES: it returns `DEFAULT_SETTINGS` when the
 * document is absent, and `data.laborRates ?? DEFAULT_SETTINGS.laborRates` when
 * the document exists without that key. Either way it hands back six stock
 * rates the owner never saved — and stamping those onto a project publishes a
 * rate card to every collaborator that its supposed author has never seen.
 * 3 of 13 projects were in that state when this was written.
 *
 * ⚠️ "Never SAVED", not "never authored". The rule discriminates on KEY
 * PRESENCE, and one owner has a present key holding a byte-identical copy of
 * the stock card — that one publishes, correctly, because they saved it.
 *
 * ⚠️ REFUSAL IS ALL-OR-NOTHING ON THE RATES ONLY. `CostSnapshot.laborRates` is
 * required (`domain.ts:64-68`), so a snapshot without rates is not expressible;
 * missing rates therefore refuse the whole card. The other two fields are
 * different: they have meaningful empty values, so a card with real rates and
 * no holidays publishes with `holidays: []` and the default discount rate
 * rather than being refused. Refusing on ANY missing field would withhold a
 * usable rate card because the owner never added a holiday.
 */
function resolveOwnerCostSnapshot(
  data: Record<string, unknown> | undefined,
): CostSnapshot | undefined {
  const laborRates = data?.laborRates;
  // The key must be present AND hold at least one rate. An empty array is a
  // saved-but-empty card: publishing it would price every role at $0 for every
  // collaborator, which is loud but wrong. Publishing nothing leaves each
  // reader on their own rates, which is this release's own status quo.
  if (!Array.isArray(laborRates) || laborRates.length === 0) return undefined;
  return {
    laborRates: laborRates as CostSnapshot['laborRates'],
    // Copied, not referenced: `DEFAULT_SETTINGS.holidays` is a shared
    // module-level array and this value goes into a write payload.
    holidays: Array.isArray(data!.holidays)
      ? (data!.holidays as CostSnapshot['holidays'])
      : [...DEFAULT_SETTINGS.holidays],
    discountRateAnnual: typeof data!.discountRateAnnual === 'number'
      ? data!.discountRateAnnual
      : DEFAULT_SETTINGS.discountRateAnnual,
  };
}

/**
 * Firestore document shape for the per-user settings doc.
 *
 * The team pool lives in this same document (`teamPool`), which is what makes a
 * combined settings+pool write atomic by single-document semantics.
 */
interface FirestoreSettingsDoc {
  discountRateAnnual: Settings['discountRateAnnual'];
  laborRates: Settings['laborRates'];
  holidays: Settings['holidays'];
  trafficLightThresholds: Settings['trafficLightThresholds'];
  schemaVersion: number;
  teamPool: PoolMember[];
  /**
   * The reader's own display preferences (v0.42.0), keyed by project id.
   *
   * ⚠️ DECLARED HERE AND EXCLUDED FROM BOTH MASKS BY NAME — see
   * `SettingsPrefsKey` below. The three keys have their own writer, which
   * addresses individual paths with `FieldPath`; they must never join a mask
   * that `saveSettings` or `saveTeamPool` uses, because those payloads do not
   * carry them and a mask entry missing from the data throws INVALID_ARGUMENT
   * client-side — every settings save would fail. Leaving them off this type
   * is the other wrong answer: then nothing type-checks the writer at all.
   */
  projectPrefs?: Record<string, ProjectPrefsEntry>;
  /** The reader's own dashboard order: project ids, first to last. */
  projectOrder?: string[];
  /**
   * The one-time seed marker (v0.42.0).
   *
   * ⚠️ A NEW KEY, NEVER `schemaVersion`. `saveSettings` rewrites
   * `schemaVersion: 2` on every save, so a marker kept there would be re-stamped
   * by an ordinary rate edit and could never mean "this reader has been seeded".
   * Present ⇒ seeded: the reader's preferences are authoritative and no document
   * `color`/`archived`/`order` is read for them again.
   */
  projectPrefsSeed?: 1;
}

/**
 * The preference keys, named once (v0.42.0).
 *
 * ⚠️ BOTH SETTINGS MASKS EXCLUDE THIS UNION, and the exclusion is what the
 * masks' `Record<…>` exactness allows. Adding a preference key to
 * `FirestoreSettingsDoc` ALONE makes both masks demand it (2 × TS1360) — that
 * is the guard working, and the prompt to decide. Adding it here as well is the
 * disposition that says "this one has its own writer".
 */
type SettingsPrefsKey = 'projectPrefs' | 'projectOrder' | 'projectPrefsSeed';

/**
 * The fields `saveSettings` writes, and its extension carrying `teamPool`.
 *
 * ⚠️ EXACT `Record`, NOT `Partial<Record<…>>`, AND THE DIFFERENCE IS THE GUARD.
 * Measured by deletion 2026-09-03: under a `Partial` shape, removing
 * `laborRates` from the set produces NO compile error at all, so the whole
 * guarantee would rest on the runtime pin. Under an exact `Record` the deletion
 * is TS1360, in both directions.
 *
 * ⚠️ `SAVE_PROJECT_MERGE_SET` above IS `Partial`, and copying that here would
 * have been wrong for a reason its own comment states: `Partial` is deliberate
 * there because completeness is IMPOSSIBLE — ownership and identity fields are
 * excluded on purpose. Here completeness is the entire point; `laborRates` and
 * `teamPool` must move together or a rename orphans every holder. The
 * precedent's justification does not transfer, so the precedent's construct
 * must not either. Check a borrowed guard by asking whether the reason it was
 * chosen still applies, not by reading its shape.
 *
 * ⚠️ HONEST LIMIT, so these are not read as equivalent: TS1360 ENUMERATES THE
 * SURVIVING KEYS rather than naming the missing one, so this is diagnostically
 * WEAKER than the TS2741 `_projectKeyCoverage` produces. It catches the
 * deletion; the reader has to diff the list to see what went.
 */
/**
 * ⚠️ DERIVED FROM THE DOC TYPE, NOT A HAND-WRITTEN UNION, AND THAT IS DELIBERATE
 * even though it is stricter than it needs to be. Adding a field to
 * `FirestoreSettingsDoc` fails BOTH constants below until someone decides
 * whether it belongs in each mask. That is the `_projectKeyCoverage`
 * philosophy — the compile error exists as a PROMPT TO DECIDE, not as an
 * obstacle. If you hit it, disposition the new field; do not loosen this to a
 * literal union to make the error go away.
 */
type SettingsWriteField = Exclude<keyof FirestoreSettingsDoc, 'teamPool' | SettingsPrefsKey>;

const SETTINGS_MERGE_SET = {
  discountRateAnnual: true,
  laborRates: true,
  holidays: true,
  trafficLightThresholds: true,
  schemaVersion: true,
} satisfies Record<SettingsWriteField, true>;

const SETTINGS_AND_POOL_MERGE_SET = {
  ...SETTINGS_MERGE_SET,
  teamPool: true,
} satisfies Record<Exclude<keyof FirestoreSettingsDoc, SettingsPrefsKey>, true>;

const SETTINGS_MERGE_FIELDS = Object.keys(SETTINGS_MERGE_SET);
const SETTINGS_AND_POOL_MERGE_FIELDS = Object.keys(SETTINGS_AND_POOL_MERGE_SET);

/** What one preference transaction should do. */
interface PrefsWrite {
  /** Per-project changes. `null` clears; an absent key leaves that preference alone. */
  patches?: ProjectPrefPatch[];
  /** These ids take the front of the order; everything else keeps its relative order. */
  reorder?: string[];
  /** These ids move to the END, in this order (the upload). */
  appendLast?: string[];
  /** Ids the seed's view must EXCLUDE — the upload's own, which it places itself. */
  excludeFromSeed?: string[];
  /** Seed only. The ONE write that may legitimately do nothing. */
  seedOnly?: boolean;
}

/**
 * Fold one patch into the field map, overwriting whatever the seed put there.
 *
 * ⚠️ THE PATCH WINS, AND THAT ORDERING IS THE POINT. An unseeded reader's first
 * action is often un-archiving a project somebody else archived: the seed wants
 * `archived: true` at that exact path (it is copying what they see) and the
 * patch wants it gone. One payload holds one value per path, so the patch is
 * folded in AFTER the seed and the reader's own action stands.
 */
function collectPatch(fields: Map<string, Map<string, unknown>>, patch: ProjectPrefPatch): void {
  const entry = fields.get(patch.id) ?? new Map<string, unknown>();
  if (patch.color !== undefined) {
    entry.set('color', patch.color === null ? deleteField() : patch.color);
  }
  if (patch.archived !== undefined) {
    entry.set('archived', patch.archived === null ? deleteField() : true);
  }
  if (entry.size > 0) fields.set(patch.id, entry);
}

/** The seed's own field map: one entry per project that has a value to copy. */
function seedFields(view: Project[]): Map<string, Map<string, unknown>> {
  const fields = new Map<string, Map<string, unknown>>();
  for (const [id, entry] of buildSeedEntries(view)) {
    const entryFields = new Map<string, unknown>();
    if (entry.color) entryFields.set('color', entry.color);
    if (entry.archived) entryFields.set('archived', true);
    fields.set(id, entryFields);
  }
  return fields;
}

/**
 * Turn the collected fields and order into ONE payload and ONE mask.
 *
 * ⚠️ FIELD-LEVEL PATHS ONLY — `projectPrefs.<id>.color`, never
 * `projectPrefs.<id>`. Measured on MSB's own SDK: a mask path for the ENTRY
 * replaces that entry whole, so clearing an archive flag through an entry-level
 * path would delete the reader's colour with it. And never the whole
 * `projectPrefs` map, which would drop every project this write does not name.
 *
 * ⚠️ A REAL `FieldPath`, NEVER A DOT-STRING: an imported project id is validated
 * as a string only, so an id CAN contain a dot, and a dot-string path would nest
 * `a.b` as `a → b` — measured.
 *
 * ⚠️ Every path named here is present in the payload by construction, because
 * both come from the same map. A mask entry missing from the data throws
 * INVALID_ARGUMENT client-side and writes nothing at all.
 */
function buildPrefsWrite(
  fields: Map<string, Map<string, unknown>>,
  order: string[] | null,
  seed: { needed: boolean; stampVersion: boolean },
): { payload: Record<string, unknown>; mergeFields: (string | FieldPath)[] } {
  const payload: Record<string, unknown> = {};
  const mergeFields: (string | FieldPath)[] = [];
  if (fields.size > 0) {
    payload.projectPrefs = Object.fromEntries(
      [...fields].map(([id, entryFields]) => [id, Object.fromEntries(entryFields)]),
    );
    for (const [id, entryFields] of fields) {
      for (const field of entryFields.keys()) {
        mergeFields.push(new FieldPath('projectPrefs', id, field));
      }
    }
  }
  if (order) {
    payload.projectOrder = order;
    mergeFields.push('projectOrder');
  }
  if (seed.needed) {
    payload.projectPrefsSeed = 1;
    mergeFields.push('projectPrefsSeed');
    // ⚠️ Only when this write CREATES the document, so a seed-created settings
    // document carries the same version a `saveSettings`-created one does.
    // Nothing reads it today; `getSettings` holds the comment that anticipates a
    // reader.
    if (seed.stampVersion) {
      payload.schemaVersion = 2;
      mergeFields.push('schemaVersion');
    }
  }
  return { payload, mergeFields };
}

/** Apply a write's ordering instructions to the order it starts from. */
function nextProjectOrder(base: string[], write: PrefsWrite): string[] {
  let order = base;
  if (write.reorder) {
    const handled = new Set(write.reorder);
    // The Repository contract: handled ids take that order, and ids the caller
    // did not name follow in their existing relative order.
    order = [...write.reorder, ...order.filter((id) => !handled.has(id))];
  }
  if (write.appendLast) {
    // ⚠️ REMOVE-THEN-APPEND, NOT "SKIP THE ONES ALREADY THERE". An upload flips
    // the app to cloud BEFORE `importAll` runs, so a mounted dashboard can seed
    // from a PARTLY uploaded cloud: those ids are already in the order, in
    // document-id order, because uploaded documents share one `createdAt`.
    // Skipping them would freeze that accidental order and the uploader's local
    // order would be lost for the first few projects. Removing them first makes
    // both interleavings produce the same array.
    const appended = new Set(write.appendLast);
    order = [...order.filter((id) => !appended.has(id)), ...write.appendLast];
  }
  return order;
}

export function createFirestoreRepository(uid: string): Repository {
  if (!db) throw new Error('Firestore is not initialized');

  const settingsRef = doc(db, SETTINGS_COL, uid);

  /** A listed project document, with the two raw values the order rule uses. */
  type ProjectRow = OrderableProject<Project> & { memberCount: number };

  /**
   * Every project this reader can see, as rows (v0.42.0).
   *
   * ⚠️ ONE QUERY SHAPE, TWO CALLERS: `getProjects` and the seed. The seed's
   * input has to be the SAME view the reader would see unseeded, or the values
   * it freezes are not the values they were looking at.
   *
   * ⚠️ This filter's SHAPE is a security boundary, not a convenience.
   * firestore.rules constrains `list` on this collection to
   * members[request.auth.uid] in ['owner', 'editor', 'viewer'], and Firestore
   * permits a list query ONLY when its filter PROVES that constraint. Drop or
   * change this filter and you do not get more rows — you get
   * PERMISSION_DENIED, and no project loads at all.
   * Until 2026-08-19 the rule was `allow list: if isAuth()`, which let any
   * signed-in SPERT user read every project in this collection.
   * ⚠️ The rule and this query are pinned together by
   * rules-tests/project-collections-list.test.ts in the spert-landing-page
   * repo (`npm run test:rules`). That test encodes this query AS WRITTEN and
   * lives in a DIFFERENT repository, so it will NOT fail when you edit this
   * line. Change one, change the other.
   */
  async function listProjectRows(): Promise<ProjectRow[]> {
    const q = query(
      collection(db!, PROJECTS_COL),
      where(`members.${uid}`, 'in', ['owner', 'editor', 'viewer']),
    );
    const snap = await getDocs(q);
    const rows: ProjectRow[] = [];
    snap.forEach((d) => {
      const data = d.data();
      const members = data.members as Record<string, string> | undefined;
      // ⚠️ `order` and `createdAt` are read from the RAW document and never
      // attached to the Project: `createdAt` is not a domain field, and
      // `exportAll` returns `getProjects`' output verbatim, so anything left on
      // the object becomes part of the export FORMAT.
      rows.push({
        id: d.id,
        order: readStoredOrder(data.order),
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
        memberCount: members ? Object.keys(members).length : 1,
        value: docToProject(d.id, data),
      });
    });
    return rows;
  }

  /**
   * ONE transaction that seeds this reader if they are unseeded, and applies
   * whatever the caller wants to change (v0.42.0).
   *
   * ⚠️ EVERY PREFERENCE WRITER GOES THROUGH HERE, so "seed first if unseeded" is
   * a property of the mechanism rather than something six call sites remember.
   * The first colour a reader picks must not leave them seeded with a one-entry
   * map: everything they could see at that moment is copied in the same
   * transaction.
   *
   * ⚠️ THE MARKER IS DECIDED INSIDE THE TRANSACTION, by this `tx.get`. That is
   * what makes a concurrent seed safe: measured on the emulator, a second client
   * writing the marker between the read and the commit makes the callback run
   * AGAIN, and the retry sees the marker.
   *
   * ⚠️ ONLY `seedOnly` MAY FINISH WITHOUT WRITING. A retry of any other writer
   * must still write its patch — the marker suppresses the SEED half, never the
   * caller's own change. Getting this wrong loses one colour change per
   * concurrent write, silently.
   *
   * ⚠️ The list query inside the callback is deliberate and measured: a client
   * transaction cannot run a query through `tx`, but an ordinary query inside
   * the callback works, and it re-runs on a retry. The marker check is what makes
   * a stale view safe.
   */
  async function runPrefsTransaction(write: PrefsWrite): Promise<void> {
    await runTransaction(db!, async (tx) => {
      const snap = await tx.get(settingsRef);
      const data = snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
      const seeded = isSeeded(data);
      if (seeded && write.seedOnly) return;

      let fields: Map<string, Map<string, unknown>>;
      let order: string[] | null;
      if (seeded) {
        fields = new Map();
        const reordering = write.reorder !== undefined || write.appendLast !== undefined;
        order = reordering ? nextProjectOrder(readReaderPrefs(data).order, write) : null;
      } else {
        // The seed's input is the view this reader would see UNSEEDED — the same
        // rows, in the same order, `getProjects` would return for them today.
        const excluded = new Set(write.excludeFromSeed ?? []);
        const view = orderProjects(await listProjectRows(), EMPTY_READER_PREFS)
          .filter((project) => !excluded.has(project.id));
        fields = seedFields(view);
        order = nextProjectOrder(view.map((project) => project.id), write);
      }

      for (const patch of write.patches ?? []) collectPatch(fields, patch);

      const { payload, mergeFields } = buildPrefsWrite(fields, order, {
        needed: !seeded,
        stampVersion: !snap.exists(),
      });
      // Nothing to write: a caller asked for no change at all.
      if (mergeFields.length === 0) return;
      // ⚠️ `mergeFields`, ALWAYS. An unmerged set would wipe `laborRates`,
      // `teamPool` and every preference this write does not mention.
      tx.set(settingsRef, payload, { mergeFields });
    });
  }

  // ⚠️ NAMED `impl`, NOT `repo`, DELIBERATELY (v0.37.0).
  // Until v0.36.16 this const was called `repo` — the same identifier as the
  // module-global delegator that the rest of the codebase imported. The eight
  // `impl.getTeamPool()` / `impl.getProjects()` calls in the methods below are
  // and always were SELF-DISPATCH onto this object; this module has never
  // imported the delegator. But two independent readers, working from a grep
  // rather than from the binding, concluded the opposite and wrote it down —
  // one of them in the comment deleted from saveProject's JSDoc below, which
  // asserted these calls went "through the delegating module" and was simply
  // wrong when written. Renaming is the fix: the calls read as self-dispatch
  // now because the name says so.
  const impl: Repository = {
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
      // ⚠️ `stripUndefined` here is one-deep and is a no-op on a well-typed
      // `Settings` (all four fields are required). Keep the pairing in mind
      // rather than the habit: if it ever DID strip a field the mask still
      // names, the write throws INVALID_ARGUMENT — see the mask comment above.
      await setDoc(settingsRef, stripUndefined({
        discountRateAnnual: settings.discountRateAnnual,
        laborRates: settings.laborRates,
        holidays: settings.holidays,
        trafficLightThresholds: settings.trafficLightThresholds,
        schemaVersion: 2,
      }), { mergeFields: SETTINGS_MERGE_FIELDS });
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

    async saveSettingsAndTeamPool(settings: Settings, pool: PoolMember[]): Promise<void> {
      // ONE `setDoc` on ONE document. The team pool is stored inside the
      // settings doc, so single-document write semantics make this atomic —
      // which is the property the caller in C2 depends on: a role rename must
      // land in `laborRates` and in every holding `PoolMember.role` together,
      // or it lands nowhere.
      //
      // ⚠️ NO CALLER UNTIL C2 (2026-09-03) — see `repository.ts` for why this
      // ships ahead of its caller and what to do if C2 does not land.
      await setDoc(settingsRef, stripUndefined({
        discountRateAnnual: settings.discountRateAnnual,
        laborRates: settings.laborRates,
        holidays: settings.holidays,
        trafficLightThresholds: settings.trafficLightThresholds,
        schemaVersion: 2,
        teamPool: pool,
      }), { mergeFields: SETTINGS_AND_POOL_MERGE_FIELDS });
    },

    // ── Projects ──
    async getProjects(): Promise<Project[]> {
      // v0.42.0: the reader's own preferences are read alongside the list, and
      // they decide colour, archive state and order.
      //
      // ⚠️ A FAILED SETTINGS READ IS AN ERROR, NOT "UNSEEDED". `Promise.all`
      // rejects, and the caller reports it exactly as it already reports a failed
      // project query. Treating the failure as "no preferences" would show a
      // seeded reader the document values this release exists to stop showing —
      // and, worse, would let a seed run from them.
      const [rows, settingsSnap] = await Promise.all([
        listProjectRows(),
        getDoc(settingsRef),
      ]);
      const prefs = readReaderPrefs(settingsSnap.exists() ? settingsSnap.data() : undefined);
      const withPrefs = rows.map((row) => {
        const project = applyPrefsToProject(row.value, prefs) as Project & { _memberCount?: number };
        // _memberCount is kept (the dashboard's "Shared" badge reads it).
        project._memberCount = row.memberCount;
        return { ...row, value: project as Project };
      });
      // ⚠️⚠️ NO `_isOwner` HERE, DELIBERATELY (v0.40.0, 2026-09-13), AND A TEST
      // ASSERTS ITS ABSENCE. That test's FAILURE IS THE SIGNAL, not a defect:
      // it fires when someone adds the attach, which is exactly when this needs
      // to become a conversation. Do not delete it as obsolete.
      //
      // TWO reasons, and neither replaces the other:
      //
      //   1. `exportAll` returns this method's output VERBATIM as
      //      `AppState.projects`. Attaching the flag here would put
      //      `_isOwner: true` into every cloud export — a change to the export
      //      FORMAT, not merely an extra in-memory key. (This method does not
      //      PIN that format; `exportAll` is a separate method that merely
      //      calls it. The point is the consequence, not the coupling.)
      //   2. `saveProject` is the only consumer of the flag, and every path
      //      that reaches it sources its project from `getProject`. The
      //      dashboard never saves a project it listed, so the attach would buy
      //      nothing here today.
      //
      // ⚠️ The asymmetry is SAFE ONLY WHILE `effectiveSettings` has no
      // ownership input. If a future release makes an owner read live settings
      // instead of the published card (`DEC-W6` option B), this list and
      // `getProject` would price the SAME project differently — the dashboard
      // tile and the detail page disagreeing about one project's EAC. A test
      // pins that the two paths agree; take that release and you must restore
      // the attach here at the same time.
      //
      // ⚠️ THE ORDER RULE MOVED (v0.42.0) and it is written down once, in
      // `orderProjects`: a seeded reader's `projectOrder` first, then documents
      // by stored `order` (ties by document id), then documents with no usable
      // order by `createdAt`. Until v0.41.0 this was `(a._order ?? 0) - …`, which
      // sorted an order-less document FIRST — and every project created from
      // v0.42.0 on has no stored order, so that default would have put every new
      // project at the top of every dashboard.
      return orderProjects(withPrefs, prefs);
    },

    async getProject(id: string): Promise<Project | null> {
      // v0.42.0: the same overlay as `getProjects`, for the same reason — the
      // detail page, Clone and the per-tile export all read through here, and a
      // reader must see one set of values whichever path they arrive by.
      const [snap, settingsSnap] = await Promise.all([
        getDoc(doc(db!, PROJECTS_COL, id)),
        getDoc(settingsRef),
      ]);
      if (!snap.exists()) return null;
      const data = snap.data();
      const prefs: ReaderPrefs = readReaderPrefs(
        settingsSnap.exists() ? settingsSnap.data() : undefined,
      );
      const project = applyPrefsToProject(
        docToProject(snap.id, data),
        prefs,
      ) as ProjectWithOwnership;
      // v0.40.0 (`DEC-W1`): attach the ownership flag HERE, where `uid` is in
      // the factory closure — NOT in `docToProject`, which takes `(id, data)`
      // and is called from four places. Giving it a required third parameter
      // measured 19 × TS2554.
      //
      // ⚠️ PRESENT-or-ABSENT, never `false`. `saveProject` tests `=== true`.
      //
      // ⚠️ DELIBERATELY NOT DONE IN `getProjects` — see the note there. It is
      // not an oversight and removing this asymmetry has consequences.
      const members = data.members as Record<string, string> | undefined;
      if (members?.[uid] === 'owner') project._isOwner = true;
      return project;
    },

    /**
     * Save mutable project fields to Firestore via explicit mergeFields (v0.31.0 C1).
     *
     * Fields WRITTEN every save (regenerated from current state):
     *   name, startDate, endDate, reforecasts, activeReforecastId,
     *   _teamSnapshot (regenerated from the calling user's current team pool),
     *   updatedAt
     *
     * Fields INTENTIONALLY EXCLUDED (mergeFields omits them; existing Firestore values kept):
     *   owner, members, createdAt, _originRef, _changeLog, schemaVersion
     *   (These live on FirestoreProjectDoc, not on the Project domain type.)
     *
     * ⚠️ `color` and `archived` ARE NO LONGER WRITTEN HERE (v0.42.0). They are
     * per-user preferences now, so a save carries the writer's OWN copy of them
     * nowhere near the shared document. This is what closes the stale-copy
     * defect: a second tab, the detail page's debounce, or one Ctrl+Z used to
     * rewrite both fields for every member of the project.
     *
     * The exclusion of createdAt, _originRef, owner, members, and order is
     * load-bearing for the v0.30.0 import 'replace' path: applyImportMerge calls
     * saveProject for 'replace' decisions and relies on merge: true to preserve
     * identity fields from the existing document. Do NOT add any of those fields
     * to this write payload without auditing the import path for regressions.

     */
    async saveProject(project: Project): Promise<void> {
      // v0.40.0: ONE raw read of the settings document, serving BOTH the team
      // pool and the owner's rate card.
      //
      // ⚠️⚠️ THIS REPLACED `await impl.getTeamPool()` RATHER THAN ADDING TO IT,
      // and that is what makes the writer cost +0 round-trips: `getTeamPool` is
      // itself `getDoc(settingsRef)`, and `teamPool` lives in the same document
      // as `laborRates`. Calling `getTeamPool()` and then reading the card
      // separately would be two reads of one document on every save.
      //
      // ⚠️ THE COST: `saveProject` no longer follows a future change to
      // `getTeamPool`. That coupling loss is deliberate and is PINNED rather
      // than argued — a test asserts this derivation equals `getTeamPool()`'s
      // output for the same document, including the absent-document case,
      // because "they are behaviourally identical today" is the kind of claim
      // that decays silently.
      const settingsSnap = await getDoc(settingsRef);
      const settingsData = settingsSnap.exists() ? settingsSnap.data() : undefined;
      const pool = ((settingsData?.teamPool as PoolMember[]) ?? []);
      const now = new Date().toISOString();

      // v0.40.0 (`DEC-W4`): the owner republishes their cost card on every save.
      //
      // ⚠️⚠️ BOTH THE PAYLOAD AND THE MASK DERIVE FROM THE RESOLVED SNAPSHOT,
      // NEVER FROM `isOwner`. There are THREE states, not two: not owner →
      // seven fields; owner WITH a usable card → eight; owner WITHOUT one →
      // seven. Keying the mask on ownership instead would give an owner with no
      // saved rates an eight-field mask over a seven-key payload, which Firestore rejects
      // with INVALID_ARGUMENT — a mask entry absent from the data is the LOUD
      // direction (see the mask comment above), so every save would throw.
      const ownerSnapshot = (project as ProjectWithOwnership)._isOwner === true
        ? resolveOwnerCostSnapshot(settingsData)
        : undefined;

      // v0.31.0 (C1): explicit mergeFields instead of merge:true. The
      // listed fields are the only ones written every save; ownership /
      // identity fields (owner, members, createdAt, _originRef,
      // _changeLog, schemaVersion) are intentionally excluded so the
      // existing Firestore values are preserved (load-bearing for the
      // v0.30.0 import 'replace' path — see JSDoc above).
      await setDoc(doc(db!, PROJECTS_COL, project.id), stripUndefined({
        name: project.name,
        startDate: project.startDate,
        endDate: project.endDate,
        reforecasts: project.reforecasts,
        activeReforecastId: project.activeReforecastId,
        _teamSnapshot: buildProjectTeamSnapshot(project, pool),
        updatedAt: now,
        // Absent (not null) when there is nothing to publish: `stripUndefined`
        // removes it, so the payload carries seven keys and the seven-field mask
        // below leaves any stored card untouched. A `null` here would be a
        // PRESENT key and would UNSET the card — the opposite of refusing.
        ...(ownerSnapshot ? { _costSnapshot: ownerSnapshot } : {}),
      }), {
        mergeFields: ownerSnapshot
          ? SAVE_PROJECT_OWNER_MERGE_FIELDS
          : SAVE_PROJECT_MERGE_FIELDS,
      });
    },

    /**
     * Create a new project with ownership fields.
     * Only used for brand-new projects — sets owner and members.
     */
    async createProject(project: Project): Promise<void> {
      const pool = await impl.getTeamPool();
      const now = new Date().toISOString();
      // ⚠️ NO `impl.getProjects()` HERE (v0.42.0). It existed for ONE purpose —
      // `order: projects.length` — and `order` is no longer a document field, so
      // the read is gone with it. A new project now sorts last for every reader
      // by the read rule in `getProjects` (no stored `order` → after the ordered
      // ones, by `createdAt`), which is where placement belongs now that each
      // reader has their own order.
      const docData: FirestoreProjectDoc = {
        name: project.name,
        startDate: project.startDate,
        endDate: project.endDate,
        reforecasts: project.reforecasts,
        activeReforecastId: project.activeReforecastId,
        owner: uid,
        members: { [uid]: 'owner' },
        _teamSnapshot: buildProjectTeamSnapshot(project, pool),
        // v0.39.0: written as an explicit null, never invented here. This
        // path has no business deciding what a project was costed with —
        // the writer is v0.40.0, an owner-only refresh at saveProject.
        // The null is not ceremonial: it makes the key PRESENT in the
        // payload, which is what exercises the spert-landing v2.5.38
        // allowlist entry with a real write.
        _costSnapshot: null,
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
      // ⚠️ ZERO PROJECT-DOCUMENT WRITES SINCE v0.42.0, and that is the whole
      // change. This used to be one `writeBatch` of `{order: index}` over EVERY
      // project on the dragger's dashboard — so an editor's drag rewrote the
      // order inside documents belonging to other people, scrambling their
      // dashboards; and a VIEWER on any one of those projects had the whole
      // batch refused, which meant they could not reorder their own dashboard at
      // all. The order is now one array in the reader's own settings document.
      //
      // ⚠️ READ-MODIFY-WRITE, which is what the interface contract requires: ids
      // the caller did not hand us keep their existing relative order rather than
      // vanishing. `nextProjectOrder` does that; a plain `projectOrder =
      // orderedIds` would silently drop every project a stale caller had not
      // seen.
      await runPrefsTransaction({ reorder: orderedIds });
    },

    async writeProjectPrefs(patches: ProjectPrefPatch[]): Promise<void> {
      // A patch with neither key asks for nothing; filtering them here keeps the
      // "a write always writes" rule below honest.
      const meaningful = patches.filter(
        (patch) => patch.color !== undefined || patch.archived !== undefined,
      );
      if (meaningful.length === 0) return;
      // ⚠️ NO EXISTENCE CHECK, DELIBERATELY. An entry for a project that is no
      // longer listed is inert — the reader ignores unknown ids, exactly as it
      // ignores unknown ids in `projectOrder` — and checking would cost a list
      // query on every colour click. Checking INSIDE the transaction is not an
      // option either: a `get` of a deleted project document is DENIED by the
      // rules (they dereference `resource.data`), which would abort the whole
      // transaction with a permission error.
      await runPrefsTransaction({ patches: meaningful });
    },

    async ensureProjectPrefsSeeded(): Promise<void> {
      // Fast path: one read, no transaction, for the overwhelmingly common case
      // of an already-seeded reader. The transaction below re-checks the marker,
      // and THAT check is the authority.
      const snap = await getDoc(settingsRef);
      if (isSeeded(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined)) return;
      await runPrefsTransaction({ seedOnly: true });
    },

    // ── Export/Import ──
    async exportAll(): Promise<AppState> {
      const settings = await impl.getSettings();
      const teamPool = await impl.getTeamPool();
      const projects = await impl.getProjects();

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
      await impl.saveSettings(state.settings);
      await impl.saveTeamPool(state.teamPool);

      // Full replace for each project (no merge — import overwrites entirely)
      const pool = state.teamPool;
      const now = new Date().toISOString();

      // The RESULTING document ids, in local order — what the preference write
      // below keys off. ⚠️ NOT the local ids: `targetId` is regenerated whenever
      // the existence check does not find a document this user is a member of,
      // and a `get` of a document that does not exist is DENIED by the rules, so
      // a FIRST upload regenerates EVERY id. Keying preferences off the file's
      // ids would leave every one of them orphaned.
      const uploaded: { id: string; project: Project }[] = [];

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
          owner: uid,
          members: { [uid]: 'owner' },
          _teamSnapshot: buildProjectTeamSnapshot(project, pool),
          // v0.39.0: written as an explicit null, never invented here. This
          // path has no business deciding what a project was costed with —
          // the writer is v0.40.0, an owner-only refresh at saveProject.
          // The null is not ceremonial: it makes the key PRESENT in the
          // payload, which is what exercises the spert-landing v2.5.38
          // allowlist entry with a real write.
          _costSnapshot: null,
          _originRef: state._originRef ?? uid,
          _changeLog: state._changeLog ?? [],
          createdAt: now,
          updatedAt: now,
          schemaVersion: 2,
        };

        // Full setDoc (no merge) for imports — old fields are replaced entirely
        await setDoc(doc(db!, PROJECTS_COL, targetId), stripUndefined(docData));
        uploaded.push({ id: targetId, project });
      }

      // v0.42.0: the uploader's own colour, archive state and local order move
      // into THEIR preferences — the documents no longer carry any of it.
      //
      // ⚠️ EXACT, NOT "WHEN PRESENT": a local project with no colour CLEARS any
      // colour the uploader had for that id, mirroring the full document replace
      // above. The upload is the local copy asserting itself.
      //
      // ⚠️ THIS IS ALSO THE SEED for a first-time cloud user, in the same
      // transaction — and its view EXCLUDES the ids just uploaded, so they are
      // placed by `appendLast` in local order rather than by the accident of
      // document id that a shared `createdAt` would give them.
      if (uploaded.length > 0) {
        await runPrefsTransaction({
          patches: uploaded.map(({ id, project }) => ({
            id,
            color: project.color ?? null,
            archived: project.archived === true ? true : null,
          })),
          appendLast: uploaded.map(({ id }) => id),
          excludeFromSeed: uploaded.map(({ id }) => id),
        });
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
      // ⚠️ This lists by `owner` alone, and firestore.rules keeps a DISJUNCTIVE
      // list rule on this collection — members[uid] in [...] || owner == uid —
      // specifically so this query is permitted. Narrowing that rule to the plain
      // members form the other apps use would make this return PERMISSION_DENIED
      // and clear() would silently delete nothing.
      // ⚠️ Pinned by rules-tests/project-collections-list.test.ts in the
      // spert-landing-page repo (`npm run test:rules`), which encodes this query AS
      // WRITTEN and lives in a DIFFERENT repository — it will NOT fail when you
      // edit this line.
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
      // before data reaches Firestore. No-op for the cloud repository.
    },
  };

  return impl;
}
