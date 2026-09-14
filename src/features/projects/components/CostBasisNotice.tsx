// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import type { Project, Settings, TeamMember } from '@/types/domain';
import type { ProjectWithOwnership } from '@/lib/utils/costSnapshot';
import { effectiveLaborRates, roleHasNoRate } from '@/lib/utils/costSnapshot';
import { useRepository } from '@/components/RepositoryProvider';

interface CostBasisNoticeProps {
  project: Project;
  /** Nullable on purpose — the detail page discards `useSettings`' `loading`. */
  settings: Settings | null;
  /** The roster the allocation grid renders from, NOT the global team pool. */
  members: TeamMember[];
}

/**
 * Should the "no published rate card" line show? (v0.41.0, item 2)
 *
 * ⚠️⚠️ THE FIRST CHECK IS A PRECONDITION, NOT A THIRD PARALLEL CONDITION, AND
 * WRITING IT AS ONE MORE `&&` IS HOW SOMEONE DELETES TWO GUARANTEES AT ONCE.
 * Both mechanisms below exist ONLY on the cloud read path: `sanitizeCostSnapshot`
 * is called at exactly one site (`firestoreUtils.ts`, inside `docToProject`), and
 * the `_isOwner` attach lives in `firestoreRepo.getProject` alone.
 *
 * MEASURED 2026-09-14, and it is worse than "meaningless without it": in LOCAL
 * mode nothing ever attaches `_isOwner`, so `_isOwner !== true` is not merely
 * unhelpful — it is INERT, true for every local reader INCLUDING the sole owner.
 * And no local project carries a `_costSnapshot` (nothing writes one locally and
 * `sanitizeImport` strips it on ingest). Both conditions below are therefore
 * VACUOUSLY TRUE in local mode, so a reader who relaxes "why not local mode
 * too?" does not widen the line — they make it fire on every local project
 * forever, with both of its safety arguments already gone.
 *
 * ⚠️⚠️ `isCloud`, NOT `getStorageMode() === 'cloud'` — AND THE DIFFERENCE IS A
 * DEFECT THE BROWSER FOUND IN THIS COMPONENT'S FIRST BUILD, 2026-09-14. The
 * brief specified the storage-mode read, and it is a WEAKER PROXY than the app's
 * own notion of being in the cloud. `RepositoryProvider` derives
 * `isCloud = mode === 'cloud' && uid !== null`, and serves the LOCALSTORAGE
 * repository whenever `uid` is null — so in the reachable state "mode is still
 * cloud, nobody is signed in" (a session that expired or was ended in another
 * tab, before the cleanup that resets the mode has run) every project is read
 * from localStorage, carries no `_costSnapshot` and no `_isOwner`, and the
 * storage-mode gate lets all three conditions through.
 *
 * MEASURED on `next start`: with `msb:storageMode = 'cloud'` and no signed-in
 * user, the first build rendered this line on a purely local project. That is
 * B3's wrong build — "fires on every local project" — reached through a door the
 * mode gate does not cover. `isCloud` closes it, and it can only ever show the
 * line LESS often.
 *
 * ⚠️ IT ALSO REMOVES A HAZARD RATHER THAN MERELY RELOCATING ONE. The storage-mode
 * read happened during render and returns 'local' on the server against 'cloud'
 * on the client — the v0.36.2 `FirstRunBanner` React #418 class, which was safe
 * here only by NESTING (inside `MigrationGuard`, which renders `null` on the
 * server and on the client's first render). `BulkSharingSection.tsx:47` still
 * relies on exactly that accident. Taking the value from context inherits
 * `RepositoryProvider`'s single, already-made decision instead of making a
 * second independent one.
 */
function showsNoPublishedCardLine(project: Project, isCloud: boolean): boolean {
  if (!isCloud) return false;
  // A reader who is NOT the owner proves the project is shared: the Firestore
  // rules require membership to read it and owner to create it, so a non-owner
  // reader cannot be looking at a solo project. That is why no separate
  // member-count check is needed — and why it only holds under the precondition
  // above, since the flag is attached on the cloud read path only.
  if ((project as ProjectWithOwnership)._isOwner === true) return false;
  // Absent / null / malformed all collapse to `undefined` here: the sanitizer
  // hydrates only a snapshot that validates. A card REJECTED by the sanitizer
  // therefore also reads as "no published rate card" — true in effect, and
  // distinguishing it would need a second storage read.
  return project._costSnapshot === undefined;
}

/**
 * The two read-only cost-basis signals shown beside the allocation grid
 * (v0.41.0). Renders nothing at all when neither applies.
 *
 * ⚠️⚠️ THE TWO LINES SHIP TOGETHER AND SAY ONE THING — DO NOT SPLIT THEM ACROSS
 * TWO CALL SITES OR GATE ONE WITHOUT THE OTHER. `effectiveLaborRates` falls back
 * to the READER's own settings when a project carries no published card, so in
 * that state the unpriced count stops describing the PROJECT and starts
 * describing the reader. Measured: same project, same roster [BA, Dev, Ops], no
 * card — reader A (BA+Dev) counts 1, reader B (BA only) counts 2. Two
 * collaborators, one project, different numbers, both correct.
 *
 * Item 1 alone in that state points the reader at the wrong fix: they go and
 * edit role names when the actionable fact is "this project has no published
 * card." Item 2's line is what frames it. That composition is the only reason
 * item 1 is safe to show on a card-less project at all, and it is guarded by a
 * single assertion (row A5's second duty) — see `__tests__/CostBasisNotice.test.tsx`.
 *
 * ⚠️ READ-ONLY AND INFORMATIONAL. Nothing here writes, and nothing here feeds a
 * number: `calculateProjectMetrics` resolves `effectiveSettings` INSIDE itself
 * (`calc/index.ts:42`), so an aggregate computed out here cannot reach the
 * arithmetic.
 */
export function CostBasisNotice({ project, settings, members }: CostBasisNoticeProps) {
  const { isCloud } = useRepository();
  const laborRates = effectiveLaborRates(project, settings);

  /*
   * ⚠️ Counted against `effectiveLaborRates`, NEVER against `settings.laborRates`.
   * On a carded project the rates that matter are the OWNER's, and reading the
   * reader's own settings here would report 0 unpriced roles while the grid
   * beside it renders red markers on the same members.
   *
   * ⚠️ `laborRates === undefined` means "not loaded yet", and `roleHasNoRate`
   * returns false for every role in that state, so this is 0 on the first render
   * and the component is absent. Do not add `?? []`.
   *
   * ⚠️ BOUND, stated because it is reachable and unfixed: a roster entry the
   * reader's pool and the project's `_teamSnapshot` both fail to resolve gets
   * `{ name: '(Unknown)', role: '' }` (`teamResolution.ts:39-40`), and an empty
   * role matches no rate, so it is counted here. That is TRUE about the cost —
   * it really is $0 — but its cause is an unresolved assignment, not a missing
   * rate. It is counted anyway, deliberately: the grid's per-row marker makes
   * the identical claim about the identical member, and an aggregate that
   * disagreed with the markers beside it would be worse than one that inherits
   * their bound. v0.38.2's standing residual, not this release's.
   */
  const unpricedCount = members.filter((m) => roleHasNoRate(m.role, laborRates)).length;

  /*
   * ⚠️⚠️ SUPPRESSION — the owner's ruling, 2026-09-14. A PUBLISHED card whose
   * labor rates are all unusable arrives here as `laborRates: []`, which makes
   * EVERY role unpriced, so the count would be the whole roster with no frame:
   * item 2 is correctly silent (a card IS present) and item 1 would be maximal
   * and unexplained. Item 1 stays silent too, and the honest thing on screen is
   * the per-row red markers, which fire on every row in exactly this state.
   *
   * REACHABLE, and the code documents it: `sanitizeCostSnapshot`'s element-drop
   * rule (`firestoreUtils.ts:150-156`) PRODUCES an empty array on READ from a
   * card written non-empty. Measured through `docToProject`, not just the
   * sanitizer. (`DEC-W2` refuses to PUBLISH an empty card, which is a different
   * rule about a different path — do not use it to conclude this is unreachable.)
   *
   * ⚠️⚠️ THE FIRST CLAUSE IS LOAD-BEARING AND IT IS NOT REDUNDANT. A reader whose
   * OWN rate table is empty (`RateTable.confirmDelete` has no last-row guard, so
   * it is reachable) ALSO yields an empty basis and the same maximal count on a
   * card-LESS project — but THERE item 2 fires and frames it, so item 1 must NOT
   * be suppressed. Two states, the same count, opposite handling; only the card
   * tells them apart. Row A7 refuses the one-clause form and nothing else does.
   *
   * ⚠️ UNPINNED, stated so nobody reads the spelling as load-bearing: under the
   * first clause, `effectiveLaborRates(...)` and `project._costSnapshot.laborRates`
   * are the same value — `CostSnapshot.laborRates` is required and `[] ?? x` is
   * `[]`, so the `??` never falls through. Measured identical across five states.
   * NO TEST CAN DISCRIMINATE THE TWO SPELLINGS. If `laborRates` ever becomes
   * optional on `CostSnapshot`, they diverge and this needs rewriting.
   *
   * ⚠️⚠️ AND THE RULING'S JUSTIFICATION IS CONDITIONAL ON THE COPY BELOW. "The
   * per-row markers already fire, so silence is honest" holds only while item 1's
   * sentence says nothing the markers do not. If anyone makes it card-aware —
   * "the published card prices none of your roles" — then suppressing it hides
   * the ONE place that fact appears, and this rule becomes wrong. Revisit here,
   * not at the copy.
   */
  const cardPublishedWithNoUsableRates =
    project._costSnapshot !== undefined && effectiveLaborRates(project, settings)?.length === 0;

  const showUnpriced = unpricedCount > 0 && !cardPublishedWithNoUsableRates;
  const showNoCard = showsNoPublishedCardLine(project, isCloud);

  if (!showUnpriced && !showNoCard) return null;

  return (
    <div role="status" className="mb-2 space-y-1">
      {showUnpriced && (
        /*
         * ⚠️ NO ACTION HINT, DELIBERATELY. On a CARDED project the missing rate
         * is in the OWNER's card, so "add a rate in Settings" would be false for
         * a collaborator — they cannot fix it there. The sentence states the
         * fact and nothing else, which is true in every cell of the grid.
         *
         * ⚠️ BOTH NUMBER FORMS ARE PINNED BY EXACT-STRING ASSERTIONS. v0.38.0
         * shipped "1 unreadable entry was left out because THEY could not be
         * read" past a `toContain` that stopped before the disagreement.
         */
        <p
          data-signal="unpriced-roles"
          className="text-xs text-amber-600 dark:text-amber-400"
        >
          {unpricedCount === 1
            ? "1 team member's role has no labor rate, so they are costed at $0."
            : `${unpricedCount} team members' roles have no labor rate, so they are costed at $0.`}
        </p>
      )}
      {showNoCard && (
        <p
          data-signal="no-rate-card"
          className="text-xs text-zinc-500 dark:text-zinc-400"
        >
          This project has no published rate card, so you are seeing your own rates.
        </p>
      )}
    </div>
  );
}
