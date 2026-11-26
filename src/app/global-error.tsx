// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import './globals.css';

/**
 * The app's outermost crash screen (FRAME26 clean-up E, v0.46.0; contract §7 "Errors"). Next.js renders it in place of
 * the root layout when an error escapes everything inside it, the frame (AppShell) and the providers included. It stays
 * OUTSIDE the frame on purpose: drawn inside it, a fault in the frame would take the crash screen down too. So it is its
 * own <html> and <body>, imports globals.css itself (the root layout's styles are not applied here), and takes its theme
 * from the stored setting the same way the root layout's pre-hydration script does (`msb:theme`, then the system's),
 * setting `class="dark"` so the frame's page ground and text colours apply. One way out: Reload. No error text: its
 * message can quote a value from the data. Before v0.46.0, Next.js's own "This page couldn't load" showed, on #fff /
 * #0a0a0a chosen by the system's colour scheme alone.
 */
function crashIsDark(): boolean {
  try {
    const t = window.localStorage.getItem('msb:theme');
    return t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch {
    return false;
  }
}

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset?: () => void }) {
  void reset; // A reload, not a re-render: the fault may be in the frame itself.
  const dark = typeof window !== 'undefined' && crashIsDark();
  return (
    <html lang="en" className={dark ? 'dark' : undefined}>
      <body style={{ margin: 0, background: dark ? '#101828' : '#ffffff' }}>
        <div
          role="alert"
          data-crash-screen=""
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 24px',
            background: 'var(--sf-page)',
            color: 'var(--sf-text)',
            fontFamily: 'var(--sf-font)',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '448px' }}>
            <h1 style={{ margin: 0, fontSize: '20px', lineHeight: '28px', fontWeight: 600 }}>Something went wrong</h1>
            <p style={{ margin: '8px 0 24px', fontSize: '14px', lineHeight: '20px', color: 'var(--sf-text-muted)' }}>
              MyScrumBudget<span className="sf-mark sf-mark--tm">™</span> could not display this page. Reload to try
              again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="sf-btn rounded bg-blue-600 px-4 text-white hover:bg-blue-700"
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
