// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { INVITATIONS_ENABLED } from '@/lib/featureFlags';
import { switchRepoImpl } from '@/lib/storage/repo';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import { createFirestoreRepository } from '@/lib/storage/firestoreRepo';
import { getStorageMode, setStorageMode } from '@/lib/storage/storageMode';
import { setHasUploaded } from '@/lib/storage/cloudFlipHelpers';
import { setOriginRef } from '@/lib/storage/fingerprint';
import type { ClaimPendingInvitationsResult } from '@/lib/firebase/invitation-types';

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

export type InviteLandingState = 'idle' | 'pre_auth' | 'claiming' | 'claimed' | 'failed';

interface UseInvitationLandingResult {
  state: InviteLandingState;
  claimedNames: string[];
  dismiss: () => void;
}

/**
 * Drives the InvitationBanner state machine.
 *
 * State transitions:
 *   idle      → pre_auth   (Effect 1: SESSION_KEY present on mount)
 *   pre_auth  → claiming   (Effect 3: user becomes non-null)
 *   claiming  → claimed    (Effect 5: spert:models-changed with MSB items)
 *   claiming  → failed     (Effect 4: 30s timer fires)
 *   any       → idle       (dismiss())
 *
 * SESSION_KEY consumption:
 *   - Removed on 'claimed' transition (Effect 5)
 *   - Removed on 'failed' auto-fail (Effect 4)
 *   - Removed on dismiss() (any state)
 *
 * Page reload after dismissal or auto-fail does NOT re-show the banner.
 * Retry path: user re-clicks the email link (IIFE sets a new SESSION_KEY).
 */
export function useInvitationLanding(): UseInvitationLandingResult {
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
        // Always read the LOCAL repo here — repo.getProjects() may return
        // Firestore data for cloud-mode users. The Lesson 28 gate is
        // specifically about LOCAL unsynced data.
        const localProjectCount = (await createLocalStorageRepository().getProjects()).length;
        if (localProjectCount === 0 && getStorageMode() !== 'cloud') {
          switchRepoImpl(createFirestoreRepository(user.uid));
          setStorageMode('cloud');
          setHasUploaded();        // suppress repeated "switch to cloud?" prompts
          setOriginRef(user.uid);  // changelog origin fingerprint
          // No window.location.reload() — banner state machine must stay alive
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
  }, [user]);

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

      // Filter to MSB-only — other apps' claims happen server-side but
      // aren't surfaced here. Each app's banner is self-referential.
      const msbClaimed = allClaimed.filter(c => c.appId === 'myscrumbudget');

      if (msbClaimed.length === 0) {
        // Known v1 limitation: if user clicked a non-MSB invite link and
        // landed on MSB, msbClaimed is empty. The 30s timer → 'failed' copy
        // ("didn't match your account") is misleading because access WAS
        // granted in the other app. Documented in plan as a backlog item.
        return;
      }

      sessionStorage.removeItem(INVITE_SESSION_KEY);  // consume on claimed
      setClaimedNames(msbClaimed.map(c => c.modelName).filter(Boolean));
      setState('claimed');
    };
    window.addEventListener('spert:models-changed', handler);
    return () => window.removeEventListener('spert:models-changed', handler);
  }, []); // empty deps — SESSION_KEY + payload gates sufficient

  const dismiss = (): void => {
    sessionStorage.removeItem(INVITE_SESSION_KEY);
    setState('idle');
  };

  return { state, claimedNames, dismiss };
}
