'use client';

import React from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

/**
 * Dashboard Page Route.
 * Renders the reusable DashboardShell which routes to Employee Workspace or
 * Administrative HR & Payroll Dashboard based on active session role.
 */
export default function DashboardPage() {
  return <DashboardShell />;
}
