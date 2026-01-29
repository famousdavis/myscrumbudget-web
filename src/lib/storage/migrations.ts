import type { AppState, PoolMember, ProjectAssignment } from '@/types/domain';

export const DATA_VERSION = '0.2.0';

type Migration = {
  version: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  migrate: (data: any) => AppState;
};

const MIGRATIONS: Migration[] = [
  {
    version: '0.2.0',
    migrate: (data): AppState => {
      // Extract team members from projects into a global pool.
      // Rewrite project.teamMembers → project.assignments.
      // Preserve original member IDs so MonthlyAllocation.memberId stays valid.
      const poolMap = new Map<string, PoolMember>();

      const migratedProjects = (data.projects ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (project: any) => {
          const oldMembers = project.teamMembers ?? [];
          const assignments: ProjectAssignment[] = [];

          for (const member of oldMembers) {
            // Add to pool (dedupe by original id)
            if (!poolMap.has(member.id)) {
              poolMap.set(member.id, {
                id: member.id,
                name: member.name,
                role: member.role,
              });
            }

            // Create assignment using same id so allocations stay linked
            assignments.push({
              id: member.id,
              poolMemberId: member.id,
            });
          }

          // Remove old teamMembers, add assignments
          const { teamMembers: _, ...rest } = project;
          return { ...rest, assignments };
        },
      );

      return {
        version: '0.2.0',
        settings: data.settings,
        teamPool: Array.from(poolMap.values()),
        projects: migratedProjects,
      };
    },
  },
];

export function runMigrations(data: AppState, fromVersion: string): AppState {
  // Normalize legacy version: pre-production used 1.0.0 before switching to 0.x.y
  const normalizedFrom = fromVersion === '1.0.0' ? '0.1.0' : fromVersion;

  const pendingMigrations = MIGRATIONS.filter(
    (m) => compareVersions(m.version, normalizedFrom) > 0
  );

  if (pendingMigrations.length === 0) return data;

  let migrated = data;
  for (const migration of pendingMigrations) {
    migrated = migration.migrate(migrated);
    migrated = { ...migrated, version: migration.version };
  }

  return { ...migrated, version: DATA_VERSION };
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
