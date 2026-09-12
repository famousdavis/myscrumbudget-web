// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { INVITATIONS_ENABLED } from '@/lib/featureFlags';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import { useRepository } from '@/components/RepositoryProvider';
import { setHasUploaded } from '@/lib/storage/cloudFlipHelpers';
import { setOriginRef } from '@/lib/storage/fingerprint';
import { mapInvitationError } from '@/lib/firebase/invitations';
import {
  INVITE_CLAIM_SETTLED_EVENT,
  spertAppDisplayName,
  type ClaimPendingInvitationsResult,
  type InviteClaimSettledDetail,
} from '@/lib/firebase/invitation-types';

export const INVITE_SESSION_KEY = 'msb:invite-session';

/**
 * Captures `?invite=` synchronously at module-import time.
 *
 * Required because MigrationGuard returns null while !ready, blocking
 * InvitationBanner from mounting before useSearchParams() could fire.
 * The banner needs to know the user arrived via an invite link before
 * the first React lifecycle event runs.
 *
 * Exported for testability: tests set window.location, call this
 * function (with explicit `enabled` param to avoid module-mocking),
 * then assert sessionStorage state.
 *
 * The optional `enabled` parameter defaults to INVITATIONS_ENABLED.
 * Module-load auto-call uses the real flag value; tests pass true/false
 * explicitly to avoid ES module binding fragility.
 */
/**
 * COVERAGE DISPOSITION — DECLINED 2026-08-16, RE-OPENED 2026-09-12 BY A SHIPPED
 * DEFECT, which is one of the three reasons the decline below named as
 * sufficient. The hook is now characterised in
 * `src/hooks/__tests__/useInvitationLanding.hook.test.tsx` (v0.38.1). The
 * decline record is kept unedited beneath this paragraph as history: its
 * measurement was correct, its band was correct, and the reason it re-opened
 * is exactly the reason it said would count. What it over-stated is the cost —
 * the hook never calls the Cloud Function, it consumes window events, so the
 * "CF mock that does not exist" was never required here; the callable mock in
 * `claimPendingInvitations.test.ts` already existed, and the genuine gap was
 * that nothing pinned the dispatched event to the consumed one.
 *
 * DECISION: characterising this hook was measured, scoped, and declined by the
 * owner on 2026-08-16. It was closed on measured grounds, not abandoned for
 * time. Zero was never the target: an informed decline is a permitted outcome
 * for any individual site, and this is one. Do not re-open it as outstanding
 * work without a NEW reason — a changed figure, a shipped defect, or a change
 * of scope. Re-deriving the numbers below and finding them unchanged is not a
 * new reason.
 *
 * BAND: effectively greenfield. This hook is NOT partially covered in any
 * useful sense — the single covered function is the sibling exported helper
 * `captureInviteTokenFromUrl` below; the hook itself and all of its internal
 * callbacks are at zero. Characterising it is from-scratch construction, not a
 * top-up, and it needs the invitation Cloud-Function surface stood up in a
 * mock. The band is what matters here; the exact percentage is not.
 *
 * MEASURED 2026-08-16 at df648a2:
 *   npx vitest run --coverage --coverage.include='src/**\/*.{ts,tsx}' \
 *     --coverage.reporter=json-summary
 *   useInvitationLanding.ts   13/90 statements (77 uncovered) · 6/45 branches ·
 *                             1/16 functions
 *   Together with AuthProvider.tsx: 119 uncovered statements, 88% of the size
 *   of the BulkSharingSection work that shipped in v0.36.13.
 *
 * ⚠️ Those figures re-derived UNCHANGED from the 2026-08-15 scoping measurement,
 * so they are stable rather than freshly volatile. The trigger for re-measuring
 * is a change to this file (2 commits at the time of writing), not the passage
 * of time.
 *
 * ⚠️ This file is NOT in the never-loaded set and never was — it is imported and
 * its module scope runs, which is why it reads 13 statements rather than 0.
 * Covering it would not move that census figure (51 of 152 at df648a2).
 */
export function captureInviteTokenFromUrl(enabled: boolean = INVITATIONS_ENABLED): void {
  if (!enabled) return;                       // gate — no poison pill during flag-off
  if (typeof window === 'undefined') return;  // SSR/edge
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('invite');
    if (!token) return;
    sessionStorage.setItem(INVITE_SESSION_KEY, token);
    url.searchParams.delete('invite');
    // replaceState (not pushState) — back button does not return to ?invite= URL.
    // Stripped URL is canonical; token is stored in sessionStorage.
    // replaceState does NOT notify Next.js's router, but Step 0k confirmed no
    // useSearchParams consumers read the 'invite' param.
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  } catch { /* SSR/edge — no-op */ }
}

// Module-load auto-call. Runs once when the client bundle evaluates this module.
captureInviteTokenFromUrl();

export type InviteLandingState =
  | 'idle'
  | 'pre_auth'
  | 'claiming'
  | 'claimed'
  | 'claimed_elsewhere'
  | 'failed';

interface UseInvitationLandingResult {
  state: InviteLandingState;
  claimedNames: string[];
  /** Display names of the apps a cross-app claim landed in ('claimed_elsewhere'). */
  claimedElsewhereApps: string[];
  /** Copy for the 'failed' state; null in every other state. */
  failureMessage: string | null;
  dismiss: () => void;
}

/**
 * v0.38.1 — the three 'failed' copies, exported so tests pin the STRING a
 * student reads rather than a substring that three different messages share.
 * Each is built from the claim callable's settlement and nothing else; none
 * reads the invitation document (WI-2 PC4).
 */
export const CLAIM_TIMEOUT_MESSAGE =
  "We couldn't confirm your invitation. Check your connection, then open the link from your invitation email to try again.";

export function claimNoneMessage(email: string | null): string {
  const who = email ? email : 'the account you signed in with';
  return `No pending invitation was found for ${who}. Check that this is the address the invitation was sent to, or ask the project owner to send a new one.`;
}

/**
 * Turns a settlement into the copy for the 'failed' state.
 *   null            → the 30-second timer fired with NO settlement (the CF was
 *                     never reached, or never answered)
 *   outcome 'none'  → the CF answered and found nothing for this email
 *   outcome 'error' → the CF rejected; mapped by code, never by message text
 */
export function describeClaimFailure(settled: InviteClaimSettledDetail | null): string {
  if (settled === null) return CLAIM_TIMEOUT_MESSAGE;
  if (settled.outcome === 'none') return claimNoneMessage(settled.email);
  return mapInvitationError({ code: settled.code }, 'claim');
}

/**
 * Drives the InvitationBanner state machine.
 *
 * State transitions:
 *   idle      → pre_auth           (lazy init: SESSION_KEY present on mount)
 *   pre_auth  → claiming           (Effect 3: user becomes non-null)
 *   claiming  → claimed            (Effect 5: spert:models-changed with MSB items)
 *   claiming  → claimed_elsewhere  (Effect 5: spert:models-changed with items, none MSB)
 *   claiming  → failed             (Effect 6: the claim SETTLED — rejected, or
 *                                   resolved with no rows; copy from the settlement)
 *   claiming  → failed             (Effect 4: 30s timer fires with no settlement)
 *   any       → idle               (dismiss())
 *
 * SESSION_KEY consumption:
 *   - Removed on 'claimed' / 'claimed_elsewhere' (Effect 5)
 *   - Removed on 'failed' via settlement (Effect 6) and via auto-fail (Effect 4)
 *   - Removed on dismiss() (any state)
 *
 * Page reload after dismissal or any failure does NOT re-show the banner.
 * Retry path: user re-clicks the email link (IIFE sets a new SESSION_KEY),
 * and every failure copy says so. The key is consumed on EVERY settled
 * outcome deliberately — a kept key would let a later, unrelated
 * `spert:models-changed` in the same tab raise a banner for this token.
 */
export function useInvitationLanding(): UseInvitationLandingResult {
  const { mode, switchMode } = useRepository();
  const { user } = useAuth();

  // Lazy initial state — folds the old Effect 1 (SESSION_KEY check on mount)
  // into the state initializer so we don't trip the react-hooks/set-state-in-effect
  // lint rule. SSR returns 'idle' (no window). On the client, if a SESSION_KEY
  // was set by the IIFE captureInviteTokenFromUrl(), start in 'pre_auth'.
  const [state, setState] = useState<InviteLandingState>(() => {
    if (typeof window === 'undefined') return 'idle';
    if (!INVITATIONS_ENABLED) return 'idle';
    try {
      return sessionStorage.getItem(INVITE_SESSION_KEY) ? 'pre_auth' : 'idle';
    } catch { return 'idle'; }
  });
  const [claimedNames, setClaimedNames] = useState<string[]>([]);
  const [claimedElsewhereApps, setClaimedElsewhereApps] = useState<string[]>([]);
  // The claim's settlement, when one arrived. null in 'failed' means the
  // timer fired first. Copy is derived at render (describeClaimFailure), so no
  // handler closes over anything but stable setters (Lesson 27).
  const [settled, setSettled] = useState<InviteClaimSettledDetail | null>(null);

  // ---- (Effect 1 was the SESSION_KEY check; folded into the lazy initial
  //       state above to avoid setState-in-effect.) -------------------------

  // ---- Effect 2: Storage mode auto-flip (one-shot per mount) ---------------
  // React strict-mode dev double-mount recreates refs, so flipAttemptedRef is
  // false on each actual mount. One flip attempt per real page load. Correct.
  const flipAttemptedRef = useRef(false);
  useEffect(() => {
    if (flipAttemptedRef.current) return;
    if (!INVITATIONS_ENABLED) return;
    if (!sessionStorage.getItem(INVITE_SESSION_KEY)) return;
    if (!user) return;
    flipAttemptedRef.current = true;
    void (async () => {
      try {
        // Always read LOCAL storage here — the active repository may be
        // Firestore for cloud-mode users. The Lesson 28 gate is specifically
        // about LOCAL unsynced data.
        const localProjectCount = (await createLocalStorageRepository().getProjects()).length;
        if (localProjectCount === 0 && mode !== 'cloud') {
          // ⚠️ This is the ONLY flip that does not reload — the banner state
          // machine must stay alive. Before v0.37.0 that made it the only path
          // where cloud writes actually reached Firestore, because every other
          // path reloaded away the module global it had just set. It is no
          // longer special: switchMode re-derives the repository for every
          // path, reload or not.
          switchMode('cloud');
          setHasUploaded();        // suppress repeated "switch to cloud?" prompts
          setOriginRef(user.uid);  // changelog origin fingerprint
        }
        // localProjectCount > 0: banner 'claimed' copy will instruct the user
        // to flip via Settings to preserve their existing local data.
      } catch (e) {
        // v0.28.2 (L2): explicit SESSION_KEY cleanup on cloud-flip failure.
        // Previously the 30s timer was the only path to clear it on this
        // branch; now we drop it immediately so the banner does not linger
        // in 'pre_auth' beyond the recoverable failure. log only the code.
        try { sessionStorage.removeItem(INVITE_SESSION_KEY); } catch {}
        console.warn(
          '[useInvitationLanding] storage flip failed:',
          (e as { code?: string })?.code ?? 'unknown',
        );
      }
    })();
  }, [user, mode, switchMode]);

  // ---- Effect 2b: SESSION_KEY cleanup on sign-out mid-claim (v0.28.2 / L3) -
  // If `user` becomes null while we are in 'claiming' (sign-out, token
  // expiry, refresh failure), clear the stale invite token and reset the
  // state machine. Without this, the 30s timer is the only path to fail-
  // out, and a subsequent sign-in within 30s could re-enter the flow with
  // user A's token. Same state-machine-transition exception as Effect 3.
  useEffect(() => {
    if (state !== 'claiming') return;
    if (user) return;
    try { sessionStorage.removeItem(INVITE_SESSION_KEY); } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state machine transition
    setState('idle');
  }, [state, user]);

  // ---- Effect 3: pre_auth → claiming when user resolves --------------------
  // Legitimate state-machine edge: when user becomes non-null while in
  // 'pre_auth', advance to 'claiming'. This is a discrete transition, not
  // the cascading-render anti-pattern the lint rule guards against.
  useEffect(() => {
    if (state !== 'pre_auth') return;
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state machine transition
    setState('claiming');
  }, [state, user]);

  // ---- Effect 4: 30-second grace timer ------------------------------------
  // Since v0.38.1 this is the path of LAST resort, not the failure channel:
  // every answer the CF gives — rows, no rows, or a rejection — settles the
  // banner through Effect 5 or Effect 6 within one round trip. The timer
  // fires only when no answer arrived at all (Firebase not initialised, the
  // kill switch off, or a call that never returned), and its copy says that
  // rather than "didn't match your account", which it cannot know.
  useEffect(() => {
    if (state !== 'claiming') return;
    const timer = setTimeout(() => {
      sessionStorage.removeItem(INVITE_SESSION_KEY);  // consume on auto-fail
      setState('failed');
    }, 30_000);
    return () => clearTimeout(timer);
  }, [state]);

  // ---- Effect 5: spert:models-changed listener ----------------------------
  useEffect(() => {
    const handler = (e: Event) => {
      // SESSION_KEY gate — REQUIRED first line. Without this, users signing
      // in normally (no invite link) who happen to have pending invitations
      // see a spurious "you now have access to: X" banner.
      if (!sessionStorage.getItem(INVITE_SESSION_KEY)) return;

      const allClaimed = (e as CustomEvent<{ claimed: ClaimPendingInvitationsResult['claimed'] }>)
        .detail?.claimed ?? [];
      if (allClaimed.length === 0) return;  // payload gate (Lesson 27)

      // The CF claims across EVERY SPERT app for the caller's email and
      // returns all of it; each app's banner reports its own rows.
      const msbClaimed = allClaimed.filter(c => c.appId === 'myscrumbudget');

      sessionStorage.removeItem(INVITE_SESSION_KEY);  // consume on any claim

      if (msbClaimed.length === 0) {
        // v0.38.1 (WI-2 PC3): a SUCCESSFUL cross-app claim — the student
        // clicked, say, a Story Map link and landed here. Before this the
        // handler returned and left the 30s timer running, so a claim that
        // had WORKED was reported as "didn't match your account". Measured
        // 2026-09-12: three students hold pending rows in two apps each.
        setClaimedElsewhereApps(
          Array.from(new Set(allClaimed.map(c => spertAppDisplayName(c.appId)))),
        );
        setState('claimed_elsewhere');
        return;
      }

      setClaimedNames(msbClaimed.map(c => c.modelName).filter(Boolean));
      setState('claimed');
    };
    window.addEventListener('spert:models-changed', handler);
    return () => window.removeEventListener('spert:models-changed', handler);
  }, []); // empty deps — SESSION_KEY + payload gates sufficient

  // ---- Effect 6: the claim SETTLED without changing any model (v0.38.1) ---
  // Dispatched by claimPendingInvitationsAndNotify exactly when
  // spert:models-changed is not: the callable rejected, or resolved with no
  // rows. Same gate discipline as Effect 5 — SESSION_KEY first, no state
  // gate (Lesson 27), deps [] because only stable setters are captured.
  useEffect(() => {
    const handler = (e: Event) => {
      if (!sessionStorage.getItem(INVITE_SESSION_KEY)) return;
      const detail = (e as CustomEvent<InviteClaimSettledDetail>).detail;
      if (!detail) return;
      sessionStorage.removeItem(INVITE_SESSION_KEY);  // consume on settled failure
      setSettled(detail);
      setState('failed');
    };
    window.addEventListener(INVITE_CLAIM_SETTLED_EVENT, handler);
    return () => window.removeEventListener(INVITE_CLAIM_SETTLED_EVENT, handler);
  }, []);

  const dismiss = (): void => {
    sessionStorage.removeItem(INVITE_SESSION_KEY);
    setSettled(null);
    setState('idle');
  };

  const failureMessage = state === 'failed' ? describeClaimFailure(settled) : null;

  return { state, claimedNames, claimedElsewhereApps, failureMessage, dismiss };
}
