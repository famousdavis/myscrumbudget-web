// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { Suspense } from 'react';
import { GoogleLogo } from '@/components/icons/GoogleLogo';
import { MicrosoftLogo } from '@/components/icons/MicrosoftLogo';
import { TosConsentModal } from '@/components/TosConsentModal';
import { useInvitationLanding } from '@/hooks/useInvitationLanding';
import { useSignInWithTosGate } from '@/hooks/useSignInWithTosGate';

/**
 * The notice shown when the user arrives via an `?invite=` link.
 *
 * ⚠️ A frame notice since v0.45.0 (FRAME26, contract §3 and §6): it sits FIRST in the notices slot, above the terms
 * notice and the caution, outside `<main>`, at the full column width. Its old centred 512 px card (`max-w-lg mx-auto`)
 * went with that. Its variant follows its state: info while signing in and verifying, success once a claim landed
 * (here or in another app), caution when it failed. Its paragraphs take the notice's text colour; the "×" and the two
 * sign-in buttons keep their own look (contract §3: other buttons in a notice keep theirs).
 *
 * ⚠️ It renders inside `MigrationGuard` and `RepositoryGate` (`AppShell.tsx`), as it did when it lived inside the
 * page's provider stack: `useInvitationLanding` reads the repository, and its lazy `useState(() => sessionStorage…)`
 * differs between the server and the browser, which is harmless only because the guard renders nothing on the server
 * and on the first client render (`shell.hydration.test.tsx`).
 *
 * Suspense kept defensively — useInvitationLanding now reads sessionStorage
 * (not useSearchParams), so the boundary is not strictly required. If a
 * future change re-introduces useSearchParams, the boundary prevents
 * App Router build failures (Lesson 14).
 */
export function InvitationBanner() {
  return (
    <Suspense fallback={null}>
      <InvitationBannerInner />
    </Suspense>
  );
}

function InvitationBannerInner() {
  const { state, claimedNames, claimedElsewhereApps, failureMessage, dismiss } =
    useInvitationLanding();
  if (state === 'idle') return null;

  return (
    <div className={`sf-notice ${NOTICE_VARIANT[state]} relative`} role="status">
      <button
        onClick={dismiss}
        aria-label="Dismiss invitation banner"
        className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <span aria-hidden="true">×</span>
      </button>
      <div className="flex-1 space-y-3 pr-6">
        {state === 'pre_auth' && <PreAuthContent />}
        {state === 'claiming' && <ClaimingContent />}
        {state === 'claimed'  && <ClaimedContent names={claimedNames} />}
        {state === 'claimed_elsewhere' && <ClaimedElsewhereContent apps={claimedElsewhereApps} />}
        {state === 'failed'   && <FailedContent message={failureMessage} />}
      </div>
      {/* Scoped live region — announces state transitions without re-reading
          the entire card. role="status" on the card without aria-live keeps
          the live region narrow. */}
      <span aria-live="polite" className="sr-only">
        {state === 'claiming' && 'Verifying your invitation.'}
        {state === 'claimed'  && `You now have access to ${claimedNames.join(', ')}.`}
        {state === 'claimed_elsewhere' && `Your invitation was accepted in ${listNames(claimedElsewhereApps)}.`}
        {state === 'failed'   && failureMessage}
      </span>
    </div>
  );
}

/** The frame notice variant for each visible state (contract §3; the tokens are `spert-frame.css`'s). */
const NOTICE_VARIANT: Record<Exclude<ReturnType<typeof useInvitationLanding>['state'], 'idle'>, string> = {
  pre_auth: 'sf-notice--info',
  claiming: 'sf-notice--info',
  claimed: 'sf-notice--success',
  claimed_elsewhere: 'sf-notice--success',
  failed: 'sf-notice--caution',
};

function PreAuthContent() {
  const {
    handleSignIn,
    showTosModal,
    handleTosAccepted,
    handleTosCancel,
    signInError,
  } = useSignInWithTosGate();

  return (
    <>
      <p className="font-medium">
        You&rsquo;ve been invited to a MyScrumBudget project. Sign in to accept.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => handleSignIn('google')}
          aria-label="Sign in with Google"
          className="flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        >
          <GoogleLogo size={16} />
          Sign in with Google
        </button>
        <button
          type="button"
          onClick={() => handleSignIn('microsoft')}
          aria-label="Sign in with Microsoft"
          className="flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        >
          <MicrosoftLogo size={16} />
          Sign in with Microsoft
        </button>
      </div>
      {signInError && (
        <p className="text-sm text-red-600 dark:text-red-400">{signInError}</p>
      )}
      {showTosModal && (
        // `font-sans`: the dialog keeps the body's font (Geist) inside the frame's notice, whose font is the frame's.
        <div className="font-sans">
          <TosConsentModal
            onAccept={handleTosAccepted}
            onCancel={handleTosCancel}
          />
        </div>
      )}
    </>
  );
}

function ClaimingContent() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400 dark:border-t-transparent"
        aria-hidden="true"
      />
      <p>
        Verifying invitation&hellip;
      </p>
    </div>
  );
}

function ClaimedContent({ names }: { names: string[] }) {
  // Old invites may have modelName === 'Untitled' (pre-existing CF limitation,
  // not a new bug). Display verbatim from CF response.
  return (
    <p className="font-medium">
      You now have access to: {names.join(', ')}.
    </p>
  );
}

/** "A" · "A and B" · "A, B and C" — for the one-to-many app list. */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function ClaimedElsewhereContent({ apps }: { apps: string[] }) {
  // v0.38.1 (WI-2 PC3): the claim SUCCEEDED, but every row it claimed belongs
  // to another SPERT app — the student opened, say, a Story Map invite and
  // landed here. Before this state existed the banner waited 30 seconds and
  // then reported the link "didn't match your account", after a claim that
  // had worked. Names come from the CF's `claimed[].appId` through the same
  // map the invitation email uses.
  const where = listNames(apps);
  const plural = apps.length > 1;
  return (
    <p className="font-medium">
      Your invitation was accepted in {where}, not in MyScrumBudget. Open{' '}
      {plural ? 'those apps' : where} to see the {plural ? 'projects' : 'project'}.
    </p>
  );
}

function FailedContent({ message }: { message: string | null }) {
  // v0.38.1 — three distinct copies now reach this state, all built by the
  // hook from the claim callable's settlement (rejected → mapped by code;
  // resolved with no rows → "no pending invitation for <email>"; no answer in
  // 30 s → "couldn't confirm"). None is a read of the invitation document
  // (WI-2 PC4). The previous single copy here blamed "MS personal accounts"
  // and `emailVerified === false`; that model was wrong — every Microsoft
  // sign-in is unverified in Firebase — and it is what hid this defect.
  return (
    <p>
      {message}
    </p>
  );
}
