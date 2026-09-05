export type SalaryRuleCategory = 'basic' | 'allowance' | 'gross' | 'deduction' | 'net';

export interface SalaryRule {
  id: string;
  name: string;
  code: string; // e.g. "BASIC", "HRA", "DA", "GROSS", "PF", "TAX", "NET"
  category: SalaryRuleCategory;
  sequence: number;
  computationType: 'fixed' | 'percentage' | 'formula';
  amountOrPercentage: number;
  formulaDescription?: string;
  active: boolean;
}

export interface SalaryStructure {
  id: string;
  name: string;
  code: string;
  active: boolean;
  rulesCount: number;
  assignedEmployeesCount: number;
  ruleIds: string[];
}

export type PayrunStatus = 'draft' | 'computed' | 'validated' | 'paid';

export interface Payrun {
  id: string;
  name: string; // e.g. "March 2026 General Payroll"
  periodStart: string;
  periodEnd: string;
  salaryStructureId: string;
  salaryStructureName: string;
  status: PayrunStatus;
  payslipsCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  warnings: string[];
  createdAt: string;
}

export interface SalaryRuleLine {
  ruleCode: string;
  ruleName: string;
  category: SalaryRuleCategory;
  amount: number;
  sequence: number;
}

export type PayslipStatus = 'draft' | 'computed' | 'validated' | 'paid';

export interface Payslip {
  id: string;
  payrunId: string;
  payrunName: string;
  employeeId: string;
  employeeName: string;
  department: string;
  jobPosition: string;
  contractReference: string;
  periodStart: string;
  periodEnd: string;
  status: PayslipStatus;
  workedDays: number;
  workedHours: number;
  basicSalary: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  ruleLines: SalaryRuleLine[];
  warnings?: string[];
}

export interface PayrollDashboardMetrics {
  totalNetSalaryPaid: number;
  payslipsGenerated: number;
  averageSalary: number;
  approvedTimeOffDays: number;
  attendanceHealthRate: number; // e.g. 94.8%
  activePayrunWarnings: string[];
  departmentExpenditure: { department: string; headcount: number; totalCost: number }[];
  monthlyNetSalaryTrends: { month: string; amount: number }[];
}
