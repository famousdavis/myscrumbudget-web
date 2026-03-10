// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach } from 'vitest';
import { getStorageMode, setStorageMode } from '../storageMode';

describe('storageMode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to local when no key set', () => {
    expect(getStorageMode()).toBe('local');
  });

  it('returns stored mode', () => {
    setStorageMode('cloud');
    expect(getStorageMode()).toBe('cloud');
  });

  it('switches back to local', () => {
    setStorageMode('cloud');
    setStorageMode('local');
    expect(getStorageMode()).toBe('local');
  });

  it('treats invalid values as local', () => {
    localStorage.setItem('msb:storageMode', 'invalid');
    expect(getStorageMode()).toBe('local');
  });
});
