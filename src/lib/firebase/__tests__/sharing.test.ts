// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Regression: BulkSharingSection renders `m.displayName || m.email || m.uid`,
// so an unresolved profile put a raw 28-char Firebase Auth UID on screen.
//
// getProjectMembers resolved profiles against myscrumbudget_profiles only —
// written by AuthProvider on THIS app's sign-in. The cross-app invitation Cloud
// Function resolves an invitee BY their spertsuite_profiles doc and then writes
// only members.{uid}; it never seeds a per-app profile. Anyone who had used
// another SPERT app but never opened MyScrumBudget therefore had no per-app
// profile at all.
//
// Suite-wide sweep 2026-07-29; first found in SPERT Story Map v0.49.3.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted above ordinary const declarations, and the
// factory runs while `../sharing` is being imported — before any top-level
// const in this file has initialized. vi.hoisted is what makes the shared
// fixture state reachable from inside the factory.
const h = vi.hoisted(() => {
  /** Docs keyed by "collection/id"; an absent key means exists() === false. */
  const state = {
    docs: {} as Record<string, Record<string, unknown>>,
    /** Every getDoc path, so read behaviour can be asserted. */
    reads: [] as string[],
  };
  return {
    state,
    docSpy: (_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` }),
    getDocSpy: async (ref: { path: string }) => {
      state.reads.push(ref.path);
      const data = state.docs[ref.path];
      return { exists: () => data !== undefined, data: () => data };
    },
  };
});

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return { ...actual, doc: h.docSpy, getDoc: h.getDocSpy };
});

vi.mock('@/lib/firebase/config', () => ({ db: {} as unknown }));

import { getProjectMembers } from '../sharing';

const OWNER = 'owner-uid-0000000000000000';
const MEMBER = 'nT5V5xk8pcNHpHE7IjMxJtmQBPa2';

beforeEach(() => {
  h.state.reads = [];
  h.state.docs = {
    'myscrumbudget_projects/p1': {
      members: { [OWNER]: 'owner', [MEMBER]: 'editor' },
    },
    [`myscrumbudget_profiles/${OWNER}`]: {
      displayName: 'William W Davis',
      email: 'davisw2@ufl.edu',
    },
  };
});

describe('getProjectMembers — suite profile fallback', () => {
  it('falls back to spertsuite_profiles when the per-app profile is missing', async () => {
    h.state.docs[`spertsuite_profiles/${MEMBER}`] = {
      displayName: 'William W Davis',
      email: 'famousdavispmp@gmail.com',
    };

    const members = await getProjectMembers('p1');
    const m = members.find((x) => x.uid === MEMBER);
    expect(m?.email).toBe('famousdavispmp@gmail.com');
    expect(m?.displayName).toBe('William W Davis');
  });

  it('does not read the suite mirror when the per-app profile exists', async () => {
    h.state.docs[`myscrumbudget_profiles/${MEMBER}`] = {
      displayName: 'Local Profile',
      email: 'local@example.com',
    };
    h.state.docs[`spertsuite_profiles/${MEMBER}`] = {
      displayName: 'Suite Profile',
      email: 'suite@example.com',
    };

    const members = await getProjectMembers('p1');
    expect(members.find((x) => x.uid === MEMBER)?.displayName).toBe('Local Profile');
    expect(h.state.reads).not.toContain(`spertsuite_profiles/${MEMBER}`);
  });

  it('returns empty strings when neither profile exists', async () => {
    const members = await getProjectMembers('p1');
    const m = members.find((x) => x.uid === MEMBER);
    expect(m?.email).toBe('');
    expect(m?.displayName).toBe('');
    // Both lookups were attempted before giving up.
    expect(h.state.reads).toContain(`myscrumbudget_profiles/${MEMBER}`);
    expect(h.state.reads).toContain(`spertsuite_profiles/${MEMBER}`);
  });

  it('only re-fetches the uids that actually missed', async () => {
    // Owner resolves from the per-app collection; only MEMBER should fall back.
    h.state.docs[`spertsuite_profiles/${MEMBER}`] = { email: 'famousdavispmp@gmail.com' };

    await getProjectMembers('p1');
    const suiteReads = h.state.reads.filter((r) => r.startsWith('spertsuite_profiles/'));
    expect(suiteReads).toEqual([`spertsuite_profiles/${MEMBER}`]);
  });
});
