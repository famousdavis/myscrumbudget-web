'use client';

import { useEffect, useRef } from 'react';
import {
  collection, query, where, doc,
  onSnapshot, type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/components/AuthProvider';
import { getStorageMode } from '@/lib/storage/storageMode';
import { cloudSyncBus } from '@/lib/firebase/cloudSyncBus';

const PROJECTS_COL = 'myscrumbudget_projects';
const SETTINGS_COL = 'myscrumbudget_settings';

/**
 * Sets up Firestore onSnapshot listeners when in cloud mode.
 * Emits events on cloudSyncBus so hooks can re-fetch from repo.
 *
 * Echo prevention: skip snapshots where hasPendingWrites is true
 * (those are local writes echoing back from Firestore SDK cache).
 *
 * Mount this once at the app level (e.g. in layout or a top-level component).
 */
export function useCloudSync(): void {
  const { user } = useAuth();
  const unsubscribersRef = useRef<Unsubscribe[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    const isCloud = getStorageMode() === 'cloud';
    if (!isCloud || !user || !db) {
      // Clean up any existing listeners if mode changed
      unsubscribersRef.current.forEach((unsub) => unsub());
      unsubscribersRef.current = [];
      initializedRef.current = false;
      return;
    }

    // Avoid double-init (StrictMode)
    if (initializedRef.current) return;
    initializedRef.current = true;

    const uid = user.uid;

    // ── Projects listener ──
    // Listen for changes to any project where user is a member
    const projectsQuery = query(
      collection(db, PROJECTS_COL),
      where(`members.${uid}`, 'in', ['owner', 'editor', 'viewer']),
    );
    const unsubProjects = onSnapshot(projectsQuery, (snapshot) => {
      // Echo prevention: skip our own pending writes
      if (snapshot.metadata.hasPendingWrites) return;
      cloudSyncBus.emit('projects');
    });

    // ── Settings listener ──
    const settingsRef = doc(db, SETTINGS_COL, uid);
    const unsubSettings = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      // Settings doc contains both settings and teamPool
      cloudSyncBus.emit('settings');
      cloudSyncBus.emit('teamPool');
    });

    unsubscribersRef.current = [unsubProjects, unsubSettings];

    // ── beforeunload flush ──
    // Importing dynamically to avoid circular dependency
    const handleBeforeUnload = () => {
      // Flush is handled by individual hooks via useDebouncedSave
      // This is a safety net — the hooks' own unmount flush should handle most cases
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribersRef.current.forEach((unsub) => unsub());
      unsubscribersRef.current = [];
      initializedRef.current = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);
}
