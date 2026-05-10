// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { doc, getDoc } from 'firebase/firestore';
import { db } from './config';
import { PROJECTS_COL, PROFILES_COL } from './collections';

export type MemberRole = 'owner' | 'editor' | 'viewer';

export interface ProjectMember {
  uid: string;
  email: string;
  displayName: string;
  role: MemberRole;
}

// v0.28.2 (L1): legacy single-email add path removed alongside SharingSection.tsx.
// `findUidByEmail`, `addProjectMember`, and `removeProjectMember` were the
// only callers of an unbounded `getDocs(collection(myscrumbudget_profiles))`
// query — now blocked at the rules layer by the v0.28.2 H1 fix
// (`list: if isAuth() && request.query.limit <= 1`). The active member-
// add flow runs through `callSendInvitationEmail` (Cloud Function); member
// removal goes through `removeCollaborator` in invitations.ts (transactional,
// 3-guard). Only `getProjectMembers` survives — read-only fan-out for the
// BulkSharingSection member list, no profile-collection scan.

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
    // Rejected — log without interpolating uid into the message
    // (v0.28.2 / L4 — see audit). Keep error code only.
    console.warn(
      '[sharing] getProjectMembers: profile fetch failed:',
      (result.reason as { code?: string })?.code ?? 'unknown',
    );
    return { uid, email: '', displayName: '', role: role as MemberRole };
  });
}
