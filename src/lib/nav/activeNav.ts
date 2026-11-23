// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/** The navigation row's items that can be the current page (contract §3). Help Center leaves the app and never is. */
export type NavHref = '/' | '/team' | '/settings' | '/about';

/**
 * Which navigation item names the current page (FRAME26 contract §3, "Active item"), or null.
 *
 * - Every `/projects/...` route (a project, its edit page, New project) belongs to the collection, "Projects" (`/`).
 * - A route no item leads to marks NOTHING: `/changelog` (reached from the footer's Version link) and any 404.
 * - A path that only shares a prefix is not current: `/teams` is not `/team`.
 *
 * Moved here from `Sidebar.tsx`'s `isCurrentNavItem` (stage 0, v0.44.14) when the sidebar gave way to the frame.
 */
export function activeNavHref(pathname: string | null): NavHref | null {
  if (!pathname) return null;
  // `/projects` alone is not a route (it is a 404), so it is not current: only its children are.
  if (pathname === '/' || pathname.startsWith('/projects/')) return '/';
  for (const href of ['/team', '/settings', '/about'] as const) {
    if (pathname === href || pathname.startsWith(href + '/')) return href;
  }
  return null;
}

/**
 * Whether the screen's body is capped (exception X4, contract §8: every app's Settings, About and Changelog). The
 * heading row stays full width; the stylesheet caps every other child of `main` at 896 px.
 */
export function bodyCapped(pathname: string | null): boolean {
  if (!pathname) return false;
  return ['/settings', '/about', '/changelog'].some((p) => pathname === p || pathname.startsWith(p + '/'));
}
