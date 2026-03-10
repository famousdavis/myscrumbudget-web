// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

export type StorageMode = 'local' | 'cloud';

const STORAGE_MODE_KEY = 'msb:storageMode';

export function getStorageMode(): StorageMode {
  if (typeof window === 'undefined') return 'local';
  const mode = localStorage.getItem(STORAGE_MODE_KEY);
  return mode === 'cloud' ? 'cloud' : 'local';
}

export function setStorageMode(mode: StorageMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_MODE_KEY, mode);
}
