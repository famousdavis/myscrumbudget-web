import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWorkspaceId,
  WORKSPACE_ID_KEY,
  ensureOriginRef,
  getOriginRef,
  appendToChangeLog,
  getChangeLog,
  setChangeLog,
  getExportAttribution,
  setExportAttribution,
  CHANGELOG_MAX_ENTRIES,
} from '../fingerprint';
import { STORAGE_KEYS } from '@/types/storage';

describe('Fingerprint utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getWorkspaceId', () => {
    it('generates a UUID on first call', () => {
      const id = getWorkspaceId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('returns the same value on subsequent calls', () => {
      const first = getWorkspaceId();
      const second = getWorkspaceId();
      expect(first).toBe(second);
    });

    it('returns existing value from localStorage', () => {
      localStorage.setItem(WORKSPACE_ID_KEY, 'pre-existing-id');
      expect(getWorkspaceId()).toBe('pre-existing-id');
    });
  });

  describe('ensureOriginRef', () => {
    it('sets originRef from workspace ID on first call', () => {
      const ref = ensureOriginRef();
      expect(ref).toBe(getWorkspaceId());
      expect(localStorage.getItem(STORAGE_KEYS.originRef)).toBe(ref);
    });

    it('does not overwrite existing originRef', () => {
      localStorage.setItem(STORAGE_KEYS.originRef, 'original-ref');
      const ref = ensureOriginRef();
      expect(ref).toBe('original-ref');
    });
  });

  describe('getOriginRef', () => {
    it('returns empty string when nothing stored', () => {
      expect(getOriginRef()).toBe('');
    });

    it('returns stored value', () => {
      localStorage.setItem(STORAGE_KEYS.originRef, 'my-ref');
      expect(getOriginRef()).toBe('my-ref');
    });
  });

  describe('appendToChangeLog', () => {
    it('adds entry with unix-seconds timestamp', () => {
      const before = Math.floor(Date.now() / 1000);
      appendToChangeLog({ op: 'add', entity: 'project', id: 'p1' });
      const after = Math.floor(Date.now() / 1000);
      const log = getChangeLog();
      expect(log).toHaveLength(1);
      expect(log[0].op).toBe('add');
      expect(log[0].entity).toBe('project');
      expect(log[0].id).toBe('p1');
      expect(log[0].t).toBeGreaterThanOrEqual(before);
      expect(log[0].t).toBeLessThanOrEqual(after);
    });

    it('appends to existing log', () => {
      appendToChangeLog({ op: 'add', entity: 'project', id: 'p1' });
      appendToChangeLog({ op: 'delete', entity: 'project', id: 'p1' });
      const log = getChangeLog();
      expect(log).toHaveLength(2);
      expect(log[0].op).toBe('add');
      expect(log[1].op).toBe('delete');
    });

    it('caps at CHANGELOG_MAX_ENTRIES', () => {
      // Seed with max entries
      const seed = Array.from({ length: CHANGELOG_MAX_ENTRIES }, (_, i) => ({
        t: i,
        op: 'add',
        entity: 'project',
        id: `p${i}`,
      }));
      setChangeLog(seed);

      appendToChangeLog({ op: 'add', entity: 'project', id: 'overflow' });
      const log = getChangeLog();
      expect(log).toHaveLength(CHANGELOG_MAX_ENTRIES);
      // The first entry should be gone; last entry is our new one
      expect(log[log.length - 1].id).toBe('overflow');
      expect(log[0].id).toBe('p1'); // p0 was dropped
    });
  });

  describe('getChangeLog', () => {
    it('returns empty array when nothing stored', () => {
      expect(getChangeLog()).toEqual([]);
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEYS.changeLog, 'not-valid-json{{{');
      expect(getChangeLog()).toEqual([]);
    });

    it('handles non-array JSON gracefully', () => {
      localStorage.setItem(STORAGE_KEYS.changeLog, '"just a string"');
      expect(getChangeLog()).toEqual([]);
    });
  });

  describe('getExportAttribution / setExportAttribution', () => {
    it('returns defaults when nothing stored', () => {
      expect(getExportAttribution()).toEqual({ name: '', id: '' });
    });

    it('round-trips correctly', () => {
      setExportAttribution({ name: 'Jane', id: 'j123' });
      expect(getExportAttribution()).toEqual({ name: 'Jane', id: 'j123' });
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEYS.exportAttribution, 'bad-json');
      expect(getExportAttribution()).toEqual({ name: '', id: '' });
    });
  });
});
