// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { FirstRunBanner } from '@/components/FirstRunBanner';
import { LocalStorageWarningBanner } from '@/components/LocalStorageWarningBanner';
import { TopBar } from '@/components/TopBar';
import { InvitationBanner } from '@/components/InvitationBanner';
import { INVITATIONS_ENABLED } from '@/lib/featureFlags';

/**
 * The top of every page, in the order shared across the SPERT® Suite (v0.44.7):
 * the header row (`TopBar`), then the app-wide notices — the invitation banner,
 * the terms notice, the local-storage caution — then the page itself.
 *
 * Rendered INSIDE the provider stack in `layout.tsx`, because `TopBar` (its
 * storage/auth chip) and the invitation banner both need the providers. The
 * notices sit below `TopBar`, so they live inside the stack too. Extracted from
 * the layout only so this order has a test (`RootLayout` renders `<html>`).
 */
export function ShellTop({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      {INVITATIONS_ENABLED && <InvitationBanner />}
      <FirstRunBanner />
      <LocalStorageWarningBanner />
      {children}
    </>
  );
}
