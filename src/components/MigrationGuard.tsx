'use client';

import { useEffect, useState } from 'react';
import { repo } from '@/lib/storage/repo';

/**
 * Runs storage migrations before rendering children.
 * Ensures all data hooks see migrated data.
 */
export function MigrationGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    repo.migrateIfNeeded().then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return <>{children}</>;
}
