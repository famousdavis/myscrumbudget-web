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
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
