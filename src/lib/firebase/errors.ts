// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Map Firestore/Auth error codes to user-friendly messages.
 * Prevents leaking internal paths, project IDs, or collection names to the UI.
 */
export function sanitizeFirebaseError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    switch (code) {
      case 'permission-denied':
        return 'You don\'t have permission to access this project.';
      case 'not-found':
        return 'The requested data was not found.';
      case 'unavailable':
        return 'Cloud storage is temporarily unavailable. Check your internet connection.';
      case 'unauthenticated':
        return 'Your session has expired. Please sign in again.';
      case 'failed-precondition':
        return 'A cloud storage error occurred. Try signing out and back in.';
      case 'resource-exhausted':
        return 'Cloud storage quota exceeded. Please try again later.';
      case 'already-exists':
        return 'This item already exists in cloud storage.';
      case 'cancelled':
        return 'The operation was cancelled.';
      case 'deadline-exceeded':
        return 'The operation took too long. Please try again.';
      case 'auth/popup-blocked':
        return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled.';
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized for sign-in. Please contact the administrator.';
      case 'auth/api-key-not-valid':
        return 'Firebase configuration error. Please contact the administrator.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
  return 'An unexpected error occurred. Please try again.';
}
