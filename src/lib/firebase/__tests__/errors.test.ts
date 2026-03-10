import { describe, it, expect } from 'vitest';
import { sanitizeFirebaseError } from '../errors';

describe('sanitizeFirebaseError', () => {
  it('maps permission-denied to user-friendly message', () => {
    const error = { code: 'permission-denied' };
    expect(sanitizeFirebaseError(error)).toBe(
      "You don't have permission to access this project."
    );
  });

  it('maps not-found', () => {
    expect(sanitizeFirebaseError({ code: 'not-found' })).toBe(
      'The requested data was not found.'
    );
  });

  it('maps unavailable', () => {
    expect(sanitizeFirebaseError({ code: 'unavailable' })).toBe(
      'Cloud storage is temporarily unavailable. Check your internet connection.'
    );
  });

  it('maps unauthenticated', () => {
    expect(sanitizeFirebaseError({ code: 'unauthenticated' })).toBe(
      'Your session has expired. Please sign in again.'
    );
  });

  it('maps auth/popup-blocked', () => {
    expect(sanitizeFirebaseError({ code: 'auth/popup-blocked' })).toBe(
      'Sign-in popup was blocked by your browser. Please allow popups for this site.'
    );
  });

  it('maps auth/popup-closed-by-user', () => {
    expect(sanitizeFirebaseError({ code: 'auth/popup-closed-by-user' })).toBe(
      'Sign-in was cancelled.'
    );
  });

  it('maps unknown code to generic message', () => {
    expect(sanitizeFirebaseError({ code: 'some-unknown-code' })).toBe(
      'An unexpected error occurred. Please try again.'
    );
  });

  it('handles non-object errors', () => {
    expect(sanitizeFirebaseError('string error')).toBe(
      'An unexpected error occurred. Please try again.'
    );
    expect(sanitizeFirebaseError(null)).toBe(
      'An unexpected error occurred. Please try again.'
    );
    expect(sanitizeFirebaseError(undefined)).toBe(
      'An unexpected error occurred. Please try again.'
    );
  });

  it('handles objects without code property', () => {
    expect(sanitizeFirebaseError({ message: 'oops' })).toBe(
      'An unexpected error occurred. Please try again.'
    );
  });
});
