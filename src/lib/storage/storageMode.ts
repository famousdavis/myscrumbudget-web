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
