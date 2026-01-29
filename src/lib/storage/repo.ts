import { createLocalStorageRepository } from './localStorage';

/** Shared repository singleton used across all hooks. */
export const repo = createLocalStorageRepository();
