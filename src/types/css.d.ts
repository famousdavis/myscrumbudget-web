// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// TypeScript 6.0 tightened side-effect import checking (noUncheckedSideEffectImports),
// so untyped CSS imports such as `import './globals.css'` in layout.tsx now require an
// ambient module declaration. This shim restores the pre-6.0 behavior for all CSS imports.
declare module '*.css';
