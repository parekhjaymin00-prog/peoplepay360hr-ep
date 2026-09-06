/**
 * User roles matching backend canonical roles
 */
export type UserRole = 
  | 'EMPLOYEE'
  | 'HR_MANAGER'
  | 'HR_PAYROLL_USER'
  | 'HR_PAYROLL_MANAGER'
  | 'ADMIN';

/**
 * Lowercase role codes for backward compatibility
 * (Frontend may use lowercase in some places)
 */
export type UserRoleLowercase =
  | 'employee'
  | 'hr_manager'
  | 'hr_payroll_user'
  | 'hr_payroll_manager'
  | 'admin';

/**
 * User interface matching backend SafeUser structure
 */
export interface User {
  id: string;
  email: string;
  isActive: boolean;
  lastLoginAt: Date | string | null;
  role: {
    id: string;
    code: UserRole;
    name: string;
  };
  permissions: string[];
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    department: {
      id: string;
      name: string;
      code: string;
    };
    jobPosition: {
      id: string;
      title: string;
      code: string;
    };
  } | null;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'session_expired';

export interface AuthState {
  user: User | null;
  status: AuthStatus;
}

