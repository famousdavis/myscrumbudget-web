// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import {
  doc, getDoc, updateDoc, deleteField, collection, query, where, getDocs,
} from 'firebase/firestore';
import { db } from './config';
import { PROJECTS_COL, PROFILES_COL } from './collections';

export type MemberRole = 'owner' | 'editor' | 'viewer';

/** Basic email format check — not exhaustive, just a guard against junk input. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ProjectMember {
  uid: string;
  email: string;
  displayName: string;
  role: MemberRole;
}

/**
 * Look up a user's UID by email address from their profile doc.
 * Returns null if not found (user hasn't signed in to MyScrumBudget).
 */
async function findUidByEmail(email: string): Promise<string | null> {
  if (!db) return null;
  const q = query(
    collection(db, PROFILES_COL),
    where('email', '==', email.toLowerCase().trim()),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].id;
}

/**
 * Get the members of a project with their profile info.
 */
export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  if (!db) return [];

  const projectSnap = await getDoc(doc(db, PROJECTS_COL, projectId));
  if (!projectSnap.exists()) return [];

  const data = projectSnap.data();
  const members: Record<string, string> = data.members ?? {};
  const entries = Object.entries(members);

  // Parallelize profile fetches with Promise.allSettled. A single rejected
  // lookup (transient permission, network blip) is logged and the member
  // is still surfaced with minimal info — matches prior per-uid try/catch
  // behavior, but wall-time scales O(1) instead of O(N).
  const settled = await Promise.allSettled(
    entries.map(([uid]) => getDoc(doc(db!, PROFILES_COL, uid))),
  );

  return entries.map(([uid, role], i) => {
    const result = settled[i];
    if (result.status === 'fulfilled') {
      const snap = result.value;
      const profile = snap.exists() ? snap.data() : {};
      return {
        uid,
        email: (profile.email as string) ?? '',
        displayName: (profile.displayName as string) ?? '',
        role: role as MemberRole,
      };
    }
    // Rejected — log so a silent drop doesn't go unnoticed
    console.warn(`[sharing] getProjectMembers: profile fetch failed for uid ${uid}:`, result.reason);
    return { uid, email: '', displayName: '', role: role as MemberRole };
  });
}

/**
 * Add a member to a project by email address.
 * Returns the member info on success, or an error message on failure.
 */
export async function addProjectMember(
  projectId: string,
  email: string,
  role: 'editor' | 'viewer',
): Promise<{ ok: true; member: ProjectMember } | { ok: false; reason: string }> {
  if (!db) return { ok: false, reason: 'Cloud storage is not available.' };

  const trimmedEmail = email.toLowerCase().trim();
  if (!EMAIL_RE.test(trimmedEmail)) {
    return { ok: false, reason: 'Please enter a valid email address.' };
  }

  const targetUid = await findUidByEmail(trimmedEmail);
  if (!targetUid) {
    return {
      ok: false,
      reason: 'User not found. They need to sign in to MyScrumBudget at least once before they can be added.',
    };
  }

  // Check if already a member
  const projectSnap = await getDoc(doc(db, PROJECTS_COL, projectId));
  if (!projectSnap.exists()) {
    return { ok: false, reason: 'Project not found.' };
  }

  const data = projectSnap.data();
  const members: Record<string, string> = data.members ?? {};

  if (members[targetUid]) {
    return { ok: false, reason: 'This user is already a member of this project.' };
  }

  // Add member
  await updateDoc(doc(db, PROJECTS_COL, projectId), {
    [`members.${targetUid}`]: role,
  });

  return {
    ok: true,
    member: {
      uid: targetUid,
      email,
      displayName: '',
      role,
    },
  };
}

/**
 * Remove a member from a project.
 * Cannot remove the owner.
 */
export async function removeProjectMember(
  projectId: string,
  targetUid: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!db) return { ok: false, reason: 'Cloud storage is not available.' };

  const projectSnap = await getDoc(doc(db, PROJECTS_COL, projectId));
  if (!projectSnap.exists()) {
    return { ok: false, reason: 'Project not found.' };
  }

  const data = projectSnap.data();
  if (data.owner === targetUid) {
    return { ok: false, reason: 'Cannot remove the project owner.' };
  }

  await updateDoc(doc(db, PROJECTS_COL, projectId), {
    [`members.${targetUid}`]: deleteField(),
  });

  return { ok: true };
}
