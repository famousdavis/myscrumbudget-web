// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { ConfirmDialog } from '@/components/BaseDialog';
import { TosConsentModal } from '@/components/TosConsentModal';
import { useToast } from '@/components/Toast';
import type { StorageMode } from '@/lib/storage/storageMode';
import { useRepository } from '@/components/RepositoryProvider';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import { createFirestoreRepository } from '@/lib/storage/firestoreRepo';
import { sanitizeFirebaseError } from '@/lib/firebase/errors';
import { setOriginRef } from '@/lib/storage/fingerprint';
import { setHasUploaded, getHasUploaded } from '@/lib/storage/cloudFlipHelpers';
import { useSignInWithTosGate } from '@/hooks/useSignInWithTosGate';
import { beginCloudUpload, endCloudUpload } from '@/lib/auth/signOutCleanup';

export function CloudStorageSection() {
  const { user, loading: authLoading, firebaseAvailable, signOut } = useAuth();
  const { addToast } = useToast();
  const {
    handleSignIn,
    showTosModal,
    handleTosAccepted,
    handleTosCancel,
    signInError,
  } = useSignInWithTosGate();

  const { repository, mode, switchMode } = useRepository();
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);
  const [showReuploadConfirm, setShowReuploadConfirm] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [showSwitchToLocalConfirm, setShowSwitchToLocalConfirm] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);
  const [localProjectCount, setLocalProjectCount] = useState(0);

  // Hoisted above the firebaseAvailable early-return so all hooks run in the
  // same order on every render. In practice firebaseAvailable is derived from
  // env vars and is constant at runtime, but placing a useCallback AFTER an
  // early return is still a Rules-of-Hooks violation.
  const switchToCloud = useCallback(() => {
    if (!user) return;
    switchMode('cloud');
    setHasUploaded();
    // In cloud mode, origin ref is the Firebase UID
    setOriginRef(user.uid);
    // ⚠️ The reload is now REDUNDANT, and is kept deliberately (v0.37.0).
    // switchMode re-derives the repository and re-runs the cloud-sync effect
    // on its own, so nothing here depends on the remount any more — which is
    // exactly the claim the old comment got wrong (it said the reload was what
    // made hooks fetch from Firestore; the reload actually DESTROYED the
    // module global that had just been set). Removing it is a separate
    // behaviour change with its own risks; it is a deliberate follow-up.
    window.location.reload();
  }, [user, switchMode]);

  // If Firebase is not configured, hide entirely
  if (!firebaseAvailable) return null;

  const handleModeChange = async (newMode: StorageMode) => {
    if (newMode === mode) return;

    if (newMode === 'cloud') {
      if (!user) return; // Can't switch to cloud without auth

      // Read through the ACTIVE repository — localStorage here, since this
      // branch only runs while mode !== 'cloud'. Avoids the C3 leak where a
      // freshly-constructed localStorage repository bypasses any in-flight
      // state and reads raw keys that may belong to a prior user.
      const localProjects = await repository.getProjects();

      if (localProjects.length > 0) {
        setLocalProjectCount(localProjects.length);
        setShowUploadConfirm(true);
      } else {
        // No local data — switch directly
        switchToCloud();
      }
    } else {
      // Switching to local — confirm first
      setShowSwitchToLocalConfirm(true);
    }
  };

  const confirmUpload = async () => {
    if (!user) return;
    setShowUploadConfirm(false);
    setMigrating(true);
    setMigrationResult(null);
    // ⚠️ Paired with endCloudUpload in the finally, and it must stay that way.
    // switchMode('cloud') below runs BEFORE the upload completes, so from here
    // until the finally the cloud holds only a PREFIX of the local data. A
    // sign-out in that window would otherwise confirm the partial copy and
    // delete the local original.
    beginCloudUpload();
    try {
      // Main migration path — the active repository is still localStorage
      // here (the user is toggling local → cloud). Reading through it rather
      // than constructing a fresh one avoids the C3 leak where a new local
      // repository could surface stale keys from a prior user.
      const localData = await repository.exportAll();

      // Constructed directly as a one-shot UPLOAD TARGET, not as the app's
      // active store — switchMode below is what makes it active.
      const cloudRepo = createFirestoreRepository(user.uid);
      switchMode('cloud');

      // Import local data into cloud
      await cloudRepo.importAll(localData);
      setHasUploaded();

      const count = localData.projects.length;
      setMigrationResult(`Uploaded ${count} project${count !== 1 ? 's' : ''} to cloud.`);
      addToast(`${count} project${count !== 1 ? 's' : ''} uploaded to cloud.`, 'success');

      // Offer cleanup
      setShowCleanupConfirm(true);
    } catch (error) {
      const msg = sanitizeFirebaseError(error);
      setMigrationResult(`Upload failed: ${msg}`);
      addToast('Upload failed. Reverting to local storage.', 'error');

      // Revert to local
      switchMode('local');
    } finally {
      endCloudUpload();
      setMigrating(false);
    }
  };

  const confirmReupload = async () => {
    if (!user) return;
    setShowReuploadConfirm(false);
    setMigrating(true);
    setMigrationResult(null);
    // ⚠️ Same pairing as confirmUpload. The mode is ALREADY cloud here, so this
    // path never flips it — but the window it opens is the same one: while this
    // runs, a sign-out would find a cloud whose contents are mid-write.
    beginCloudUpload();

    try {
      // Reads localStorage directly because the active repository is Firestore in
      // cloud mode; this button exists specifically to surface localStorage
      // stragglers left behind after a prior migration. Safe under sign-out
      // cleanup (performSignOutCleanup wipes msb:projects before any new
      // user sees this UI).
      const localRepo = createLocalStorageRepository();
      const localData = await localRepo.exportAll();

      const cloudRepo = createFirestoreRepository(user.uid);
      await cloudRepo.importAll(localData);
      setHasUploaded();

      const count = localData.projects.length;
      setMigrationResult(`Uploaded ${count} project${count !== 1 ? 's' : ''} to cloud.`);
      addToast(`${count} project${count !== 1 ? 's' : ''} uploaded to cloud.`, 'success');

      setShowCleanupConfirm(true);
    } catch (error) {
      const msg = sanitizeFirebaseError(error);
      setMigrationResult(`Upload failed: ${msg}`);
      addToast('Upload failed.', 'error');
    } finally {
      endCloudUpload();
      setMigrating(false);
    }
  };

  const confirmSwitchToLocal = () => {
    switchMode('local');
    // Redundant since v0.37.0 — see the note in switchToCloud. Kept deliberately.
    window.location.reload();
  };

  const handleClearLocalData = async () => {
    setShowCleanupConfirm(false);
    try {
      const localRepo = createLocalStorageRepository();
      await localRepo.clear();
    } catch {
      // Ignore — clearing local data is best-effort
    }
    // Reload so hooks fetch from Firestore and cloud sync listeners are set up
    window.location.reload();
  };

  const handleSignOut = async () => {
    // Thin wrapper: performSignOutCleanup (invoked via useAuth().signOut) is
    // the canonical path. It cancels pending saves, clears per-user keys,
    // resets storage mode (which re-derives the repository), revokes Firebase
    // credentials, and reloads. No component-local cleanup is needed.
    await signOut();
  };

  const hasUploadedBefore = getHasUploaded();

  return (
    <div id="cloud-storage" className="scroll-mt-4">
    <CollapsibleSection title="Cloud Storage">
      <div className="space-y-4">
        {/* Storage mode toggle */}
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="storageMode"
              value="local"
              checked={mode === 'local'}
              onChange={() => handleModeChange('local')}
              disabled={migrating}
            />
            Local (browser only)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="storageMode"
              value="cloud"
              checked={mode === 'cloud'}
              onChange={() => handleModeChange('cloud')}
              disabled={migrating || !user}
            />
            Cloud (sync across devices)
          </label>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              mode === 'cloud' ? 'bg-green-500' : 'bg-zinc-400'
            }`}
          />
          {mode === 'cloud' && user
            ? `Cloud storage active — ${user.email}`
            : 'Using local storage'}
        </div>

        {/* Sign-in section */}
        {!authLoading && !user && (
          <div className="space-y-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Sign in to enable cloud storage.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleSignIn('google')}
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Sign in with Google
              </button>
              <button
                onClick={() => handleSignIn('microsoft')}
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Sign in with Microsoft
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Microsoft sign-in requires a work or school account. For a
              personal account, use Google.
            </p>
            {signInError && (
              <p className="text-sm text-red-600 dark:text-red-400">{signInError}</p>
            )}
          </div>
        )}

        {/* Account info */}
        {user && (
          <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800">
            <div>
              <p className="text-sm font-medium">{user.displayName}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              // Mirrors the two sibling controls in this file (:204, :215) and the
              // modal's own Sign out. This surface predates the modal by five
              // minor versions and the guard was never back-ported to it.
              disabled={migrating}
              className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              Sign out
            </button>
          </div>
        )}

        {/* Re-upload button (cloud mode, already uploaded, idle) */}
        {mode === 'cloud' && user && !migrating && !showUploadConfirm && !showReuploadConfirm && (
          <button
            onClick={async () => {
              // Reads localStorage directly because the active repository is
              // Firestore in cloud mode; this button surfaces localStorage
              // stragglers left behind after a prior migration.
              const localRepo = createLocalStorageRepository();
              const localProjects = await localRepo.getProjects();
              if (localProjects.length > 0) {
                setLocalProjectCount(localProjects.length);
                setShowReuploadConfirm(true);
              } else {
                addToast('No local data to upload.', 'info');
              }
            }}
            className="text-sm text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Upload local data to cloud
          </button>
        )}

        {/* Migration progress */}
        {migrating && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Uploading data to cloud...
          </p>
        )}

        {/* Migration result */}
        {migrationResult && !migrating && (
          <div className={`rounded border px-3 py-2 text-sm ${
            migrationResult.startsWith('Upload failed')
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400'
              : 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400'
          }`}>
            {migrationResult}
            <button
              onClick={() => setMigrationResult(null)}
              className="ml-2 text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Upload confirmation dialog (main local→cloud migration) */}
      {showUploadConfirm && (
        <ConfirmDialog
          title="Upload Local Data to Cloud"
          message={
            <>
              You have {localProjectCount} local project{localProjectCount !== 1 ? 's' : ''}.
              Upload them to the cloud?
              {hasUploadedBefore && (
                <span className="block mt-1 text-zinc-500 dark:text-zinc-400">
                  Projects already in cloud will be skipped.
                </span>
              )}
            </>
          }
          confirmLabel="Upload to Cloud"
          onConfirm={confirmUpload}
          onCancel={() => setShowUploadConfirm(false)}
        />
      )}

      {/* Re-upload confirmation dialog (cloud-mode stragglers in localStorage) */}
      {showReuploadConfirm && (
        <ConfirmDialog
          title="Upload Local Data to Cloud"
          message={
            <>
              You have {localProjectCount} local project{localProjectCount !== 1 ? 's' : ''} in
              this browser that have not been synced to the cloud.
              Upload them now?
              <span className="block mt-1 text-zinc-500 dark:text-zinc-400">
                Projects already in cloud will be skipped.
              </span>
            </>
          }
          confirmLabel="Upload to Cloud"
          onConfirm={confirmReupload}
          onCancel={() => setShowReuploadConfirm(false)}
        />
      )}

      {/* Cleanup dialog */}
      {showCleanupConfirm && (
        <ConfirmDialog
          title="Clear Local Data"
          message="Your data is now in the cloud. Clear local copies to prevent duplicates on future sign-ins?"
          confirmLabel="Clear Local Data"
          onConfirm={handleClearLocalData}
          onCancel={() => {
            // Mode already switched to cloud in confirmUpload — reload to sync hooks
            window.location.reload();
          }}
        />
      )}

      {/* Switch to local confirmation */}
      {showSwitchToLocalConfirm && (
        <ConfirmDialog
          title="Switch to Local Storage"
          message="Your cloud data will remain in the cloud but this device will use local storage. Continue?"
          confirmLabel="Switch to Local"
          onConfirm={confirmSwitchToLocal}
          onCancel={() => setShowSwitchToLocalConfirm(false)}
        />
      )}

      {/* ToS consent modal */}
      {showTosModal && (
        <TosConsentModal
          onAccept={handleTosAccepted}
          onCancel={handleTosCancel}
        />
      )}

    </CollapsibleSection>
    </div>
  );
}
