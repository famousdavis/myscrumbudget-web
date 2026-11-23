// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDarkMode } from '@/hooks/useDarkMode';

/**
 * MyScrumBudget's page in the SPERT® Suite Help Center. It is defined here,
 * unexported, because it has exactly one use: the sidebar link below.
 * `Sidebar.test.tsx` pins it as a literal string rather than importing it, so a
 * wrong slug here fails that test instead of passing it.
 */
const HELP_CENTER_URL = 'https://spertsuite.com/help/myscrumbudget';

/**
 * The sidebar title's colour (HDR26, v0.44.12): MyScrumBudget's favicon green,
 * `#16a34a`, as a gradient from its light end to its dark end, in each theme.
 * The title is 18 px bold, which is not large text, so every point of each
 * ramp must reach 4.5 : 1 on the sidebar behind it (`#fafafa` / `#09090b`).
 * The dark ramp sits exactly at that bar. A change to either end, or to the
 * sidebar's background, needs a new measurement:
 * `__tests__/Sidebar.title-gradient.test.ts` pins both.
 *
 * In print, and when the system asks for more contrast, the title falls back to
 * solid text in the page's own foreground (`--foreground` in `globals.css`):
 * `#171717`, or `#ededed` in the dark theme.
 *
 * One literal string, because Tailwind writes CSS only for class names it finds
 * written out in the source. With `text-transparent` and no gradient, the
 * title would be invisible. The ™ `<sup>` stays OUTSIDE the gradient span, in
 * the same wrapper: made a flex item of the link, it would open an 8 px gap.
 */
const TITLE_GRADIENT =
  'bg-gradient-to-r from-[#10843b] to-[#00471b] dark:from-[#62c679] dark:to-[#008b3b] bg-clip-text text-transparent print:bg-none print:text-[#171717] contrast-more:bg-none contrast-more:text-[#171717] dark:contrast-more:text-[#ededed]';

const NAV_ITEM =
  'block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800';

/**
 * The current-page item (FRAME26 stage 0): the accent text colour plus a 2 px
 * accent bar inside its left edge, at the SAME weight, so nothing moves when
 * the page changes. The bar is the cue that is not colour alone (WCAG 1.4.1):
 * #0070f3 is 4.36 : 1 on the sidebar's #fafafa and 4.37 : 1 on #09090b.
 */
const NAV_ITEM_CURRENT =
  'block rounded-md px-3 py-2 text-sm font-medium text-[#155dfc] shadow-[inset_2px_0_0_#0070f3] hover:bg-zinc-200 dark:text-[#51a2ff] dark:hover:bg-zinc-800';

/**
 * Which item names the current page. Every /projects/... route belongs to the
 * collection, "Dashboard" ("/"). Pages no item leads to (/changelog) mark
 * nothing. Help Center leaves the app and never names the current page.
 */
function isCurrentNavItem(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/' || pathname.startsWith('/projects/');
  return pathname === href || pathname.startsWith(href + '/');
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const isDark = useDarkMode();
  const pathname = usePathname();
  const navItemProps = (href: string) =>
    isCurrentNavItem(href, pathname)
      ? { className: NAV_ITEM_CURRENT, 'aria-current': 'page' as const }
      : { className: NAV_ITEM };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed left-4 top-4 z-50 rounded-md border border-zinc-300 bg-white p-2 shadow-sm md:hidden dark:border-zinc-700 dark:bg-zinc-900"
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={open}
      >
        {open ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path
              fillRule="evenodd"
              d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Overlay backdrop (mobile only) */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar nav */}
      <nav
        className={`fixed z-40 h-full w-56 shrink-0 border-r border-zinc-200 bg-zinc-50 transition-transform md:sticky md:top-0 md:h-auto md:self-stretch md:translate-x-0 dark:border-zinc-800 dark:bg-zinc-950 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="p-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-bold tracking-tight"
              onClick={() => setOpen(false)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  isDark
                    ? '/spert-favicon-myscrumbudget-dark.png'
                    : '/spert-favicon-myscrumbudget.png'
                }
                alt=""
                className="mr-2 h-7 w-7 rounded-lg ring-1 ring-white/20"
              />
              <span>
                <span className={TITLE_GRADIENT}>MyScrumBudget</span>
                <sup className="text-[7px] font-normal text-zinc-400 dark:text-zinc-500">
                  TM
                </sup>
              </span>
            </Link>
          </div>
          <ul className="flex flex-col gap-1 px-2">
            <li>
              <Link
                href="/"
                onClick={() => setOpen(false)}
                {...navItemProps('/')}
              >
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/team"
                onClick={() => setOpen(false)}
                {...navItemProps('/team')}
              >
                Team Pool
              </Link>
            </li>
            <li>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                {...navItemProps('/settings')}
              >
                Settings
              </Link>
            </li>
            {/*
              Help Center (v0.44.11): a plain <a>, not next/link, because it
              leaves the app. It sits immediately before About, by William's
              placement rule for the suite. The spaces sit OUTSIDE both spans
              on purpose: the accessible-name computation trims a span's own
              leading space, so with the space inside, the name reads
              "Help Center(opens in a new tab)".
              It never carries the current-page style: it never names the
              current page (see isCurrentNavItem).
            */}
            <li>
              <a
                href={HELP_CENTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={NAV_ITEM}
              >
                Help Center{' '}<span aria-hidden="true">↗</span>{' '}
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
            <li>
              <Link
                href="/about"
                onClick={() => setOpen(false)}
                {...navItemProps('/about')}
              >
                About
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </>
  );
}
