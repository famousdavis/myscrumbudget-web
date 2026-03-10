// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCloudSync } from '@/hooks/useCloudSync';

/**
 * Activates Firestore onSnapshot listeners when in cloud mode.
 * Must be mounted inside AuthProvider so it can access the current user.
 */
export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  useCloudSync();
  return <>{children}</>;
}
