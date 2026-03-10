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
