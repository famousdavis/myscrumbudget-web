// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getStorageMode } from '@/lib/storage/storageMode';
import {
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  type ProjectMember,
} from '@/lib/firebase/sharing';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { useToast } from '@/components/Toast';
import { sanitizeFirebaseError } from '@/lib/firebase/errors';

interface SharingSectionProps {
  projectId: string;
}

export function SharingSection({ projectId }: SharingSectionProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const isCloud = getStorageMode() === 'cloud';

  const loadMembers = useCallback(async () => {
    if (!isCloud || !user) return;
    try {
      const m = await getProjectMembers(projectId);
      setMembers(m);
    } catch (err) {
      console.warn('Failed to load project members:', err);
    } finally {
      setLoaded(true);
    }
  }, [projectId, isCloud, user]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Determine ownership from the fetched members list
  const isOwner = loaded && members.some((m) => m.uid === user?.uid && m.role === 'owner');

  // Only show in cloud mode for project owner
  if (!isCloud || !user || !isOwner) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    setError(null);

    try {
      const result = await addProjectMember(projectId, email.trim(), role);
      if (result.ok) {
        setEmail('');
        addToast(`${email.trim()} added as ${role}.`, 'success');
        await loadMembers();
      } else {
        setError(result.reason);
      }
    } catch (err) {
      setError(sanitizeFirebaseError(err));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (member: ProjectMember) => {
    try {
      const result = await removeProjectMember(projectId, member.uid);
      if (result.ok) {
        addToast(`${member.email || member.uid} removed.`, 'success');
        await loadMembers();
      } else {
        addToast(result.reason ?? 'Failed to remove member.', 'error');
      }
    } catch (err) {
      addToast(sanitizeFirebaseError(err), 'error');
    }
  };

  return (
    <CollapsibleSection title="Sharing" count={members.length > 1 ? members.length - 1 : undefined}>
      <div className="space-y-4">
        {/* Current members */}
        {members.length > 0 && (
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.uid}
                className="flex items-center justify-between rounded bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800"
              >
                <div>
                  <span className="font-medium">{m.displayName || m.email || m.uid}</span>
                  {m.email && m.displayName && (
                    <span className="ml-2 text-zinc-500 dark:text-zinc-400">({m.email})</span>
                  )}
                  <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs dark:bg-zinc-700">
                    {m.role}
                  </span>
                </div>
                {m.role !== 'owner' && (
                  <button
                    onClick={() => handleRemove(m)}
                    className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add member form */}
        <form onSubmit={handleAdd} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs text-zinc-500 dark:text-zinc-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 dark:text-zinc-400">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
              className="mt-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={adding || !email.trim()}
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </form>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </CollapsibleSection>
  );
}
