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
 * Centered card shown when the user arrives via an `?invite=` link.
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
  const { state, claimedNames, dismiss } = useInvitationLanding();
  if (state === 'idle') return null;

  return (
    <div
      className="relative max-w-lg mx-auto mb-4 p-5 bg-blue-50 dark:bg-blue-900/20
                 border border-blue-200 dark:border-blue-800 rounded-lg shadow-sm"
      role="status"
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss invitation banner"
        className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <span aria-hidden="true">×</span>
      </button>
      <div className="space-y-3 pr-6">
        {state === 'pre_auth' && <PreAuthContent />}
        {state === 'claiming' && <ClaimingContent />}
        {state === 'claimed'  && <ClaimedContent names={claimedNames} />}
        {state === 'failed'   && <FailedContent />}
      </div>
      {/* Scoped live region — announces state transitions without re-reading
          the entire card. role="status" on the card without aria-live keeps
          the live region narrow. */}
      <span aria-live="polite" className="sr-only">
        {state === 'claiming' && 'Verifying your invitation.'}
        {state === 'claimed'  && `You now have access to ${claimedNames.join(', ')}.`}
        {state === 'failed'   && 'This invite link did not match your account.'}
      </span>
    </div>
  );
}

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
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
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
        <TosConsentModal
          onAccept={handleTosAccepted}
          onCancel={handleTosCancel}
        />
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
      <p className="text-sm text-zinc-700 dark:text-zinc-300">
        Verifying invitation&hellip;
      </p>
    </div>
  );
}

function ClaimedContent({ names }: { names: string[] }) {
  // Old invites may have modelName === 'Untitled' (pre-existing CF limitation,
  // not a new bug). Display verbatim from CF response.
  return (
    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
      You now have access to: {names.join(', ')}.
    </p>
  );
}

function FailedContent() {
  // Known v1 UX limitation: MS personal accounts (@outlook.com) reach this
  // state because emailVerified === false short-circuits the claim. Also
  // hit on the cross-app token edge case (link for non-MSB app, landed on
  // MSB by mistake). Both documented as backlog items.
  return (
    <p className="text-sm text-amber-800 dark:text-amber-300">
      This invite link didn&rsquo;t match your account. Check that you signed in
      with the right email.
    </p>
  );
}
