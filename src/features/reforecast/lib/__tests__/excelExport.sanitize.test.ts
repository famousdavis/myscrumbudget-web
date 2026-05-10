// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { xlsxSanitize } from '../excelExport';

describe('xlsxSanitize', () => {
  it('passes plain strings through unchanged', () => {
    expect(xlsxSanitize('Alice')).toBe('Alice');
    expect(xlsxSanitize('Senior Developer')).toBe('Senior Developer');
    expect(xlsxSanitize('Resource Plan — Demo — Baseline')).toBe(
      'Resource Plan — Demo — Baseline',
    );
  });

  it('prepends an apostrophe when the value starts with =', () => {
    expect(xlsxSanitize('=cmd|\'/c calc\'!A1')).toBe("'=cmd|'/c calc'!A1");
    expect(xlsxSanitize('=HYPERLINK("https://evil.example","x")')).toBe(
      '\'=HYPERLINK("https://evil.example","x")',
    );
  });

  it('prepends an apostrophe for +, -, @, tab, and CR prefixes', () => {
    expect(xlsxSanitize('+1+1')).toBe("'+1+1");
    expect(xlsxSanitize('-2')).toBe("'-2");
    expect(xlsxSanitize('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
    expect(xlsxSanitize('\tinjected')).toBe("'\tinjected");
    expect(xlsxSanitize('\rrow')).toBe("'\rrow");
  });

  it('does not double-escape an already-prefixed string', () => {
    // First call adds '. Second call sees ' (not in the trigger set) and is a no-op.
    const once = xlsxSanitize('=evil');
    expect(once).toBe("'=evil");
    expect(xlsxSanitize(once)).toBe("'=evil");
  });

  it('handles null and undefined as empty string', () => {
    expect(xlsxSanitize(null)).toBe('');
    expect(xlsxSanitize(undefined)).toBe('');
  });

  it('coerces numbers and booleans via String() — does not trigger formula prefix', () => {
    expect(xlsxSanitize(42)).toBe('42');
    expect(xlsxSanitize(true)).toBe('true');
  });

  it('does not trigger on prefixes that are not the first character', () => {
    expect(xlsxSanitize('Alice = Bob')).toBe('Alice = Bob');
    expect(xlsxSanitize('Cost +5')).toBe('Cost +5');
  });
});
