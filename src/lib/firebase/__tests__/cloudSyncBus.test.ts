import { describe, it, expect, vi } from 'vitest';
import { cloudSyncBus } from '../cloudSyncBus';

describe('cloudSyncBus', () => {
  it('emits events to subscribers', () => {
    const listener = vi.fn();
    const unsub = cloudSyncBus.subscribe(listener);

    cloudSyncBus.emit('projects');
    expect(listener).toHaveBeenCalledWith('projects');
    expect(listener).toHaveBeenCalledTimes(1);

    cloudSyncBus.emit('settings');
    expect(listener).toHaveBeenCalledWith('settings');
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
  });

  it('unsubscribe stops receiving events', () => {
    const listener = vi.fn();
    const unsub = cloudSyncBus.subscribe(listener);

    cloudSyncBus.emit('projects');
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    cloudSyncBus.emit('projects');
    expect(listener).toHaveBeenCalledTimes(1); // still 1
  });

  it('supports multiple subscribers', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const unsub1 = cloudSyncBus.subscribe(listener1);
    const unsub2 = cloudSyncBus.subscribe(listener2);

    cloudSyncBus.emit('teamPool');
    expect(listener1).toHaveBeenCalledWith('teamPool');
    expect(listener2).toHaveBeenCalledWith('teamPool');

    unsub1();
    unsub2();
  });

  it('handles empty listener set without error', () => {
    // Should not throw
    cloudSyncBus.emit('projects');
  });
});
