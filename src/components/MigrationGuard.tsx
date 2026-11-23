// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createLocalStorageRepository } from '@/lib/storage/localStorage';

const MigratedContext = createContext<boolean | null>(null);

/**
 * Runs storage migrations once, at the root, and tells every `MigrationGuard`
 * when they are done.
 *
 * ⚠️ SPLIT FROM `MigrationGuard` IN v0.45.0 (FRAME26). Until then one component
 * both ran the migration and rendered `null` until it finished, and it wrapped
 * the providers and the page together, inside `<main>`. The SPERT® Suite frame
 * puts the account chip and the notices OUTSIDE `<main>`, so the providers
 * wrap the whole frame now, and a guard there would leave the frame out of the
 * server HTML and blank until migration. So the run lives here, once, and the
 * `null` lives in `MigrationGuard`, which wraps exactly what the old guard
 * protected: the page body, the invitation banner and the Cloud Storage modal.
 * Several guards, one run: they all read this provider's flag.
 *
 * ⚠️ It constructs a localStorage repository directly rather than consuming the
 * active one (v0.37.0), and that is still correct here. Migration is a
 * localStorage-only concern: `firestoreRepo.migrateIfNeeded` is an explicit
 * no-op ("cloud data schema is always current — migrations happen at the app
 * level before data reaches Firestore"). Taking the active repository would
 * make migration wait for auth and re-run on every repository identity change.
 */
export function MigrationProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    createLocalStorageRepository().migrateIfNeeded().then(() => setReady(true));
  }, []);

  return <MigratedContext.Provider value={ready}>{children}</MigratedContext.Provider>;
}

/**
 * Renders its children only after storage migrations have run, so every data
 * hook below it sees migrated data. It renders `null` on the server and on the
 * first client render too (the flag is set in an effect), which is why a
 * lazy `useState(() => localStorage…)` below it never causes a hydration
 * mismatch (`page.tsx`'s `ratesReviewed`, `useInvitationLanding`'s state).
 */
export function MigrationGuard({ children }: { children: React.ReactNode }) {
  const ready = useContext(MigratedContext);
  if (ready === null) throw new Error('MigrationGuard must be used within MigrationProvider');
  if (!ready) return null;
  return <>{children}</>;
}
