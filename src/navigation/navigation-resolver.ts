import { UserRole } from '@/types/auth.types';
import { NAVIGATION_CATEGORIES, NAVIGATION_ITEMS } from './navigation-config';
import { NavigationCategoryConfig, NavigationItemConfig } from './navigation-types';

export interface ResolvedNavigationGroup {
  category: NavigationCategoryConfig;
  items: (NavigationItemConfig & { isReadOnly: boolean })[];
}

/**
 * Resolves the visible navigation groups based on the provided user role.
 * 
 * NOTE: This is purely client-side UI visibility resolution.
 * Real security and authorization are enforced authoritatively by the backend API.
 */
export function resolveNavigation(role: UserRole): ResolvedNavigationGroup[] {
  // Safe fallback if role is undefined
  const effectiveRole: UserRole = role || 'employee';

  const visibleCategories = NAVIGATION_CATEGORIES.filter((cat) =>
    cat.allowedRoles.includes(effectiveRole)
  );

  const groups: ResolvedNavigationGroup[] = [];

  for (const cat of visibleCategories) {
    const categoryItems = NAVIGATION_ITEMS.filter(
      (item) => item.category === cat.category && item.allowedRoles.includes(effectiveRole)
    ).map((item) => ({
      ...item,
      isReadOnly: !!item.isReadOnlyForRoles?.includes(effectiveRole),
    }));

    if (categoryItems.length > 0) {
      groups.push({
        category: cat,
        items: categoryItems,
      });
    }
  }

  return groups;
}

/**
 * Checks if a given route is accessible for the specified role in the frontend UI.
 */
export function isRouteVisibleForRole(pathname: string, role: UserRole): boolean {
  if (role === 'admin') return true;

  // Find matching navigation item by prefix
  const matchingItem = NAVIGATION_ITEMS.find((item) => {
    if (item.href === '/dashboard' && pathname === '/dashboard') return true;
    if (item.href !== '/dashboard' && pathname.startsWith(item.href)) return true;
    return false;
  });

  if (!matchingItem) return true; // Default to allow if not explicitly in menu

  return matchingItem.allowedRoles.includes(role);
}
