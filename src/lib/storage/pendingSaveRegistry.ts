// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Module-level registry of cancel/flush callbacks from every mounted
 * useDebouncedSave instance, and a keyed cancel registry for per-project
 * delete-race prevention.
 *
 * v0.31.0: register() signature changed from register(cancel) to
 * register(cancel, flush). Only call site is useDebouncedSave.ts.
 */

// ── Global cancel + flush registry ──────────────────────────────────────────
const cancels = new Set<() => void>();
const flushes = new Set<() => Promise<void>>();

export function register(cancel: () => void, flush: () => Promise<void>): () => void {
  cancels.add(cancel);
  flushes.add(flush);
  return () => {
    cancels.delete(cancel);
    flushes.delete(flush);
  };
}

export function cancelAll(): void {
  for (const cancel of cancels) cancel();
}

export function flushAll(): Promise<void> {
  const settled: Promise<void>[] = [];
  for (const flush of flushes) {
    settled.push(flush().catch(() => {}));
  }
  return Promise.all(settled).then(() => undefined);
}

// ── Per-key cancel registry ──────────────────────────────────────────────────
const keyedCancels = new Map<string, Set<() => void>>();

export function registerKeyed(key: string, cancel: () => void): () => void {
  if (!keyedCancels.has(key)) keyedCancels.set(key, new Set());
  keyedCancels.get(key)!.add(cancel);
  return () => {
    keyedCancels.get(key)?.delete(cancel);
    if (keyedCancels.get(key)?.size === 0) keyedCancels.delete(key);
  };
}

export function cancelByKey(key: string): void {
  keyedCancels.get(key)?.forEach((cancel) => cancel());
}
