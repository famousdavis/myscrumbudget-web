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
