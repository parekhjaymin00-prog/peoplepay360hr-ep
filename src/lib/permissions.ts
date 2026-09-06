import { UserRole } from '@/types/auth.types';

/**
 * Frontend Visibility Model.
 * 
 * NOTE: This is purely for tailoring the frontend UI experience (showing/hiding menus and buttons).
 * It is NOT the authorization source of truth. Authoritative authorization and security
 * are enforced by the backend API and database layer.
 */
export interface RoleCapabilities {
  canManageEmployees: boolean;
  canManageContracts: boolean;
  canManageSchedules: boolean;
  canManageAttendance: boolean;
  canApproveTimeOff: boolean;
  canAccessPayroll: boolean;
  canModifySalaryConfig: boolean;
  canManageUsers: boolean;
  roleLabel: string;
  description: string;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleCapabilities> = {
  EMPLOYEE: {
    canManageEmployees: false,
    canManageContracts: false,
    canManageSchedules: false,
    canManageAttendance: false,
    canApproveTimeOff: false,
    canAccessPayroll: false,
    canModifySalaryConfig: false,
    canManageUsers: false,
    roleLabel: 'Employee',
    description: 'Own info, own attendance, own time off requests. No HR or payroll administration.',
  },
  HR_MANAGER: {
    canManageEmployees: true,
    canManageContracts: true,
    canManageSchedules: true,
    canManageAttendance: true,
    canApproveTimeOff: true,
    canAccessPayroll: false,
    canModifySalaryConfig: false,
    canManageUsers: false,
    roleLabel: 'HR Manager',
    description: 'Full CRUD on Employees, Attendance, Contracts, Working Schedules, and Time Off. No payroll access.',
  },
  HR_PAYROLL_USER: {
    canManageEmployees: true,
    canManageContracts: true,
    canManageSchedules: true,
    canManageAttendance: true,
    canApproveTimeOff: true,
    canAccessPayroll: true,
    canModifySalaryConfig: false, // Read-only to Salary Structures/Rules
    canManageUsers: false,
    roleLabel: 'HR Payroll User',
    description: 'All HR Manager capabilities + create/read/update Payruns and Payslips. Read-only salary configuration.',
  },
  HR_PAYROLL_MANAGER: {
    canManageEmployees: true,
    canManageContracts: true,
    canManageSchedules: true,
    canManageAttendance: true,
    canApproveTimeOff: true,
    canAccessPayroll: true,
    canModifySalaryConfig: true, // Full CRUD on structures & rules
    canManageUsers: false,
    roleLabel: 'HR Payroll Manager',
    description: 'Full control over HR operations, Payruns, Payslips, and Salary Structures & Rules.',
  },
  ADMIN: {
    canManageEmployees: true,
    canManageContracts: true,
    canManageSchedules: true,
    canManageAttendance: true,
    canApproveTimeOff: true,
    canAccessPayroll: true,
    canModifySalaryConfig: true,
    canManageUsers: true,
    roleLabel: 'Administrator',
    description: 'Full unrestricted access across all modules, system configurations, and user management.',
  },
};

export function getRoleCapabilities(role: UserRole): RoleCapabilities {
  return ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.EMPLOYEE;
}
