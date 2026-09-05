'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { EmployeeDashboard } from './EmployeeDashboard';
import { AdministrativeDashboard } from './AdministrativeDashboard';

/**
 * Reusable Dashboard Shell.
 * 
 * Determines whether to display:
 * 1. Personal Employee Workspace (for role 'employee')
 * 2. HR Operations Dashboard (for role 'hr_manager' without payroll administrative metrics)
 * 3. Payroll & HR Executive Dashboard (for roles 'hr_payroll_user', 'hr_payroll_manager', 'admin')
 * 
 * Note: Presentation data is strictly visual demo data. Backend remains authoritative for business metrics.
 */
export const DashboardShell: React.FC = () => {
  const { role } = useAuth();

  if (role === 'EMPLOYEE') {
    return <EmployeeDashboard />;
  }

  return <AdministrativeDashboard role={role} />;
};
