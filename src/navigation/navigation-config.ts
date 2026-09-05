import { NavigationCategoryConfig, NavigationItemConfig } from './navigation-types';

export const NAVIGATION_CATEGORIES: NavigationCategoryConfig[] = [
  {
    category: 'workspace',
    label: 'My Workspace',
    allowedRoles: ['employee'],
  },
  {
    category: 'operations',
    label: 'HR Operations',
    allowedRoles: ['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'],
  },
  {
    category: 'payroll',
    label: 'Payroll Operations',
    allowedRoles: ['hr_payroll_user', 'hr_payroll_manager', 'admin'],
  },
  {
    category: 'config',
    label: 'Master Configuration',
    allowedRoles: ['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'],
  },
  {
    category: 'admin',
    label: 'Administration',
    allowedRoles: ['admin'],
  },
];

export const NAVIGATION_ITEMS: NavigationItemConfig[] = [
  // -------------------------------------------------------------
  // 1. Employee-specific Personal Workspace
  // -------------------------------------------------------------
  {
    id: 'emp-dashboard',
    label: 'My Workspace',
    href: '/dashboard',
    iconName: 'LayoutDashboard',
    category: 'workspace',
    allowedRoles: ['employee'],
  },
  {
    id: 'emp-profile',
    label: 'My Employee Profile',
    href: '/employees/emp-1',
    iconName: 'User',
    category: 'workspace',
    allowedRoles: ['employee'],
  },
  {
    id: 'emp-attendance',
    label: 'My Attendance',
    href: '/attendance',
    iconName: 'Clock',
    category: 'workspace',
    allowedRoles: ['employee'],
  },
  {
    id: 'emp-timeoff-requests',
    label: 'My Time Off Requests',
    href: '/time-off/requests',
    iconName: 'CalendarCheck',
    category: 'workspace',
    allowedRoles: ['employee'],
  },
  {
    id: 'emp-timeoff-allocations',
    label: 'My Leave Allocations',
    href: '/time-off/allocations',
    iconName: 'CalendarClock',
    category: 'workspace',
    allowedRoles: ['employee'],
  },
  {
    id: 'emp-payslips',
    label: 'My Payslips',
    href: '/payroll/payslips',
    iconName: 'FileSpreadsheet',
    category: 'workspace',
    allowedRoles: ['employee'],
  },

  // -------------------------------------------------------------
  // 2. HR Management Operations
  // -------------------------------------------------------------
  {
    id: 'admin-dashboard',
    label: 'Payroll & HR Dashboard',
    href: '/dashboard',
    iconName: 'LayoutDashboard',
    category: 'operations',
    allowedRoles: ['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'],
  },
  {
    id: 'hr-employees',
    label: 'Employees Directory',
    href: '/employees',
    iconName: 'Users',
    category: 'operations',
    allowedRoles: ['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'],
  },
  {
    id: 'hr-attendance',
    label: 'Attendance Register',
    href: '/attendance',
    iconName: 'Clock',
    category: 'operations',
    allowedRoles: ['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'],
  },
  {
    id: 'hr-timeoff-requests',
    label: 'Time Off Requests',
    href: '/time-off/requests',
    iconName: 'CalendarCheck',
    category: 'operations',
    allowedRoles: ['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'],
  },
  {
    id: 'hr-timeoff-allocations',
    label: 'Time Off Allocations',
    href: '/time-off/allocations',
    iconName: 'CalendarClock',
    category: 'operations',
    allowedRoles: ['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'],
  },

  // -------------------------------------------------------------
  // 3. Payroll Operations
  // -------------------------------------------------------------
  {
    id: 'payroll-payruns',
    label: 'Payrun Batches',
    href: '/payroll/payruns',
    iconName: 'CreditCard',
    category: 'payroll',
    allowedRoles: ['hr_payroll_user', 'hr_payroll_manager', 'admin'],
  },
  {
    id: 'payroll-payslips',
    label: 'All Payslips',
    href: '/payroll/payslips',
    iconName: 'FileSpreadsheet',
    category: 'payroll',
    allowedRoles: ['hr_payroll_user', 'hr_payroll_manager', 'admin'],
  },

  // -------------------------------------------------------------
  // 4. Master Configuration
  // -------------------------------------------------------------
  {
    id: 'config-contracts',
    label: 'Contracts',
    href: '/contracts',
    iconName: 'FileText',
    category: 'config',
    allowedRoles: ['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'],
  },
  {
    id: 'config-schedules',
    label: 'Working Schedules',
    href: '/configuration/working-schedules',
    iconName: 'CalendarClock',
    category: 'config',
    allowedRoles: ['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'],
  },
  {
    id: 'config-structures',
    label: 'Salary Structures',
    href: '/configuration/salary-structures',
    iconName: 'Layers',
    category: 'config',
    allowedRoles: ['hr_payroll_user', 'hr_payroll_manager', 'admin'],
    isReadOnlyForRoles: ['hr_payroll_user'], // Read-only for HR Payroll User
  },
  {
    id: 'config-rules',
    label: 'Salary Rules',
    href: '/configuration/salary-rules',
    iconName: 'Sliders',
    category: 'config',
    allowedRoles: ['hr_payroll_user', 'hr_payroll_manager', 'admin'],
    isReadOnlyForRoles: ['hr_payroll_user'], // Read-only for HR Payroll User
  },

  // -------------------------------------------------------------
  // 5. System Administration (Admin only)
  // -------------------------------------------------------------
  {
    id: 'admin-users',
    label: 'User Management',
    href: '/admin/users',
    iconName: 'Shield',
    category: 'admin',
    allowedRoles: ['admin'],
    badge: 'TBD Backend',
  },
];
