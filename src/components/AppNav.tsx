// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { activeNavHref, type NavHref } from '@/lib/nav/activeNav';

/** The app's work items, left: the collection first (contract §3, "Navigation zones"). */
const WORK_ITEMS: readonly { href: NavHref; label: string }[] = [
  { href: '/', label: 'Projects' },
  { href: '/team', label: 'Team Pool' },
];

/** The app zone, right: Settings · About, then Help Center, always in that order (contract §2). */
const APP_ITEMS: readonly { href: NavHref; label: string }[] = [
  { href: '/settings', label: 'Settings' },
  { href: '/about', label: 'About' },
];

/**
 * MyScrumBudget's page in the SPERT® Suite Help Center. Defined here, unexported, beside its one link.
 * `AppNav.frame.test.tsx` pins it as a literal string rather than importing it, so a wrong slug here fails that test.
 */
const HELP_CENTER_URL = 'https://spertsuite.com/help/myscrumbudget';

function NavItem({ href, label, active }: { href: NavHref; label: string; active: NavHref | null }) {
  // The active item is marked by `aria-current="page"` alone: the frame's stylesheet draws its underline and colour
  // from that attribute, at the same weight as every other item, so nothing moves when the page changes. The attribute
  // is OMITTED, not "false", on every other item. No utility class: `.sf-tab` sets the colour but not the background,
  // so a `hover:bg-*` would still paint.
  return (
    <Link href={href} className="sf-tab" aria-current={href === active ? 'page' : undefined}>
      {label}
    </Link>
  );
}

/**
 * The frame's navigation row (FRAME26, contract §3, v0.45.0): a full-width 44 px band under the brand row, with a 1 px
 * rule. It replaced the sidebar (v0.44.14 and before), whose mobile drawer is gone (phones are not a target, §1).
 *
 * "Dashboard" became "Projects" (contract §2: each collection is named by its noun). Every `/projects/...` route marks
 * Projects; `/changelog` and a 404 mark nothing (`activeNavHref`).
 *
 * Help Center is a LINK that leaves the app, never a nav item: not in either list, never `aria-current`. It is the
 * row's last element, after About (contract §2's order, William 2026-11-23, which superseded v0.44.11's "immediately
 * before About"), in quiet 400-weight muted text (`.sf-help`). ⚠️ The spaces are their own text nodes, outside the
 * spans: with a space inside a span, the accessible-name computation trims it and gives "Help Center(opens in a new
 * tab)" (measured, v0.44.11).
 */
export function AppNav() {
  const active = activeNavHref(usePathname());
  return (
    <nav className="sf-nav" data-sf="nav">
      <div className="sf-col sf-nav-row">
        <div className="sf-nav-work" data-sf="nav-work">
          {WORK_ITEMS.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label} active={active} />
          ))}
        </div>
        <div className="sf-nav-app" data-sf="nav-app">
          {APP_ITEMS.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label} active={active} />
          ))}
          <a href={HELP_CENTER_URL} target="_blank" rel="noopener noreferrer" className="sf-help">
            Help Center{' '}<span aria-hidden="true">↗</span>{' '}
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </div>
    </nav>
  );
}
