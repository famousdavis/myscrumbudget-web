// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { MigrationProvider } from '@/components/MigrationGuard';
import { AuthProvider } from '@/components/AuthProvider';
import { RepositoryProvider } from '@/components/RepositoryProvider';
import { ToastProvider } from '@/components/Toast';
import { AppShell } from '@/components/AppShell';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'MyScrumBudget',
  description: 'Scrum project budget forecasting tool',
  icons: {
    icon: '/spert-favicon-myscrumbudget.png',
    apple: '/spert-favicon-myscrumbudget.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme initialization script - runs before React to prevent flash of wrong theme.
            Key 'msb:theme' must match STORAGE_KEYS.theme in src/types/storage.ts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('msb:theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* The providers wrap the WHOLE frame (FRAME26, v0.45.0), because the account chip and the notices sit
            outside <main>. None of them blanks its children: the old "render nothing until migrated" and "render
            nothing while a cloud session's auth resolves" moved to MigrationGuard and RepositoryGate, inside AppShell,
            around exactly what they protected before (the page, the invitation banner, the Cloud Storage modal).
            AuthProvider is server-safe (user null, loading a build-time constant). ToastProvider renders its
            container after .sf-app, on the body's font. */}
        <AuthProvider>
          <MigrationProvider>
            <RepositoryProvider>
              <ToastProvider>
                <AppShell>{children}</AppShell>
              </ToastProvider>
            </RepositoryProvider>
          </MigrationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
