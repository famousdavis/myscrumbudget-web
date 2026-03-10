import {
  doc, getDoc, updateDoc, collection, query, where, getDocs,
} from 'firebase/firestore';
import { db } from './config';

const PROJECTS_COL = 'myscrumbudget_projects';
const PROFILES_COL = 'myscrumbudget_profiles';

export type MemberRole = 'owner' | 'editor' | 'viewer';

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
  const result: ProjectMember[] = [];

  for (const [uid, role] of Object.entries(members)) {
    try {
      const profileSnap = await getDoc(doc(db, PROFILES_COL, uid));
      const profile = profileSnap.exists() ? profileSnap.data() : {};
      result.push({
        uid,
        email: (profile.email as string) ?? '',
        displayName: (profile.displayName as string) ?? '',
        role: role as MemberRole,
      });
    } catch {
      // Profile not found or permission denied — include with minimal info
      result.push({ uid, email: '', displayName: '', role: role as MemberRole });
    }
  }

  return result;
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

  const targetUid = await findUidByEmail(email);
  if (!targetUid) {
    return {
      ok: false,
      reason: 'No user found with that email. They must sign in to MyScrumBudget first.',
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

  // Remove by setting to FieldValue.delete() equivalent
  // Use updateDoc with the key set to deleteField
  const { deleteField } = await import('firebase/firestore');
  await updateDoc(doc(db, PROJECTS_COL, projectId), {
    [`members.${targetUid}`]: deleteField(),
  });

  return { ok: true };
}
