// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

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
import { PROJECTS_COL, SETTINGS_COL } from '@/lib/firebase/collections';
import { addToastGlobal } from '@/components/Toast';

/**
 * Sets up Firestore onSnapshot listeners when in cloud mode.
 * Emits events on cloudSyncBus so hooks can re-fetch from repo.
 *
 * Echo prevention: skip snapshots where hasPendingWrites is true
 * (those are local writes echoing back from Firestore SDK cache).
 *
 * Mode switches trigger a full page reload (see CloudStorageSection),
 * so this hook only needs to react to user changes.
 */
export function useCloudSync(): void {
  const { user } = useAuth();
  const unsubscribersRef = useRef<Unsubscribe[]>([]);

  useEffect(() => {
    const isCloud = getStorageMode() === 'cloud';
    if (!isCloud || !user || !db) return;

    const uid = user.uid;

    // Suppress duplicate toasts when both listeners fail in the same tick
    // (e.g., a permission rule change or full network drop). Cleared on
    // effect teardown so a re-mount can toast again.
    let toastedThisCycle = false;
    const toastOnce = () => {
      if (toastedThisCycle) return;
      toastedThisCycle = true;
      addToastGlobal(
        'Cloud sync connection issue. Recent changes may not appear until reconnect.',
        'error',
      );
    };

    // ── Projects listener ──
    const projectsQuery = query(
      collection(db, PROJECTS_COL),
      where(`members.${uid}`, 'in', ['owner', 'editor', 'viewer']),
    );
    const unsubProjects = onSnapshot(
      projectsQuery,
      (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) return;
        cloudSyncBus.emit('projects');
      },
      (err) => {
        // Listener has terminated. No automatic resubscribe — full reconnect
        // mechanism is deferred; user must reload or re-sign-in.
        console.error('[useCloudSync] projects listener error:', err);
        toastOnce();
      },
    );

    // ── Settings listener ──
    const settingsRef = doc(db, SETTINGS_COL, uid);
    const unsubSettings = onSnapshot(
      settingsRef,
      (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) return;
        cloudSyncBus.emit('settings');
        cloudSyncBus.emit('teamPool');
      },
      (err) => {
        // Listener has terminated. No automatic resubscribe — full reconnect
        // mechanism is deferred; user must reload or re-sign-in.
        console.error('[useCloudSync] settings listener error:', err);
        toastOnce();
      },
    );

    unsubscribersRef.current = [unsubProjects, unsubSettings];

    return () => {
      unsubscribersRef.current.forEach((unsub) => unsub());
      unsubscribersRef.current = [];
    };
  }, [user]);
}
