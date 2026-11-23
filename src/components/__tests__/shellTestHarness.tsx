// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Tests only (FRAME26, v0.45.0): the frame as `layout.tsx` assembles it, minus `AuthProvider` (each test mocks
 * `useAuth`) and `ToastProvider` (nothing the shell renders signed out uses it). The real `MigrationProvider` and
 * `RepositoryProvider` run, so the gates in `AppShell` behave as they do in the app.
 */
import type { ReactNode } from 'react';
import { MigrationProvider } from '@/components/MigrationGuard';
import { RepositoryProvider } from '@/components/RepositoryProvider';
import { AppShell } from '@/components/AppShell';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <MigrationProvider>
      <RepositoryProvider>
        <AppShell>{children}</AppShell>
      </RepositoryProvider>
    </MigrationProvider>
  );
}
