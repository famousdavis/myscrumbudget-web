// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Tracks whether the current browser session has performed at least one
 * local-to-cloud upload. Used by CloudStorageModal/CloudStorageSection to
 * suppress repeated "switch to cloud?" prompts after the first upload,
 * and by useInvitationLanding (Effect 2) when auto-flipping storage on
 * invite-link arrival.
 *
 * Previously duplicated as private helpers in CloudStorageModal.tsx and
 * CloudStorageSection.tsx. Extracted here so useInvitationLanding can
 * import without re-defining (or worse, drifting from) the storage-mode
 * flip semantics.
 */
const HAS_UPLOADED_KEY = 'msb:hasUploadedToCloud';

export function setHasUploaded(): void {
  try { localStorage.setItem(HAS_UPLOADED_KEY, 'true'); } catch { /* ignore */ }
}

export function getHasUploaded(): boolean {
  try { return localStorage.getItem(HAS_UPLOADED_KEY) === 'true'; } catch { return false; }
}
