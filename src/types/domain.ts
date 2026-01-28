// Labor Rates (Global Settings)
export interface LaborRate {
  role: string;
  hourlyRate: number;
}

export interface Settings {
  hoursPerMonth: number;
  discountRateAnnual: number;
  laborRates: LaborRate[];
}

// Team Member
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  type: 'Core' | 'Extended';
}

// Monthly Allocation (user intent - never modified by productivity)
export interface MonthlyAllocation {
  memberId: string;
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
  allocations: MonthlyAllocation[];
  productivityWindows: ProductivityWindow[];
}

// Project
export interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  baselineBudget: number;
  actualCost: number;
  teamMembers: TeamMember[];
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
  projects: Project[];
}
