// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { CHANGELOG } from '../../app/changelog/changelogData';

/**
 * The changelog lives in two places and nothing has ever held them together:
 *
 *   - `src/app/changelog/changelogData.ts` — what the app renders. This is the
 *     authoritative, complete history.
 *   - `CHANGELOG.md` — the record in the repository.
 *
 * The two now hold the same 83 versions, and this is the first point at which
 * that has ever been true. `CHANGELOG.md` was missing 21 versions the app had
 * always rendered: 0.6.0 through 0.16.3 were transcribed in v0.34.5, and the
 * last five — 0.18.6, 0.18.7, 0.18.8, 0.20.0 and 0.28.0, scattered across three
 * separate anchors — in v0.34.6. KNOWN_MISSING_FROM_MARKDOWN is deliberately
 * kept at zero length rather than deleted; see the note on it below.
 *
 * The same defect is still open elsewhere in the suite: SPERT Scheduler is
 * missing 33 versions and GanttApp 17, each recorded and ratcheted the same way.
 * SPERT AHP was missing one and closed it in v0.18.16.
 *
 * The second failure mode is an entry that renders as a bare heading. An entry
 * with no sections, or a section with no items, produces exactly that — and the
 * data file is valid TypeScript either way, so the build, types and lint all
 * stay green. SPERT Forecaster shipped two such entries and they were blank
 * in-app for weeks before anyone noticed.
 */

/**
 * Versions present in `changelogData.ts` but absent from `CHANGELOG.md`. Empty
 * as of 2026-07-31, and it should stay that way.
 *
 * This is kept at zero length on purpose rather than deleted, and the two tests
 * that read it are kept with it. Emptied, they assert something stronger than
 * they did while it had names in it: the "no NEW gap" test becomes a plain
 * every-version-is-in-both check with no exemptions, and the ratchet below it
 * becomes a guard against anyone reintroducing an exemption. Deleting the list
 * would mean deleting both, and the next release that forgot a changelog entry
 * would land unnoticed — which is the exact defect that took 21 versions to
 * accumulate here. Both directions were re-verified by mutation once the list
 * was emptied, not assumed.
 *
 * DO NOT add a name here to make a failing test pass. A name here means a
 * release was written into the app and never into the repository's changelog.
 * Write the entry instead; that is a two-minute job and this list is not.
 *
 * One trap, learned closing this out: an entry whose heading does not match
 * `## [X.Y.Z] - YYYY-MM-DD` exactly is invisible to the regex below, and while
 * a version sits on this list that failure is SILENT — the entry is in the
 * file, uncounted, and every assertion here still passes. With the list empty
 * that hole is closed, because there is nothing left to exempt a malformed
 * entry from the "no NEW gap" check.
 */
const KNOWN_MISSING_FROM_MARKDOWN: string[] = [];

describe('changelog surfaces agree', () => {
  const markdown = readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf-8');

  const markdownVersions = [...markdown.matchAll(/^## \[([\d.]+)\]/gm)]
    .map((m) => m[1])
    .filter((v): v is string => v !== undefined);
  const dataVersions = CHANGELOG.map((e) => e.version);

  it('both surfaces carry entries', () => {
    expect(dataVersions.length).toBeGreaterThan(0);
    expect(markdownVersions.length).toBeGreaterThan(0);
  });

  it('every CHANGELOG.md entry also exists in the app', () => {
    const missing = markdownVersions.filter((v) => !dataVersions.includes(v));

    expect(
      missing,
      `these versions are in CHANGELOG.md but never render in the app: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('opens no NEW gap between the app and CHANGELOG.md', () => {
    const missing = dataVersions.filter((v) => !markdownVersions.includes(v));
    const unexpected = missing.filter((v) => !KNOWN_MISSING_FROM_MARKDOWN.includes(v));

    expect(
      unexpected,
      `these versions render in the app but were never written into CHANGELOG.md: ` +
        `${unexpected.join(', ')}. Add the entry to CHANGELOG.md — do not add it to ` +
        `KNOWN_MISSING_FROM_MARKDOWN.`,
    ).toEqual([]);
  });

  it('keeps the recorded gap accurate as entries are backfilled', () => {
    // The ratchet: once a version is backfilled it must leave the list, so the
    // recorded debt stays honest and can only shrink.
    const stillMissing = new Set(dataVersions.filter((v) => !markdownVersions.includes(v)));
    const backfilled = KNOWN_MISSING_FROM_MARKDOWN.filter((v) => !stillMissing.has(v));

    expect(
      backfilled,
      `these versions are now in CHANGELOG.md — remove them from ` +
        `KNOWN_MISSING_FROM_MARKDOWN: ${backfilled.join(', ')}`,
    ).toEqual([]);
  });

  it('agrees on the newest entry', () => {
    expect(dataVersions[0]).toBe(markdownVersions[0]);
  });

  it('gives every entry at least one section', () => {
    const empty = CHANGELOG.filter((e) => e.sections.length === 0).map((e) => e.version);

    expect(
      empty,
      `these versions render as a bare heading with no content: ${empty.join(', ')}`,
    ).toEqual([]);
  });

  it('gives every section at least one item', () => {
    const empty = CHANGELOG.flatMap((e) =>
      e.sections.filter((s) => s.items.length === 0).map((s) => `v${e.version} → "${s.title}"`),
    );

    expect(
      empty,
      `these sections render as a heading with nothing beneath it: ${empty.join('; ')}`,
    ).toEqual([]);
  });
});
