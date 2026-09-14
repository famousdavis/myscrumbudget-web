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
import type {
  Settings, PoolMember, Project, ProjectColor, AppState, CostSnapshot,
} from '@/types/domain';
import { DEFAULT_SETTINGS } from './localStorage';
import { DATA_VERSION } from './migrations';
import type { ChangeLogEntry } from './fingerprint';
import {
  getChangeLog, getExportAttribution,
  setOriginRef, setChangeLog,
} from './fingerprint';
import { buildProjectTeamSnapshot, stripUndefined, docToProject } from './firestoreUtils';
import type { ProjectWithOwnership } from '@/lib/utils/costSnapshot';

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
  /**
   * Cost inputs the project was costed with (v0.39.0). null when absent, so
   * mergeFields can unset it — same shape as `color`/`archived`.
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

export const SAVE_PROJECT_MERGE_FIELDS = Object.keys(SAVE_PROJECT_MERGE_SET);

/**
 * The ONE extra field an owner's save adds (v0.40.0), as its own
 * `satisfies`-guarded set.
 *
 * ⚠️⚠️ THE SHAPE IS THE POINT, AND THE OBVIOUS ALTERNATIVE IS A SILENT TRAP.
 * The rule this release implements — "not owner → nine; owner with a usable
 * rate card → ten; owner WITHOUT one → nine" — is satisfied literally by:
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
 * `Object.keys` of the payload yields the same nine strings in the same order,
 * so the two are equal by value.
 *
 * ⚠️ `SAVE_PROJECT_MERGE_SET` itself is UNCHANGED, so the nine-element order
 * pin above is untouched by construction.
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
}

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
type SettingsWriteField = Exclude<keyof FirestoreSettingsDoc, 'teamPool'>;

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
} satisfies Record<keyof FirestoreSettingsDoc, true>;

const SETTINGS_MERGE_FIELDS = Object.keys(SETTINGS_MERGE_SET);
const SETTINGS_AND_POOL_MERGE_FIELDS = Object.keys(SETTINGS_AND_POOL_MERGE_SET);

export function createFirestoreRepository(uid: string): Repository {
  if (!db) throw new Error('Firestore is not initialized');

  const settingsRef = doc(db, SETTINGS_COL, uid);

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
      // ⚠️ This filter's SHAPE is a security boundary, not a convenience.
      // firestore.rules constrains `list` on this collection to
      // members[request.auth.uid] in ['owner', 'editor', 'viewer'], and Firestore
      // permits a list query ONLY when its filter PROVES that constraint. Drop or
      // change this filter and you do not get more rows — you get
      // PERMISSION_DENIED, and no project loads at all.
      // Until 2026-08-19 the rule was `allow list: if isAuth()`, which let any
      // signed-in SPERT user read every project in this collection.
      // ⚠️ The rule and this query are pinned together by
      // rules-tests/project-collections-list.test.ts in the spert-landing-page
      // repo (`npm run test:rules`). That test encodes this query AS WRITTEN and
      // lives in a DIFFERENT repository, so it will NOT fail when you edit this
      // line. Change one, change the other.
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
      const data = snap.data();
      const project = docToProject(snap.id, data) as ProjectWithOwnership;
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
      // nine fields; owner WITH a usable card → ten; owner WITHOUT one → nine.
      // Keying the mask on ownership instead would give an owner with no saved
      // rates a ten-field mask over a nine-key payload, which Firestore rejects
      // with INVALID_ARGUMENT — a mask entry absent from the data is the LOUD
      // direction (see the mask comment above), so every save would throw.
      const ownerSnapshot = (project as ProjectWithOwnership)._isOwner === true
        ? resolveOwnerCostSnapshot(settingsData)
        : undefined;

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
        _teamSnapshot: buildProjectTeamSnapshot(project, pool),
        updatedAt: now,
        // Absent (not null) when there is nothing to publish: `stripUndefined`
        // removes it, so the payload carries nine keys and the nine-field mask
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
      const projects = await impl.getProjects();

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
      // ⚠️ UNCHANGED by v0.37.12 — deletion is structurally impossible here, and
      // end-placement already falls out of `order: projects.length` + the sort in
      // `getProjects`. But note the MIRROR-IMAGE failure, which that fix does NOT
      // close: `batch.update` carries `Precondition.exists(true)`, so an
      // `orderedIds` naming a project deleted in another tab rejects the batch
      // WHOLE — nothing is reordered, the hook's optimistic update has already
      // been applied, and the rejection is unhandled. Cloud's window is narrower
      // than local's because the onSnapshot listener reloads the stale tab.
      const batch = writeBatch(db!);
      orderedIds.forEach((id, index) => {
        batch.update(doc(db!, PROJECTS_COL, id), { order: index });
      });
      await batch.commit();
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
