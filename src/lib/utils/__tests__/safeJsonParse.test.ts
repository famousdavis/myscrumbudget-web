// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { parseImportJson } from '../safeJsonParse';

describe('parseImportJson', () => {
  it('parses regular JSON identically to JSON.parse', () => {
    const json = '{"name":"Alpha","reforecasts":[{"id":"r1","actualCost":100}],"version":"0.13.0"}';
    expect(parseImportJson(json)).toEqual({
      name: 'Alpha',
      reforecasts: [{ id: 'r1', actualCost: 100 }],
      version: '0.13.0',
    });
  });

  it('strips top-level __proto__ key (prototype-pollution defense)', () => {
    const json = '{"__proto__":{"isAdmin":true},"version":"0.13.0"}';
    const out = parseImportJson(json) as Record<string, unknown>;
    expect(out.version).toBe('0.13.0');
    expect(Object.prototype.hasOwnProperty.call(out, '__proto__')).toBe(false);
    // And the global prototype is unaffected.
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
  });

  it('strips nested __proto__ keys', () => {
    const json = '{"projects":[{"name":"P","__proto__":{"x":1}}]}';
    const out = parseImportJson(json) as { projects: Array<Record<string, unknown>> };
    expect(out.projects[0].name).toBe('P');
    expect(Object.prototype.hasOwnProperty.call(out.projects[0], '__proto__')).toBe(false);
  });

  it('strips constructor and prototype keys at any depth', () => {
    const json = '{"a":{"constructor":"x","b":{"prototype":"y","keep":"yes"}}}';
    const out = parseImportJson(json) as Record<string, Record<string, unknown>>;
    expect(out.a.b).toEqual({ keep: 'yes' });
    expect(Object.prototype.hasOwnProperty.call(out.a, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out.a.b, 'prototype')).toBe(false);
  });

  it('preserves keys that merely contain forbidden substrings', () => {
    const json = '{"my__proto__":1,"prototypish":2,"_constructor_":3}';
    expect(parseImportJson(json)).toEqual({
      my__proto__: 1,
      prototypish: 2,
      _constructor_: 3,
    });
  });

  it('throws SyntaxError on malformed JSON (matches native parse)', () => {
    expect(() => parseImportJson('{not valid')).toThrow(SyntaxError);
  });
});
