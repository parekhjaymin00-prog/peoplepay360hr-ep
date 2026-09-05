import { NavigationCategoryConfig, NavigationItemConfig } from './navigation-types';

export const NAVIGATION_CATEGORIES: NavigationCategoryConfig[] = [
  {
    category: 'workspace',
    label: 'My Workspace',
    allowedRoles: ['EMPLOYEE'],
  },
  {
    category: 'operations',
    label: 'HR Operations',
    allowedRoles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  },
  {
    category: 'payroll',
    label: 'Payroll Operations',
    allowedRoles: ['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  },
  {
    category: 'config',
    label: 'Master Configuration',
    allowedRoles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  },
  {
    category: 'admin',
    label: 'Administration',
    allowedRoles: ['ADMIN'],
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
    allowedRoles: ['EMPLOYEE'],
  },
  {
    id: 'emp-profile',
    label: 'My Employee Profile',
    href: '/employees/emp-1',
    iconName: 'User',
    category: 'workspace',
    allowedRoles: ['EMPLOYEE'],
  },
  {
    id: 'emp-attendance',
    label: 'My Attendance',
    href: '/attendance',
    iconName: 'Clock',
    category: 'workspace',
    allowedRoles: ['EMPLOYEE'],
  },
  {
    id: 'emp-timeoff-requests',
    label: 'My Time Off Requests',
    href: '/time-off/requests',
    iconName: 'CalendarCheck',
    category: 'workspace',
    allowedRoles: ['EMPLOYEE'],
  },
  {
    id: 'emp-timeoff-allocations',
    label: 'My Leave Allocations',
    href: '/time-off/allocations',
    iconName: 'CalendarClock',
    category: 'workspace',
    allowedRoles: ['EMPLOYEE'],
  },
  {
    id: 'emp-payslips',
    label: 'My Payslips',
    href: '/payroll/payslips',
    iconName: 'FileSpreadsheet',
    category: 'workspace',
    allowedRoles: ['EMPLOYEE'],
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
    allowedRoles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  },
  {
    id: 'hr-employees',
    label: 'Employees Directory',
    href: '/employees',
    iconName: 'Users',
    category: 'operations',
    allowedRoles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  },
  {
    id: 'hr-attendance',
    label: 'Attendance Register',
    href: '/attendance',
    iconName: 'Clock',
    category: 'operations',
    allowedRoles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  },
  {
    id: 'hr-timeoff-requests',
    label: 'Time Off Requests',
    href: '/time-off/requests',
    iconName: 'CalendarCheck',
    category: 'operations',
    allowedRoles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  },
  {
    id: 'hr-timeoff-allocations',
    label: 'Time Off Allocations',
    href: '/time-off/allocations',
    iconName: 'CalendarClock',
    category: 'operations',
    allowedRoles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
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
    allowedRoles: ['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  },
  {
    id: 'payroll-payslips',
    label: 'All Payslips',
    href: '/payroll/payslips',
    iconName: 'FileSpreadsheet',
    category: 'payroll',
    allowedRoles: ['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
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
    allowedRoles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  },
  {
    id: 'config-schedules',
    label: 'Working Schedules',
    href: '/configuration/working-schedules',
    iconName: 'CalendarClock',
    category: 'config',
    allowedRoles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
  },
  {
    id: 'config-structures',
    label: 'Salary Structures',
    href: '/configuration/salary-structures',
    iconName: 'Layers',
    category: 'config',
    allowedRoles: ['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
    isReadOnlyForRoles: ['HR_PAYROLL_USER'], // Read-only for HR Payroll User
  },
  {
    id: 'config-rules',
    label: 'Salary Rules',
    href: '/configuration/salary-rules',
    iconName: 'Sliders',
    category: 'config',
    allowedRoles: ['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN'],
    isReadOnlyForRoles: ['HR_PAYROLL_USER'], // Read-only for HR Payroll User
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
    allowedRoles: ['ADMIN'],
    badge: 'TBD Backend',
  },
];
