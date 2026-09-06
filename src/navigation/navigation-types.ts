import { UserRole } from '@/types/auth.types';

export type NavigationCategory = 
  | 'workspace'   // Employee personal items
  | 'operations'  // HR operational master data
  | 'payroll'     // Payroll processing & distribution
  | 'config'      // Master configuration
  | 'admin';      // System administration

export interface NavigationItemConfig {
  id: string;
  label: string;
  href: string;
  iconName: string;
  category: NavigationCategory;
  /**
   * Roles that are allowed to see this navigation item.
   * Note: This is purely for frontend visibility. Authoritative enforcement
   * happens on the backend API endpoints.
   */
  allowedRoles: UserRole[];
  badge?: string;
  isReadOnlyForRoles?: UserRole[];
}

export interface NavigationCategoryConfig {
  category: NavigationCategory;
  label: string;
  allowedRoles: UserRole[];
}
