// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

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
