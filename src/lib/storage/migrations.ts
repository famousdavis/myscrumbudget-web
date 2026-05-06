// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { AppState, PoolMember, ProjectAssignment } from '@/types/domain';

export const DATA_VERSION = '0.13.0';

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
          const { teamMembers: _teamMembers, ...rest } = project;
          void _teamMembers;
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
      const { hoursPerMonth: _hoursPerMonth, ...restSettings } = data.settings ?? {};
      void _hoursPerMonth;
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
  {
    version: '0.8.0',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    migrate: (data: any): AppState => {
      // Type guards
      assertArray(data.projects, 'projects', '0.8.0');

      // Backfill per-reforecast notes field with empty string.
      const migratedProjects = (data.projects ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (project: any) => ({
          ...project,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          reforecasts: (project.reforecasts ?? []).map((rf: any) => ({
            ...rf,
            notes: typeof rf.notes === 'string' ? rf.notes : '',
          })),
        }),
      );

      return {
        ...data,
        version: '0.8.0',
        projects: migratedProjects,
      };
    },
  },
  {
    version: '0.9.0',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    migrate: (data: any): AppState => {
      // Structural no-op: historicalCosts is an optional new field on Reforecast.
      // Existing reforecasts legitimately lack it; "absent" means "no breakdown yet".
      assertArray(data.projects, 'projects', '0.9.0');
      return { ...data, version: '0.9.0' };
    },
  },
  {
    version: '0.10.0',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    migrate: (data: any): AppState => {
      // Cleanup pass for unreleased v0.22.0-experiment data. An earlier
      // (scrapped) design snapshotted allocation-derived costs into
      // historicalCosts entries with `source: "scenario"` metadata and
      // tracked a `useForHistory` flag on Reforecast. The final v0.22.0
      // design (D7/D8) rejected both. This migration strips them so the
      // current shape ({month, cost, hours}) is the only thing stored.
      assertArray(data.projects, 'projects', '0.10.0');

      const migratedProjects = (data.projects ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (project: any) => ({
          ...project,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          reforecasts: (project.reforecasts ?? []).map((rf: any) => {
            // Strip the scrapped useForHistory flag.
            const { useForHistory: _useForHistory, ...rfRest } = rf;
            void _useForHistory;

            if (!Array.isArray(rfRest.historicalCosts)) {
              return rfRest;
            }

            // Drop entries that were auto-generated by the scrapped
            // snapshot mechanic (source: "scenario"); strip metadata
            // fields from any user-entered entries that survive.
            const cleaned = rfRest.historicalCosts
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((e: any) => e?.source !== 'scenario')
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((e: any) => ({
                month: e.month,
                cost: e.cost,
                hours: typeof e.hours === 'number' ? e.hours : 0,
              }));

            if (cleaned.length === 0) {
              const { historicalCosts: _historicalCosts, ...rest } = rfRest;
              void _historicalCosts;
              return rest;
            }
            return { ...rfRest, historicalCosts: cleaned };
          }),
        }),
      );

      return { ...data, version: '0.10.0', projects: migratedProjects };
    },
  },
  {
    version: '0.11.0',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    migrate: (data: any): AppState => {
      // Move project-level assignments into each reforecast so each
      // reforecast becomes a self-contained point-in-time snapshot.
      // Strategy: copy verbatim (same IDs) into every reforecast that
      // doesn't already have its own assignments array. Allocation
      // linkage is preserved because assignment IDs are unchanged.
      assertArray(data.projects, 'projects', '0.11.0');

      const migratedProjects = (data.projects ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (project: any) => {
          const projectAssignments: ProjectAssignment[] = Array.isArray(project.assignments)
            ? project.assignments
            : [];

          const migratedReforecasts = (project.reforecasts ?? []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (rf: any) => {
              if (Array.isArray(rf.assignments)) {
                // Idempotency: a reforecast that already has its own
                // assignments wins (re-running migration is safe).
                return rf;
              }
              return {
                ...rf,
                assignments: projectAssignments.map((a) => ({ ...a })),
              };
            },
          );

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { assignments: _drop, ...rest } = project;
          return { ...rest, reforecasts: migratedReforecasts };
        },
      );

      return { ...data, version: '0.11.0', projects: migratedProjects };
    },
  },
  {
    version: '0.12.0',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    migrate: (data: any): AppState => {
      // Structural no-op: archived is an optional new field on PoolMember.
      // Existing pool members legitimately lack it; "absent" means "active".
      assertArray(data.teamPool, 'teamPool', '0.12.0');
      return { ...data, version: '0.12.0' };
    },
  },
  {
    version: '0.13.0',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    migrate: (data: any): AppState => {
      // Adds violetPercent to trafficLightThresholds for the new "Under Budget"
      // health status. Spread preserves any user-customized amber/red values.
      assertObject(data.settings, 'settings', '0.13.0');
      return {
        ...data,
        version: '0.13.0',
        settings: {
          ...data.settings,
          trafficLightThresholds: {
            ...data.settings?.trafficLightThresholds,
            violetPercent:
              data.settings?.trafficLightThresholds?.violetPercent ?? 20,
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
