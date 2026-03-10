/**
 * Lightweight pub/sub event bus for cloud sync.
 *
 * When onSnapshot detects remote changes in Firestore, events are emitted
 * on this bus. Hooks subscribe and re-fetch from the repo.
 *
 * In local-only mode no listeners are attached, so emissions are no-ops.
 */

export type SyncEventType = 'projects' | 'settings' | 'teamPool';

type Listener = (event: SyncEventType) => void;

const listeners = new Set<Listener>();

export const cloudSyncBus = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  emit(event: SyncEventType): void {
    for (const listener of listeners) {
      listener(event);
    }
  },
};
