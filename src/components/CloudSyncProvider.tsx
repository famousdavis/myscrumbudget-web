// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect } from 'react';
import { useCloudSync } from '@/hooks/useCloudSync';
import { registerTabCloseFlush } from '@/lib/storage/tabCloseFlush';

/**
 * Activates Firestore onSnapshot listeners when in cloud mode AND
 * the pagehide/beforeunload tab-close flush handlers (both modes).
 * Must be mounted inside AuthProvider so it can access the current user.
 */
export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  useCloudSync();
  useEffect(() => registerTabCloseFlush(), []);
  return <>{children}</>;
}
