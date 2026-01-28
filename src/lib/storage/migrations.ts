import type { AppState } from '@/types/domain';

export const CURRENT_VERSION = '1.0.0';

type Migration = {
  version: string;
  migrate: (data: AppState) => AppState;
};

const MIGRATIONS: Migration[] = [];

export function runMigrations(data: AppState, fromVersion: string): AppState {
  const pendingMigrations = MIGRATIONS.filter(
    (m) => compareVersions(m.version, fromVersion) > 0
  );

  if (pendingMigrations.length === 0) return data;

  let migrated = data;
  for (const migration of pendingMigrations) {
    migrated = migration.migrate(migrated);
    migrated = { ...migrated, version: migration.version };
  }

  return { ...migrated, version: CURRENT_VERSION };
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
