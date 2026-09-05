export type UserRole = 
  | 'employee' 
  | 'hr_manager' 
  | 'hr_payroll_user' 
  | 'hr_payroll_manager' 
  | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  department?: string;
  avatarUrl?: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'session_expired';

export interface AuthState {
  user: User | null;
  status: AuthStatus;
}
