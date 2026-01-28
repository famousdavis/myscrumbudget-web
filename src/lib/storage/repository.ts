import type { Settings, Project, AppState } from '@/types/domain';

export interface Repository {
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;

  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;

  exportAll(): Promise<AppState>;
  importAll(state: AppState): Promise<void>;

  clear(): Promise<void>;
  getVersion(): Promise<string>;
  migrateIfNeeded(): Promise<void>;
}
