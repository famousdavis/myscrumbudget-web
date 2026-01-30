// Labor Rates (Global Settings)
export interface LaborRate {
  role: string;
  hourlyRate: number;
}

export interface Settings {
  discountRateAnnual: number;
  laborRates: LaborRate[];
}

// Global Team Member Pool
export interface PoolMember {
  id: string;
  name: string;
  role: string; // references LaborRate.role
}

// Project Assignment — links a pool member into a project
// Each assignment gets its own allocation row; the same poolMemberId
// can appear multiple times in a project for "generic" roles.
export interface ProjectAssignment {
  id: string; // unique — MonthlyAllocation.memberId references this
  poolMemberId: string; // references PoolMember.id
}

// Resolved Team Member — produced by joining ProjectAssignment + PoolMember.
// Used by calc engine, AllocationGrid, and charts.
export interface TeamMember {
  id: string; // assignment id (for allocation lookups)
  name: string;
  role: string;
}

// Monthly Allocation (user intent - never modified by productivity)
export interface MonthlyAllocation {
  memberId: string; // references ProjectAssignment.id
  month: string; // ISO date (YYYY-MM)
  allocation: number; // 0.0 to 1.0
}

// Productivity Window (applied at calculation time only)
export interface ProductivityWindow {
  id: string;
  startDate: string;
  endDate: string;
  factor: number; // 0.0 to 1.0
}

// Reforecast Snapshot
export interface Reforecast {
  id: string;
  name: string;
  createdAt: string;
  startDate: string;
  reforecastDate: string; // ISO date (YYYY-MM-DD) — when this reforecast was prepared
  allocations: MonthlyAllocation[];
  productivityWindows: ProductivityWindow[];
  actualCost: number;
  baselineBudget: number;
}

// Project
export interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  assignments: ProjectAssignment[];
  reforecasts: Reforecast[];
  activeReforecastId: string | null;
}

// Calculated Values
export interface MonthlyCalculation {
  month: string;
  cost: number;
  hours: number;
  cumulativeCost: number;
  cumulativeHours: number;
}

export interface ProjectMetrics {
  etc: number;
  eac: number;
  variance: number;
  variancePercent: number;
  budgetRatio: number;
  weeklyBurnRate: number;
  npv: number;
  totalHours: number;
  monthlyData: MonthlyCalculation[];
}

// Full application state
export interface AppState {
  version: string;
  settings: Settings;
  teamPool: PoolMember[];
  projects: Project[];
}
