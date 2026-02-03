import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Sidebar } from '@/components/Sidebar';
import { MigrationGuard } from '@/components/MigrationGuard';
import { Footer } from '@/components/Footer';
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
            <MigrationGuard>{children}</MigrationGuard>
            <Footer />
          </main>
        </div>
      </body>
    </html>
  );
}
