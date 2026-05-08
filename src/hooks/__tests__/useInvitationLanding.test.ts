// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach } from 'vitest';
import { captureInviteTokenFromUrl, INVITE_SESSION_KEY } from '../useInvitationLanding';

// Module-load auto-call captureInviteTokenFromUrl() ran at import time. Tests
// reset both sessionStorage and the URL in beforeEach so each case starts
// from a known state.

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('captureInviteTokenFromUrl', () => {
  it('captures the token, strips ?invite=, and preserves other query params', () => {
    window.history.replaceState({}, '', '/?invite=abc&ref=email-2025');
    captureInviteTokenFromUrl(true);
    expect(sessionStorage.getItem(INVITE_SESSION_KEY)).toBe('abc');
    expect(window.location.search).toBe('?ref=email-2025');
  });

  it('is a no-op when enabled = false', () => {
    window.history.replaceState({}, '', '/?invite=abc');
    captureInviteTokenFromUrl(false);
    expect(sessionStorage.getItem(INVITE_SESSION_KEY)).toBeNull();
    // URL not stripped — ?invite= remains for a future enabled call (if the
    // module is reloaded) to capture.
    expect(window.location.search).toBe('?invite=abc');
  });

  it('is a no-op when no ?invite= param is present', () => {
    window.history.replaceState({}, '', '/?ref=email-2025');
    captureInviteTokenFromUrl(true);
    expect(sessionStorage.getItem(INVITE_SESSION_KEY)).toBeNull();
    expect(window.location.search).toBe('?ref=email-2025');
  });

  it('is idempotent — second call with the already-stripped URL is a no-op', () => {
    window.history.replaceState({}, '', '/?invite=abc');
    captureInviteTokenFromUrl(true);
    expect(sessionStorage.getItem(INVITE_SESSION_KEY)).toBe('abc');
    expect(window.location.search).toBe('');
    // Second call: URL already stripped, so the get('invite') returns null
    captureInviteTokenFromUrl(true);
    expect(sessionStorage.getItem(INVITE_SESSION_KEY)).toBe('abc'); // unchanged
  });

  it('preserves URL fragment (#hash) when stripping ?invite=', () => {
    window.history.replaceState({}, '', '/?invite=abc#section');
    captureInviteTokenFromUrl(true);
    expect(window.location.hash).toBe('#section');
    expect(sessionStorage.getItem(INVITE_SESSION_KEY)).toBe('abc');
  });
});

// Note: full state-machine tests for the hook itself (Effect 2/3/4/5) require
// rendering the hook with a mock AuthProvider. These are deferred to the
// BulkSharingSection test file (next iteration) since they share the same
// AuthProvider mocking infrastructure. The captureInviteTokenFromUrl tests
// above cover the IIFE-equivalent capture logic in isolation, which is the
// most fragile part of the hook.
