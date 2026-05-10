// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Forbidden object keys that JSON.parse can produce as own-properties from
 * input like `{"__proto__": {...}}`. Any subsequent spread, `Object.assign`,
 * or for-in iteration on such an object can pollute `Object.prototype` for
 * the entire runtime — a classic prototype-pollution sink that has historically
 * enabled RCE in Node ecosystems.
 *
 * Stripping these keys at the parse boundary (the reviver runs as JSON.parse
 * walks the tree) is the cheapest, most durable defense.
 */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Parse user-supplied JSON with prototype-pollution defenses.
 *
 * Equivalent to `JSON.parse(text)`, except any object key in
 * {`__proto__`, `constructor`, `prototype`} is silently dropped at parse
 * time. Throws SyntaxError on malformed JSON, matching native JSON.parse.
 *
 * Used at every import boundary that ingests user-controlled JSON
 * (DataPortability import-JSON flow, future external integrations).
 */
export function parseImportJson(text: string): unknown {
  return JSON.parse(text, (key, value) => {
    if (FORBIDDEN_KEYS.has(key)) return undefined;
    return value;
  });
}
