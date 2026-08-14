// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Never glob stale per-session git worktrees under .claude/worktrees/* —
    // they duplicate the entire suite N× in parallel, and the CPU contention
    // makes timing-sensitive debounce/waitFor hook tests flake out. (node_modules
    // and dist are vitest defaults; restated here since we override `exclude`.)
    //
    // .stryker-tmp holds Stryker's sandbox COPIES of the whole project, each with
    // a full duplicate of the suite — and, mid-run, with mutated source. Globbing
    // them made `npm test` report 238 files / 3728 tests with 8 failures that were
    // surviving mutants, not real regressions. Same failure shape as the worktrees
    // above: the suite silently triples and starts reporting another run's results.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**', '**/.stryker-tmp/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
