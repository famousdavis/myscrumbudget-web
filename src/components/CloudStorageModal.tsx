// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/BaseDialog';
import { TosConsentModal } from '@/components/TosConsentModal';
import { ExportAttribution } from '@/features/settings/components/ExportAttribution';
import { LocalStorageWarningToggle } from '@/features/settings/components/LocalStorageWarningToggle';
import { GoogleLogo } from '@/components/icons/GoogleLogo';
import { MicrosoftLogo } from '@/components/icons/MicrosoftLogo';
import { getStorageMode, setStorageMode, type StorageMode } from '@/lib/storage/storageMode';
import { repo, switchRepoImpl } from '@/lib/storage/repo';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';
import { createFirestoreRepository } from '@/lib/storage/firestoreRepo';
import { sanitizeFirebaseError } from '@/lib/firebase/errors';
import { setOriginRef } from '@/lib/storage/fingerprint';
import { setHasUploaded } from '@/lib/storage/cloudFlipHelpers';
import { isTosAccepted } from '@/lib/tos/tosHelpers';
import { normalizeDisplayName } from '@/lib/utils/getFirstName';

interface CloudStorageModalProps {
  onClose: () => void;
}

export function CloudStorageModal({ onClose }: CloudStorageModalProps) {
  const {
    user,
    firebaseAvailable,
    signInWithGoogle,
    signInWithMicrosoft,
    signOut,
  } = useAuth();
  const { addToast } = useToast();

  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<StorageMode>(() => getStorageMode());
  const [signInError, setSignInError] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<'google' | 'microsoft' | null>(null);
  const [showTosModal, setShowTosModal] = useState(false);

  const [showUploadConfirm, setShowUploadConfirm] = useState(false);
  const [showSwitchToLocalConfirm, setShowSwitchToLocalConfirm] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [localProjectCount, setLocalProjectCount] = useState(0);
  const [migrating, setMigrating] = useState(false);

  // Focus the dialog on mount for keyboard accessibility.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Escape dismissal. Disabled while migration is in-flight so the user can't
  // close the modal mid-upload.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (migrating) return;
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [migrating, onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (migrating) return;
    if (e.target === e.currentTarget) onClose();
  };

  const doSignIn = useCallback(async (provider: 'google' | 'microsoft') => {
    setSignInError(null);
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithMicrosoft();
      }
    } catch (error) {
      const code = (error && typeof error === 'object' && 'code' in error)
        ? (error as { code: string }).code
        : '';
      // Silent returns: user closed the popup, or double-clicked the button.
      if (code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request') return;
      if (code === 'auth/popup-blocked') {
        setSignInError('Pop-up was blocked. Allow pop-ups for this site and try again.');
        return;
      }
      setSignInError(sanitizeFirebaseError(error));
    }
  }, [signInWithGoogle, signInWithMicrosoft]);

  const handleSignIn = (provider: 'google' | 'microsoft') => {
    if (!isTosAccepted()) {
      setPendingProvider(provider);
      setShowTosModal(true);
      return;
    }
    doSignIn(provider);
  };

  const handleTosAccepted = () => {
    setShowTosModal(false);
    if (pendingProvider) doSignIn(pendingProvider);
    setPendingProvider(null);
  };

  const switchToCloudDirect = useCallback(() => {
    if (!user) return;
    const cloudRepo = createFirestoreRepository(user.uid);
    switchRepoImpl(cloudRepo);
    setStorageMode('cloud');
    setHasUploaded();
    setOriginRef(user.uid);
    window.location.reload();
  }, [user]);

  const handleModeChange = async (newMode: StorageMode) => {
    if (newMode === mode || migrating) return;

    if (newMode === 'cloud') {
      if (!user) return;
      // Read from the delegating repo to avoid the C3 leak (a fresh local
      // repo might surface keys belonging to a prior user).
      const localProjects = await repo.getProjects();
      if (localProjects.length > 0) {
        setLocalProjectCount(localProjects.length);
        setShowUploadConfirm(true);
      } else {
        switchToCloudDirect();
      }
    } else {
      setShowSwitchToLocalConfirm(true);
    }
  };

  const confirmUpload = async () => {
    if (!user) return;
    setShowUploadConfirm(false);
    setMigrating(true);

    try {
      const localData = await repo.exportAll();
      const cloudRepo = createFirestoreRepository(user.uid);
      switchRepoImpl(cloudRepo);
      setStorageMode('cloud');
      setMode('cloud');
      await cloudRepo.importAll(localData);
      setHasUploaded();

      const count = localData.projects.length;
      addToast(`${count} project${count !== 1 ? 's' : ''} uploaded to cloud.`, 'success');
      setShowCleanupConfirm(true);
    } catch (error) {
      const msg = sanitizeFirebaseError(error);
      addToast(`Upload failed: ${msg}`, 'error');
      switchRepoImpl(createLocalStorageRepository());
      setStorageMode('local');
      setMode('local');
    } finally {
      setMigrating(false);
    }
  };

  const confirmSwitchToLocal = () => {
    switchRepoImpl(createLocalStorageRepository());
    setStorageMode('local');
    window.location.reload();
  };

  const handleClearLocalData = async () => {
    setShowCleanupConfirm(false);
    try {
      const localRepo = createLocalStorageRepository();
      await localRepo.clear();
    } catch {
      // Best-effort
    }
    window.location.reload();
  };

  const handleSignOut = async () => {
    // performSignOutCleanup cascades storage mode → local, clears keys, and
    // reloads the page. The modal unmounts naturally post-reload.
    await signOut();
  };

  if (!firebaseAvailable) {
    // Fallback: Firebase not configured. Render a minimal placeholder modal
    // so Settings users aren't stranded; they can still dismiss.
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={handleBackdropClick}
      >
        <div
          ref={dialogRef}
          tabIndex={-1}
          className="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg outline-none dark:bg-zinc-900"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <CloseIcon />
          </button>
          <h2 id={titleId} className="text-lg font-semibold">Cloud Storage</h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Cloud storage is not configured in this build.
          </p>
        </div>
      </div>
    );
  }

  const isSignedIn = !!user;
  const displayName = normalizeDisplayName(user?.displayName) || user?.email || '';

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={handleBackdropClick}
      >
        <div
          ref={dialogRef}
          tabIndex={-1}
          className="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg outline-none dark:bg-zinc-900"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => { if (!migrating) onClose(); }}
            aria-label="Close"
            disabled={migrating}
            className="absolute right-3 top-3 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <CloseIcon />
          </button>

          {/* Title */}
          <h2 id={titleId} className="mb-1 pr-8 text-lg font-semibold">
            Cloud Storage
          </h2>

          {/* ── Storage section ───────────────────────────────────────── */}
          <section className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Storage
            </h3>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="cloudModalStorageMode"
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
                  name="cloudModalStorageMode"
                  value="cloud"
                  checked={mode === 'cloud'}
                  onChange={() => handleModeChange('cloud')}
                  disabled={migrating || !isSignedIn}
                />
                Cloud (sync across devices)
              </label>
            </div>

            {/* Signed-out content */}
            {!isSignedIn && (
              <>
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Sign in to enable cloud storage and sharing.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleSignIn('google')}
                    className="flex min-w-0 flex-1 items-center justify-start gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-sm bg-white">
                      <GoogleLogo size={14} />
                    </span>
                    <span>Sign in with Google</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSignIn('microsoft')}
                    className="flex min-w-0 flex-1 items-center justify-start gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <MicrosoftLogo size={18} />
                    <span>Sign in with Microsoft</span>
                  </button>
                </div>
                {signInError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {signInError}
                  </p>
                )}
              </>
            )}

            {/* Signed-in content */}
            {isSignedIn && (
              <>
                <div className="mt-3 flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{displayName}</p>
                    {user?.email && (
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={migrating}
                    className="ml-3 shrink-0 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Sign out
                  </button>
                </div>

                {mode === 'local' && (
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={migrating}
                    className="mt-3 w-full rounded border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Keep using local storage
                  </button>
                )}

                {migrating && (
                  <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                    Uploading data to cloud…
                  </p>
                )}
              </>
            )}
          </section>

          <hr className="my-5 border-zinc-200 dark:border-zinc-800" />

          {/* ── Export Attribution section ────────────────────────────── */}
          <section>
            <ExportAttribution />
          </section>

          <hr className="my-5 border-zinc-200 dark:border-zinc-800" />

          {/* ── Notifications section ─────────────────────────────────── */}
          <section>
            <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Notifications
            </h3>
            <LocalStorageWarningToggle />
          </section>
        </div>
      </div>

      {/* Nested confirmation dialogs render above the modal overlay. */}
      {showUploadConfirm && (
        <ConfirmDialog
          title="Upload Local Data to Cloud"
          message={
            <>
              You have {localProjectCount} local project{localProjectCount !== 1 ? 's' : ''}.
              Upload them to the cloud?
            </>
          }
          confirmLabel="Upload to Cloud"
          onConfirm={confirmUpload}
          onCancel={() => setShowUploadConfirm(false)}
        />
      )}

      {showSwitchToLocalConfirm && (
        <ConfirmDialog
          title="Switch to Local Storage"
          message="Your cloud data will remain in the cloud but this device will use local storage. Continue?"
          confirmLabel="Switch to Local"
          onConfirm={confirmSwitchToLocal}
          onCancel={() => setShowSwitchToLocalConfirm(false)}
        />
      )}

      {showCleanupConfirm && (
        <ConfirmDialog
          title="Clear Local Data"
          message="Your data is now in the cloud. Clear local copies to prevent duplicates on future sign-ins?"
          confirmLabel="Clear Local Data"
          onConfirm={handleClearLocalData}
          onCancel={() => {
            // Mode has already switched to cloud — reload to sync hooks.
            window.location.reload();
          }}
        />
      )}

      {showTosModal && (
        <TosConsentModal
          onAccept={handleTosAccepted}
          onCancel={() => {
            setShowTosModal(false);
            setPendingProvider(null);
          }}
        />
      )}
    </>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
