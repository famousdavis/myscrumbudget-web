// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The root layout on the frame (FRAME26, v0.45.0). REWRITTEN from `layout.skip-link.test.ts`, which pinned stage 0's
 * skip link in `layout.tsx` (`top-2 -translate-y-[calc(100%+1rem)] focus:translate-y-0`, MSB-3). The skip link moved
 * into the frame (`AppShell`, `.sf-skip`), and the stylesheet now hides it at rest (above the window, `top: -64px`)
 * and shows it at the top left on focus (`top: 8px`); `AppShell.frame.test.tsx` pins it as the first element.
 *
 * What the layout itself now owns is the provider stack, which wraps the WHOLE frame because the account chip and the
 * notices sit outside `<main>`. Its order matters: `RepositoryProvider` reads `useAuth`, `MigrationProvider` must be
 * above every `MigrationGuard`, and `RepositoryProvider` above every `RepositoryGate`. jsdom cannot render `<html>`,
 * so this reads the source.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { rule } from '@/styles/__tests__/frameTokens.testkit';

const LAYOUT = readFileSync(join(process.cwd(), 'src', 'app', 'layout.tsx'), 'utf8');
/** The layout's JSX from <body> on, with its {/* … *\/} comments removed (they name <main> in prose). */
const BODY_JSX = LAYOUT.slice(LAYOUT.indexOf('<body')).replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('layout: the providers around the frame', () => {
  it('nests AuthProvider > MigrationProvider > RepositoryProvider > ToastProvider > AppShell', () => {
    const jsx = BODY_JSX;
    const opens = Array.from(jsx.matchAll(/<(AuthProvider|MigrationProvider|RepositoryProvider|ToastProvider|AppShell)\b/g)).map((m) => m[1]);
    expect(opens).toEqual(['AuthProvider', 'MigrationProvider', 'RepositoryProvider', 'ToastProvider', 'AppShell']);
    expect(jsx).toMatch(/<AppShell>\{children\}<\/AppShell>/);
  });

  it('renders no frame of its own: no skip link, no main, no sidebar, no footer, no MigrationGuard', () => {
    const jsx = BODY_JSX;
    expect(jsx).toMatch(/<AuthProvider>/); // must-find: the reader sees the JSX
    expect(jsx).not.toMatch(/<a\s|<main|<Sidebar|<Footer|<MigrationGuard|<ShellTop/);
  });

  it('the stylesheet hides the skip link at rest and shows it on focus', () => {
    expect(rule('.sf-skip')).toMatch(/position:\s*absolute;[\s\S]*top:\s*-64px/);
    expect(rule('.sf-skip:focus')).toMatch(/top:\s*8px/);
  });
});
