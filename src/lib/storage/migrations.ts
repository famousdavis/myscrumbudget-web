import type { AppState, PoolMember, ProjectAssignment } from '@/types/domain';

export const DATA_VERSION = '0.7.0';

type Migration = {
  version: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  migrate: (data: any) => AppState;
};

/**
 * Runtime guard to assert expected array type during migration
 * Throws descriptive error instead of silently corrupting data
 */
function assertArray(value: unknown, fieldName: string, migrationVersion: string): asserts value is unknown[] | undefined | null {
  if (value !== undefined && value !== null && !Array.isArray(value)) {
    throw new Error(`Migration ${migrationVersion}: Expected "${fieldName}" to be an array, got ${typeof value}`);
  }
}

/**
 * Runtime guard to assert expected object type during migration
 */
function assertObject(value: unknown, fieldName: string, migrationVersion: string): asserts value is Record<string, unknown> | undefined | null {
  if (value !== undefined && value !== null && (typeof value !== 'object' || Array.isArray(value))) {
    throw new Error(`Migration ${migrationVersion}: Expected "${fieldName}" to be an object, got ${typeof value}`);
  }
}

const MIGRATIONS: Migration[] = [
  {
    version: '0.2.0',
    migrate: (data): AppState => {
      // Type guards for critical fields
      assertArray(data.projects, 'projects', '0.2.0');
      assertObject(data.settings, 'settings', '0.2.0');

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
  {
    version: '0.3.0',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    migrate: (data: any): AppState => {
      // Type guards
      assertObject(data.settings, 'settings', '0.3.0');
      assertArray(data.projects, 'projects', '0.3.0');

      // Remove hoursPerMonth from settings — now derived from calendar workdays.
      const { hoursPerMonth: _, ...restSettings } = data.settings ?? {};
      return {
        ...data,
        version: '0.3.0',
        settings: {
          discountRateAnnual: restSettings.discountRateAnnual ?? 0.03,
          laborRates: restSettings.laborRates ?? [],
        },
      };
    },
  },
  {
    version: '0.4.0',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    migrate: (data: any): AppState => {
      // Type guards
      assertArray(data.projects, 'projects', '0.4.0');

      // Move actualCost from Project into each Reforecast.
      // Active reforecast inherits the project's actualCost; others get 0.
      // Projects without reforecasts get a synthetic Baseline.
      const migratedProjects = (data.projects ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (project: any) => {
          const { actualCost: ac, ...restProject } = project;
          const cost = ac ?? 0;

          if (project.reforecasts && project.reforecasts.length > 0) {
            const activeId =
              project.activeReforecastId ?? project.reforecasts[0].id;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const migratedReforecasts = project.reforecasts.map((rf: any) => ({
              ...rf,
              actualCost: rf.id === activeId ? cost : 0,
            }));
            return {
              ...restProject,
              reforecasts: migratedReforecasts,
              activeReforecastId: activeId,
            };
          } else {
            // No reforecasts — create a Baseline
            const baselineId = `rf_baseline_${project.id}`;
            return {
              ...restProject,
              reforecasts: [
                {
                  id: baselineId,
                  name: 'Baseline',
                  createdAt: new Date().toISOString(),
                  startDate: (project.startDate ?? '').slice(0, 7),
                  allocations: [],
                  productivityWindows: [],
                  actualCost: cost,
                },
              ],
              activeReforecastId: baselineId,
            };
          }
        },
      );

      return {
        ...data,
        version: '0.4.0',
        projects: migratedProjects,
      };
    },
  },
  {
    version: '0.5.0',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    migrate: (data: any): AppState => {
      // Type guards
      assertArray(data.projects, 'projects', '0.5.0');

      // Move baselineBudget from Project into each Reforecast.
      // All reforecasts inherit the same project-level budget
      // (they were all created under one budget).
      // Add reforecastDate to each reforecast (derived from createdAt).
      const migratedProjects = (data.projects ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (project: any) => {
          const { baselineBudget: bb, ...restProject } = project;
          const budget = typeof bb === 'number' && Number.isFinite(bb) ? bb : 0;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const migratedReforecasts = (project.reforecasts ?? []).map((rf: any) => ({
            ...rf,
            baselineBudget: budget,
            reforecastDate: rf.createdAt ? rf.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
          }));

          return {
            ...restProject,
            reforecasts: migratedReforecasts,
          };
        },
      );

      return {
        ...data,
        version: '0.5.0',
        projects: migratedProjects,
      };
    },
  },
  {
    version: '0.6.0',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    migrate: (data: any): AppState => {
      // Type guards
      assertObject(data.settings, 'settings', '0.6.0');

      // Add holidays array to settings (empty by default).
      return {
        ...data,
        version: '0.6.0',
        settings: {
          ...data.settings,
          holidays: data.settings?.holidays ?? [],
        },
      };
    },
  },
  {
    version: '0.7.0',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    migrate: (data: any): AppState => {
      // Type guards
      assertObject(data.settings, 'settings', '0.7.0');

      // Add trafficLightThresholds to settings with defaults.
      return {
        ...data,
        version: '0.7.0',
        settings: {
          ...data.settings,
          trafficLightThresholds: data.settings?.trafficLightThresholds ?? {
            amberPercent: 5,
            redPercent: 15,
          },
        },
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
