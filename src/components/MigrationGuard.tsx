// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect, useState } from 'react';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';

/**
 * Runs storage migrations before rendering children.
 * Ensures all data hooks see migrated data.
 *
 * ⚠️ DELIBERATELY OUTSIDE `RepositoryProvider`, and it constructs a localStorage
 * repository directly rather than consuming the active one (v0.37.0).
 *
 * Migration is a localStorage-only concern: `firestoreRepo.migrateIfNeeded` is
 * an explicit no-op ("cloud data schema is always current — migrations happen
 * at the app level before data reaches Firestore"). Moving this guard inside
 * the provider would therefore buy nothing, while costing three things — it
 * would invert the nesting (`RepositoryProvider` depends on `AuthProvider`),
 * delay migration behind auth resolution, and re-run it on every repository
 * identity change. This is the one place a direct construction is correct.
 */
export function MigrationGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    createLocalStorageRepository().migrateIfNeeded().then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return <>{children}</>;
}
