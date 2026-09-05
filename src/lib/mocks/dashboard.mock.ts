import { PayrollDashboardMetrics } from '@/types/payroll.types';

/**
 * VISUAL PRESENTATION MOCK DATA ONLY.
 */
export const MOCK_DASHBOARD_METRICS: PayrollDashboardMetrics = {
  totalNetSalaryPaid: 33498.0,
  payslipsGenerated: 4,
  averageSalary: 8374.5,
  approvedTimeOffDays: 16,
  attendanceHealthRate: 94.8,
  activePayrunWarnings: [
    'Payrun "March 2026 Regular Batch": 1 employee has unverified bank account details.',
    'Attendance: 1 missing check-out entry requires manual supervisor review.',
    'Contract: 1 employee contract will expire in 30 days.',
  ],
  departmentExpenditure: [
    { department: 'Engineering', headcount: 1, totalCost: 8680.0 },
    { department: 'Product & Design', headcount: 1, totalCost: 7082.0 },
    { department: 'Executive', headcount: 1, totalCost: 12440.0 },
    { department: 'Finance & Payroll', headcount: 1, totalCost: 5296.0 },
  ],
  monthlyNetSalaryTrends: [
    { month: 'Oct 2025', amount: 31200 },
    { month: 'Nov 2025', amount: 31200 },
    { month: 'Dec 2025', amount: 34500 },
    { month: 'Jan 2026', amount: 33100 },
    { month: 'Feb 2026', amount: 33498 },
    { month: 'Mar 2026', amount: 33498 },
  ],
};
