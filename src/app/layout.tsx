// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Sidebar } from '@/components/Sidebar';
import { FirstRunBanner } from '@/components/FirstRunBanner';
import { LocalStorageWarningBanner } from '@/components/LocalStorageWarningBanner';
import { MigrationGuard } from '@/components/MigrationGuard';
import { AuthProvider } from '@/components/AuthProvider';
import { CloudSyncProvider } from '@/components/CloudSyncProvider';
import { Footer } from '@/components/Footer';
import { ToastProvider } from '@/components/Toast';
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
        <a
          href="#main-content"
          className="fixed left-2 top-2 z-[100] -translate-y-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0"
        >
          Skip to main content
        </a>
        <div className="flex min-h-screen">
          <Sidebar />
          <main id="main-content" className="min-w-0 flex-1 p-8 pt-16 md:pt-8">
            <FirstRunBanner />
            <LocalStorageWarningBanner />
            <MigrationGuard><AuthProvider><CloudSyncProvider><ToastProvider>{children}</ToastProvider></CloudSyncProvider></AuthProvider></MigrationGuard>
            <Footer />
          </main>
        </div>
      </body>
    </html>
  );
}
