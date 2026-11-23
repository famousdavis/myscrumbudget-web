// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { APP_TAGLINE } from '@/lib/constants';
import { ThemeToggle } from '@/components/ThemeToggle';
import { StorageStatusPill } from '@/components/StorageStatusPill';
import { CloudStorageModal } from '@/components/CloudStorageModal';
import { MigrationGuard } from '@/components/MigrationGuard';
import { RepositoryGate } from '@/components/RepositoryProvider';

/*
 * The frame's brand row (FRAME26, contract §3, v0.45.0): a 56 px band on the page ground, in the shared 1600 px column.
 * It replaced the sidebar's brand and `TopBar`.
 *
 * The brand is ONE LINK to the collection screen ("/", Projects). It has no aria-label: its accessible name is its
 * visible title, "MyScrumBudget™" (WCAG 2.5.3, label in name). Both favicons are decorative (`alt=""`) for the same
 * reason; the stylesheet shows the one for the current theme (`.sf-icon--light` / `--dark`), so a dark load never
 * flashes the light file (the sidebar swapped one <img> in JavaScript and did).
 *
 * The title is NOT a heading. The page's one `h1` is the heading row's, in `main` (contract §2).
 *
 * The title's colour (HDR26, v0.44.12; moved onto the frame at v0.45.0): MyScrumBudget's favicon green as a gradient
 * from its light end on the left to its dark end on the right, drawn with the frame's `.sf-grad`. The ramps are
 * `--app-grad-light` and `--app-grad-dark`, set once on `:root` in `src/app/globals.css`. The title is 24 px bold,
 * which is large text, so each ramp is checked at every point at 3 : 1 against the frame's page ground: light
 * `#10843b` → `#00471b` on `#ffffff`, weakest 4.78; dark `#62c679` → `#008b3b` on `#101828`, weakest 4.01 (4.0194).
 * A change to either end, or to the ground, needs a new measurement (`AppHeader.title-gradient.test.ts`). For the same
 * reason nothing between the brand and the title paints a ground, fades or hovers.
 *
 * The fallbacks are the frame's, not this file's: under `prefers-contrast: more` the title is solid in the frame's
 * heading colour (`#333333` / `#e2e8f0`), and in print it is solid black (`spert-frame.css`, `.sf-grad`). The ™ is the
 * frame's muted `.sf-mark--tm`, outside the gradient span.
 *
 * The Cloud Storage modal opens from the chip. It sits behind `MigrationGuard` and `RepositoryGate`, as it did when it
 * lived inside the page's provider stack (`TopBar`, before v0.45.0): it reads the repository, so it must never open
 * before migration or while a cloud session's auth is resolving. Its `font-sans` wrapper keeps the body's font (Geist)
 * for the dialog: `.sf-app` sets the frame's own font stack, and there are no portals here, so a dialog inherits from
 * where it is rendered.
 */
export function AppHeader() {
  const [cloudModalOpen, setCloudModalOpen] = useState(false);

  return (
    <>
      <header className="sf-bar">
        <div className="sf-col sf-bar-row">
          <Link href="/" className="sf-brand" data-sf="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/spert-favicon-myscrumbudget.png"
              alt=""
              className="sf-icon sf-icon--light ring-1 ring-white/20"
              data-sf="favicon"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/spert-favicon-myscrumbudget-dark.png"
              alt=""
              className="sf-icon sf-icon--dark ring-1 ring-white/20"
              data-sf="favicon"
            />
            <span className="sf-title" data-sf="title">
              <span className="sf-grad">MyScrumBudget</span><span className="sf-mark sf-mark--tm">™</span>
            </span>
          </Link>
          <p className="sf-tagline" data-sf="tagline">{APP_TAGLINE}</p>
          <div className="sf-utils" data-sf="utils">
            <ThemeToggle />
            <StorageStatusPill onOpen={() => setCloudModalOpen(true)} />
          </div>
        </div>
      </header>
      {/* After the header, not inside it: a dialog does not belong to the banner landmark. */}
      {cloudModalOpen && (
        <MigrationGuard>
          <RepositoryGate>
            <div className="font-sans">
              <CloudStorageModal onClose={() => setCloudModalOpen(false)} />
            </div>
          </RepositoryGate>
        </MigrationGuard>
      )}
    </>
  );
}
