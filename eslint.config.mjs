// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";

const eslintConfig = defineConfig([
  // .stryker-tmp holds Stryker's sandbox COPIES of the whole project — including,
  // mid-run, deliberately mutated source. Linting them reported 522 problems
  // against an accepted baseline of 14, all of them from duplicated files.
  // reports/ is Stryker's generated output. Both are build artifacts.
  { ignores: [".claude/**", ".stryker-tmp/**", "reports/**"] },
  // Cognitive complexity only — NOT sonarjs.configs.recommended. The plugin is
  // here to answer "where is this code hard to change safely?", which is the one
  // question scripts/measure-complexity.mjs needs it present for. Threshold 15
  // matches spert-scheduler and spert-forecaster.
  //
  // The accepted baseline lives in exactly one place — `expectProblems` on the
  // lint step in shipgate.config.json. `npm run lint` exits NON-ZERO at that
  // baseline and that is correct: gate on the NUMBER, never the exit code.
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { sonarjs },
    rules: { "sonarjs/cognitive-complexity": ["error", 15] },
  },
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
