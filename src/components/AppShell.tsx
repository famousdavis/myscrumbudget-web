// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { usePathname } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { AppNav } from '@/components/AppNav';
import { Footer } from '@/components/Footer';
import { FirstRunBanner } from '@/components/FirstRunBanner';
import { LocalStorageWarningBanner } from '@/components/LocalStorageWarningBanner';
import { InvitationBanner } from '@/components/InvitationBanner';
import { MigrationGuard } from '@/components/MigrationGuard';
import { RepositoryGate } from '@/components/RepositoryProvider';
import { CloudSyncProvider } from '@/components/CloudSyncProvider';
import { INVITATIONS_ENABLED } from '@/lib/featureFlags';
import { bodyCapped } from '@/lib/nav/activeNav';

/**
 * The SPERT® Suite app frame around every MyScrumBudget screen (FRAME26, v0.45.0). It replaced the sidebar, `TopBar`
 * and `ShellTop`. In this order, as contract §3 and §6 lay it out:
 *
 *   skip link → brand row (`AppHeader`: brand, tagline, theme, account chip) → navigation row (`AppNav`) → the notices
 *   slot (the invitation, the terms notice, the local-storage caution: v0.44.7's suite order) → `main` (the page) →
 *   the footer.
 *
 * The providers sit ABOVE this, in `layout.tsx`, because the chip and the notices are outside `main`. What used to be
 * protected by sitting inside the old `MigrationGuard` and `RepositoryProvider` still is, by their gates here: the page
 * body, and the invitation banner (the Cloud Storage modal's gates are in `AppHeader`). Everything else in the frame
 * renders on the server too, so the frame is there before anything loads (contract §7, "Loading"); `main` is empty
 * until migration has run, exactly as before.
 *
 * `main` keeps `id="main-content"`, which the skip link and `globals.css`'s print rules name. It carries `font-sans`
 * so the page keeps the body's font (Geist): `.sf-app` sets the frame's own font stack for the frame.
 *
 * Settings, About and the changelog cap their body (exception X4, `.sf-main--capped`): each renders its heading row as
 * a direct child of `main`, which the stylesheet leaves full width.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const capped = bodyCapped(usePathname());
  return (
    <div className="sf-app" data-sf="app">
      <a href="#main-content" className="sf-skip" data-sf="skip">
        Skip to main content
      </a>
      <AppHeader />
      <AppNav />
      <div className="sf-col sf-notices" data-sf="notices">
        {INVITATIONS_ENABLED && (
          <MigrationGuard>
            <RepositoryGate>
              <InvitationBanner />
            </RepositoryGate>
          </MigrationGuard>
        )}
        <FirstRunBanner />
        <LocalStorageWarningBanner />
      </div>
      <main
        id="main-content"
        className={capped ? 'sf-col sf-main sf-main--capped font-sans' : 'sf-col sf-main font-sans'}
        data-sf="main"
      >
        <MigrationGuard>
          <RepositoryGate>
            <CloudSyncProvider>{children}</CloudSyncProvider>
          </RepositoryGate>
        </MigrationGuard>
      </main>
      <Footer />
    </div>
  );
}
