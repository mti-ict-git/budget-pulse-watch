/**
 * Role-based permission system for Budget Pulse Watch
 * 
 * Role Definitions:
 * - admin: Full access to all features
 * - doccon: Can create/submit PRF, define budgeting, manage COA
 * - user: View-only access
 */

export type UserRole = 'admin' | 'doccon' | 'user';

export enum Permission {
  // PRF Management
  PRF_CREATE = 'prf:create',
  PRF_EDIT = 'prf:edit',
  PRF_DELETE = 'prf:delete',
  PRF_SUBMIT = 'prf:submit',
  PRF_APPROVE = 'prf:approve',
  PRF_VIEW = 'prf:view',
  PRF_VIEW_ALL = 'prf:view_all',
  
  // Budget Management
  BUDGET_CREATE = 'budget:create',
  BUDGET_EDIT = 'budget:edit',
  BUDGET_DELETE = 'budget:delete',
  BUDGET_VIEW = 'budget:view',
  BUDGET_ALLOCATE = 'budget:allocate',
  
  // Chart of Accounts
  COA_CREATE = 'coa:create',
  COA_EDIT = 'coa:edit',
  COA_DELETE = 'coa:delete',
  COA_VIEW = 'coa:view',
  
  // User Management
  USER_CREATE = 'user:create',
  USER_EDIT = 'user:edit',
  USER_DELETE = 'user:delete',
  USER_VIEW = 'user:view',
  USER_GRANT_ACCESS = 'user:grant_access',
  
  // System Administration
  SYSTEM_CONFIG = 'system:config',
  SYSTEM_LOGS = 'system:logs',
  SYSTEM_BACKUP = 'system:backup',
  
  // Reports
  REPORTS_VIEW = 'reports:view',
  REPORTS_EXPORT = 'reports:export',
  REPORTS_ADVANCED = 'reports:advanced'
}

/**
 * Role permission mappings
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    // Full access to everything
    Permission.PRF_CREATE,
    Permission.PRF_EDIT,
    Permission.PRF_DELETE,
    Permission.PRF_SUBMIT,
    Permission.PRF_APPROVE,
    Permission.PRF_VIEW,
    Permission.PRF_VIEW_ALL,
    Permission.BUDGET_CREATE,
    Permission.BUDGET_EDIT,
    Permission.BUDGET_DELETE,
    Permission.BUDGET_VIEW,
    Permission.BUDGET_ALLOCATE,
    Permission.COA_CREATE,
    Permission.COA_EDIT,
    Permission.COA_DELETE,
    Permission.COA_VIEW,
    Permission.USER_CREATE,
    Permission.USER_EDIT,
    Permission.USER_DELETE,
    Permission.USER_VIEW,
    Permission.USER_GRANT_ACCESS,
    Permission.SYSTEM_CONFIG,
    Permission.SYSTEM_LOGS,
    Permission.SYSTEM_BACKUP,
    Permission.REPORTS_VIEW,
    Permission.REPORTS_EXPORT,
    Permission.REPORTS_ADVANCED
  ],
  
  doccon: [
    // Can create/submit PRF and define budgeting
    Permission.PRF_CREATE,
    Permission.PRF_EDIT,
    Permission.PRF_SUBMIT,
    Permission.PRF_VIEW,
    Permission.PRF_VIEW_ALL,
    Permission.BUDGET_CREATE,
    Permission.BUDGET_EDIT,
    Permission.BUDGET_VIEW,
    Permission.BUDGET_ALLOCATE,
    Permission.COA_CREATE,
    Permission.COA_EDIT,
    Permission.COA_VIEW,
    Permission.REPORTS_VIEW,
    Permission.REPORTS_EXPORT
  ],
  
  user: [
    // View-only access
    Permission.PRF_VIEW,
    Permission.BUDGET_VIEW,
    Permission.COA_VIEW,
    Permission.REPORTS_VIEW
  ]
};

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Check if a user role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if a user role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Check if a role can perform admin-level operations
 */
export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Check if a role can create and manage content (admin or doccon)
 */
export function canManageContent(role: UserRole): boolean {
  return role === 'admin' || role === 'doccon';
}

/**
 * Check if a role has read-only access
 */
export function isReadOnly(role: UserRole): boolean {
  return role === 'user';
}

/**
 * Validate if a role is valid
 */
export function isValidRole(role: string): role is UserRole {
  return ['admin', 'doccon', 'user'].includes(role);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const displayNames: Record<UserRole, string> = {
    admin: 'Administrator',
    doccon: 'Document Controller',
    user: 'User'
  };
  return displayNames[role];
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    admin: 'Full access to all system features and administration',
    doccon: 'Can create/submit PRF, define budgeting, and manage chart of accounts',
    user: 'View-only access to system data and reports'
  };
  return descriptions[role];
}