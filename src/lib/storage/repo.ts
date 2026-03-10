import { createLocalStorageRepository } from './localStorage';
import type { Repository } from './repository';

/**
 * Active repository implementation.
 * Starts as localStorage; switched to Firestore when user enables cloud mode.
 */
let activeImpl: Repository = createLocalStorageRepository();

/**
 * Delegating repository — all hooks import `repo` from this module.
 * Method calls are forwarded to whichever implementation is currently active.
 * This avoids refactoring every hook when switching between local and cloud.
 */
export const repo: Repository = {
  getSettings: (...args) => activeImpl.getSettings(...args),
  saveSettings: (...args) => activeImpl.saveSettings(...args),
  getTeamPool: (...args) => activeImpl.getTeamPool(...args),
  saveTeamPool: (...args) => activeImpl.saveTeamPool(...args),
  getProjects: (...args) => activeImpl.getProjects(...args),
  getProject: (...args) => activeImpl.getProject(...args),
  saveProject: (...args) => activeImpl.saveProject(...args),
  createProject: (...args) => activeImpl.createProject(...args),
  deleteProject: (...args) => activeImpl.deleteProject(...args),
  reorderProjects: (...args) => activeImpl.reorderProjects(...args),
  exportAll: (...args) => activeImpl.exportAll(...args),
  importAll: (...args) => activeImpl.importAll(...args),
  clear: (...args) => activeImpl.clear(...args),
  getVersion: (...args) => activeImpl.getVersion(...args),
  migrateIfNeeded: (...args) => activeImpl.migrateIfNeeded(...args),
};

/**
 * Swap the active repository implementation at runtime.
 * Called when user toggles between local and cloud storage modes.
 */
export function switchRepoImpl(impl: Repository): void {
  activeImpl = impl;
}
